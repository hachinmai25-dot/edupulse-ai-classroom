import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  AuthenticatedRequest,
  extractBearerToken,
  hashPassword,
  requireRole,
  signAuthToken,
  verifyAuthToken,
  verifyPassword,
} from './server/auth';
import {
  createUser,
  findUserByEmail,
  findUserById,
  getScopedStateForUser,
  resetDemoLMSData,
  toPublicUser,
  toggleUserBookmark,
  updateLMSDatabase,
} from './server/store';
import {
  PROFESSOR_AVATAR,
  STUDENT_AVATAR,
} from './src/data/seedData';
import type {
  Announcement,
  AppNotification,
  Assignment,
  AssignmentSubmission,
  DoubtThread,
  LectureNote,
  NavSection,
  Quiz,
  QuizAttempt,
  UserRole,
} from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function isSafeHttpUrl(raw?: unknown): raw is string {
  if (typeof raw !== 'string' || !raw.trim()) return false;
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function pushNotif(
  notifications: AppNotification[],
  targetRole: UserRole,
  title: string,
  detail: string,
  section: NavSection,
  targetUserId?: string
): AppNotification[] {
  const notif: AppNotification = {
    id: uid('notif'),
    targetRole,
    targetUserId,
    title,
    detail,
    section,
    read: false,
    createdAt: new Date().toISOString(),
  };
  return [notif, ...notifications].slice(0, 40);
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  const user = findUserById(payload.sub);
  if (!user) {
    res.status(401).json({ error: 'Account not found.' });
    return;
  }
  req.authUser = toPublicUser(user);
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // Authentication Routes
  // ---------------------------------------------------------------------------
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const user = findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    const publicUser = toPublicUser(user);
    const token = signAuthToken(publicUser);
    res.json({ token, user: publicUser });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { name, email, password, role, subtitle } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'Please enter your full name (2+ characters).' });
      return;
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    if (role !== 'professor' && role !== 'student') {
      res.status(400).json({ error: 'Role must be professor or student.' });
      return;
    }
    if (findUserByEmail(email)) {
      res.status(409).json({ error: 'An account with that email already exists.' });
      return;
    }

    const cleanName = name.trim().slice(0, 80);
    const cleanEmail = email.trim().toLowerCase();
    const cleanSubtitle =
      typeof subtitle === 'string' && subtitle.trim()
        ? subtitle.trim().slice(0, 80)
        : role === 'professor'
        ? 'Faculty · Computer Science'
        : 'B.S. Computer Science';

    const publicUser = createUser({
      id: uid(role === 'professor' ? 'prof' : 'stu'),
      name: cleanName,
      email: cleanEmail,
      role,
      avatarUrl: role === 'professor' ? PROFESSOR_AVATAR : STUDENT_AVATAR,
      subtitle: cleanSubtitle,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    });

    const token = signAuthToken(publicUser);
    res.status(201).json({ token, user: publicUser });
  });

  app.get('/api/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.authUser });
  });

  // ---------------------------------------------------------------------------
  // Scoped LMS State & Actions
  // ---------------------------------------------------------------------------
  app.get('/api/lms/state', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const scoped = getScopedStateForUser(req.authUser!);
    res.json({ state: scoped });
  });

  // Professor: Create Quiz
  app.post(
    '/api/lms/quizzes',
    authenticate,
    requireRole('professor'),
    (req: AuthenticatedRequest, res: Response) => {
      const { courseId, title, description, timeLimitMinutes, dueDate, status, questions } =
        req.body ?? {};
      if (typeof title !== 'string' || !title.trim() || !Array.isArray(questions) || questions.length === 0) {
        res.status(400).json({ error: 'Quiz title and at least one question are required.' });
        return;
      }

      const cleanQuestions = questions.map((q: Record<string, unknown>) => ({
        id: typeof q.id === 'string' && q.id ? q.id : uid('q'),
        text: String(q.text ?? '').trim(),
        options: Array.isArray(q.options) ? q.options.slice(0, 4).map((o) => String(o).trim()) : [],
        correctIndex: Math.min(Math.max(Number(q.correctIndex) || 0, 0), 3),
        points: Math.max(1, Math.round(Number(q.points) || 10)),
        explanation: String(q.explanation ?? '').trim(),
      }));

      if (cleanQuestions.some((q) => !q.text || q.options.length < 4 || q.options.some((o) => !o))) {
        res.status(400).json({ error: 'Every question requires prompt text and 4 non-empty options.' });
        return;
      }

      const newQuiz: Quiz = {
        id: uid('quiz'),
        courseId: typeof courseId === 'string' ? courseId : 'cs301',
        title: title.trim(),
        description:
          typeof description === 'string' && description.trim()
            ? description.trim()
            : 'Course comprehension and problem-solving assessment.',
        timeLimitMinutes: Math.max(1, Math.round(Number(timeLimitMinutes) || 15)),
        dueDate: typeof dueDate === 'string' && dueDate ? dueDate : '2026-12-05',
        status: status === 'draft' ? 'draft' : 'published',
        questions: cleanQuestions,
        createdAt: new Date().toISOString(),
      };

      updateLMSDatabase((lms) => {
        lms.quizzes.unshift(newQuiz);
        if (newQuiz.status === 'published') {
          const course = lms.courses.find((c) => c.id === newQuiz.courseId);
          lms.notifications = pushNotif(
            lms.notifications,
            'student',
            `New Quiz Published: ${newQuiz.title}`,
            `${course?.code ?? 'Course'} · ${newQuiz.timeLimitMinutes} mins · Due ${newQuiz.dueDate}`,
            'quizzes'
          );
        }
      });

      res.status(201).json({ quiz: newQuiz, state: getScopedStateForUser(req.authUser!) });
    }
  );

  // Professor: Toggle Quiz Published/Draft
  app.patch(
    '/api/lms/quizzes/:id/toggle',
    authenticate,
    requireRole('professor'),
    (req: AuthenticatedRequest, res: Response) => {
      const quizId = req.params.id;
      let found = false;
      updateLMSDatabase((lms) => {
        lms.quizzes = lms.quizzes.map((q) => {
          if (q.id !== quizId) return q;
          found = true;
          const nextStatus: 'published' | 'draft' = q.status === 'published' ? 'draft' : 'published';
          if (nextStatus === 'published') {
            const course = lms.courses.find((c) => c.id === q.courseId);
            lms.notifications = pushNotif(
              lms.notifications,
              'student',
              `Quiz Now Available: ${q.title}`,
              `${course?.code ?? 'Course'} · Due ${q.dueDate}`,
              'quizzes'
            );
          }
          return { ...q, status: nextStatus };
        });
      });

      if (!found) {
        res.status(404).json({ error: 'Quiz not found.' });
        return;
      }
      res.json({ state: getScopedStateForUser(req.authUser!) });
    }
  );

  // Professor: Delete Quiz
  app.delete(
    '/api/lms/quizzes/:id',
    authenticate,
    requireRole('professor'),
    (req: AuthenticatedRequest, res: Response) => {
      const quizId = req.params.id;
      updateLMSDatabase((lms) => {
        lms.quizzes = lms.quizzes.filter((q) => q.id !== quizId);
        lms.quizAttempts = lms.quizAttempts.filter((a) => a.quizId !== quizId);
      });
      res.json({ state: getScopedStateForUser(req.authUser!) });
    }
  );

  // Student: Submit Quiz Attempt (graded server-side!)
  app.post(
    '/api/lms/quizzes/:id/attempt',
    authenticate,
    requireRole('student'),
    (req: AuthenticatedRequest, res: Response) => {
      const quizId = req.params.id;
      const { answers, timeTakenSeconds } = req.body ?? {};
      const user = req.authUser!;

      let createdAttempt: QuizAttempt | null = null;
      let gradedQuiz: Quiz | null = null;

      updateLMSDatabase((lms) => {
        const quiz = lms.quizzes.find((q) => q.id === quizId && q.status === 'published');
        if (!quiz) return;
        gradedQuiz = quiz;
        const safeAnswers: Record<string, number> =
          answers && typeof answers === 'object' ? (answers as Record<string, number>) : {};

        let score = 0;
        let maxScore = 0;
        for (const question of quiz.questions) {
          maxScore += question.points;
          if (safeAnswers[question.id] === question.correctIndex) {
            score += question.points;
          }
        }

        createdAttempt = {
          id: uid('att'),
          quizId,
          studentId: user.id,
          studentName: user.name,
          answers: safeAnswers,
          score,
          maxScore,
          timeTakenSeconds: Math.max(1, Math.round(Number(timeTakenSeconds) || 1)),
          submittedAt: new Date().toISOString(),
        };

        lms.quizAttempts = [
          createdAttempt,
          ...lms.quizAttempts.filter((a) => !(a.quizId === quizId && a.studentId === user.id)),
        ];

        const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
        lms.notifications = pushNotif(
          lms.notifications,
          'professor',
          `${user.name} completed ${quiz.title}`,
          `Scored ${score}/${maxScore} (${pct}%).`,
          'quizzes'
        );
      });

      if (!gradedQuiz || !createdAttempt) {
        res.status(404).json({ error: 'Published quiz not found.' });
        return;
      }

      res.status(201).json({
        attempt: createdAttempt,
        quiz: gradedQuiz,
        state: getScopedStateForUser(user),
      });
    }
  );

  // Professor: Create Assignment
  app.post(
    '/api/lms/assignments',
    authenticate,
    requireRole('professor'),
    (req: AuthenticatedRequest, res: Response) => {
      const { courseId, title, instructions, dueDate, maxPoints } = req.body ?? {};
      if (typeof title !== 'string' || !title.trim() || typeof instructions !== 'string' || !instructions.trim()) {
        res.status(400).json({ error: 'Assignment title and instructions are required.' });
        return;
      }

      const assignment: Assignment = {
        id: uid('assign'),
        courseId: typeof courseId === 'string' ? courseId : 'cs301',
        title: title.trim(),
        instructions: instructions.trim(),
        dueDate: typeof dueDate === 'string' && dueDate ? dueDate : '2026-12-06',
        maxPoints: Math.max(1, Math.round(Number(maxPoints) || 100)),
        createdAt: new Date().toISOString(),
      };

      updateLMSDatabase((lms) => {
        lms.assignments.unshift(assignment);
        const course = lms.courses.find((c) => c.id === assignment.courseId);
        lms.notifications = pushNotif(
          lms.notifications,
          'student',
          `New Assignment: ${assignment.title}`,
          `${course?.code ?? 'Course'} · ${assignment.maxPoints} pts · Due ${assignment.dueDate}`,
          'assignments'
        );
      });

      res.status(201).json({ assignment, state: getScopedStateForUser(req.authUser!) });
    }
  );

  // Student: Submit Assignment
  app.post(
    '/api/lms/assignments/:id/submit',
    authenticate,
    requireRole('student'),
    (req: AuthenticatedRequest, res: Response) => {
      const assignmentId = req.params.id;
      const { textAnswer, projectUrl } = req.body ?? {};
      const user = req.authUser!;

      const cleanText = typeof textAnswer === 'string' ? textAnswer.trim() : '';
      const cleanUrl = typeof projectUrl === 'string' ? projectUrl.trim() : '';

      if (!cleanText && !cleanUrl) {
        res.status(400).json({ error: 'Provide a written/code solution or a valid URL.' });
        return;
      }
      if (cleanUrl && !isSafeHttpUrl(cleanUrl)) {
        res.status(400).json({ error: 'Project URL must use http:// or https://.' });
        return;
      }

      let foundAssign = false;
      updateLMSDatabase((lms) => {
        const assignment = lms.assignments.find((a) => a.id === assignmentId);
        if (!assignment) return;
        foundAssign = true;
        const nowIso = new Date().toISOString();
        const existing = lms.submissions.find(
          (s) => s.assignmentId === assignmentId && s.studentId === user.id
        );
        if (existing) {
          lms.submissions = lms.submissions.map((s) =>
            s.id === existing.id
              ? {
                  ...s,
                  textAnswer: cleanText,
                  projectUrl: cleanUrl || undefined,
                  status: 'submitted',
                  grade: undefined,
                  feedback: undefined,
                  submittedAt: nowIso,
                  gradedAt: undefined,
                }
              : s
          );
        } else {
          const created: AssignmentSubmission = {
            id: uid('sub'),
            assignmentId,
            studentId: user.id,
            studentName: user.name,
            textAnswer: cleanText,
            projectUrl: cleanUrl || undefined,
            status: 'submitted',
            submittedAt: nowIso,
          };
          lms.submissions.unshift(created);
        }

        lms.notifications = pushNotif(
          lms.notifications,
          'professor',
          `New Submission from ${user.name}`,
          `${assignment.title} is ready for rubric review.`,
          'assignments'
        );
      });

      if (!foundAssign) {
        res.status(404).json({ error: 'Assignment not found.' });
        return;
      }
      res.json({ state: getScopedStateForUser(user) });
    }
  );

  // Professor: Grade Submission
  app.post(
    '/api/lms/submissions/:id/grade',
    authenticate,
    requireRole('professor'),
    (req: AuthenticatedRequest, res: Response) => {
      const submissionId = req.params.id;
      const { grade, feedback } = req.body ?? {};

      let found = false;
      updateLMSDatabase((lms) => {
        const target = lms.submissions.find((s) => s.id === submissionId);
        if (!target) return;
        found = true;
        const assignment = lms.assignments.find((a) => a.id === target.assignmentId);
        const maxPts = assignment?.maxPoints ?? 100;
        const clampedGrade = Math.min(Math.max(0, Math.round(Number(grade) || 0)), maxPts);
        const cleanFeedback = typeof feedback === 'string' ? feedback.trim() : '';

        lms.submissions = lms.submissions.map((s) =>
          s.id === submissionId
            ? {
                ...s,
                status: 'graded',
                grade: clampedGrade,
                feedback: cleanFeedback,
                gradedAt: new Date().toISOString(),
              }
            : s
        );

        lms.notifications = pushNotif(
          lms.notifications,
          'student',
          `Assignment Graded: ${assignment?.title ?? 'Assignment'}`,
          `Score: ${clampedGrade}/${maxPts} with feedback from ${req.authUser!.name}.`,
          'assignments',
          target.studentId
        );
      });

      if (!found) {
        res.status(404).json({ error: 'Submission not found.' });
        return;
      }
      res.json({ state: getScopedStateForUser(req.authUser!) });
    }
  );

  // Professor: Upload Note
  app.post(
    '/api/lms/notes',
    authenticate,
    requireRole('professor'),
    (req: AuthenticatedRequest, res: Response) => {
      const { courseId, title, moduleTag, attachmentName, resourceUrl, content } = req.body ?? {};
      if (
        typeof title !== 'string' ||
        !title.trim() ||
        typeof moduleTag !== 'string' ||
        !moduleTag.trim() ||
        typeof content !== 'string' ||
        !content.trim()
      ) {
        res.status(400).json({ error: 'Title, module tag, and lecture content are required.' });
        return;
      }

      const note: LectureNote = {
        id: uid('note'),
        courseId: typeof courseId === 'string' ? courseId : 'cs301',
        title: title.trim(),
        moduleTag: moduleTag.trim(),
        attachmentName:
          typeof attachmentName === 'string' && attachmentName.trim()
            ? attachmentName.trim()
            : undefined,
        resourceUrl: isSafeHttpUrl(resourceUrl) ? resourceUrl.trim() : undefined,
        content: content.trim(),
        bookmarked: false,
        updatedAt: new Date().toISOString(),
      };

      updateLMSDatabase((lms) => {
        lms.notes.unshift(note);
        const course = lms.courses.find((c) => c.id === note.courseId);
        lms.notifications = pushNotif(
          lms.notifications,
          'student',
          `New Study Note: ${note.title}`,
          `${course?.code ?? 'Course'} · ${note.moduleTag}`,
          'notes'
        );
      });

      res.status(201).json({ note, state: getScopedStateForUser(req.authUser!) });
    }
  );

  // Professor: Delete Note
  app.delete(
    '/api/lms/notes/:id',
    authenticate,
    requireRole('professor'),
    (req: AuthenticatedRequest, res: Response) => {
      const noteId = req.params.id;
      updateLMSDatabase((lms) => {
        lms.notes = lms.notes.filter((n) => n.id !== noteId);
      });
      res.json({ state: getScopedStateForUser(req.authUser!) });
    }
  );

  // Authenticated: Toggle Bookmark on Note (per user)
  app.patch(
    '/api/lms/notes/:id/bookmark',
    authenticate,
    (req: AuthenticatedRequest, res: Response) => {
      toggleUserBookmark(req.authUser!.id, req.params.id);
      res.json({ state: getScopedStateForUser(req.authUser!) });
    }
  );

  // Professor: Post Announcement
  app.post(
    '/api/lms/announcements',
    authenticate,
    requireRole('professor'),
    (req: AuthenticatedRequest, res: Response) => {
      const { courseId, title, message } = req.body ?? {};
      if (typeof title !== 'string' || !title.trim() || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'Announcement title and message are required.' });
        return;
      }
      const ann: Announcement = {
        id: uid('ann'),
        courseId: typeof courseId === 'string' ? courseId : 'cs301',
        title: title.trim(),
        message: message.trim(),
        authorName: req.authUser!.name,
        createdAt: new Date().toISOString(),
      };

      updateLMSDatabase((lms) => {
        lms.announcements.unshift(ann);
        const course = lms.courses.find((c) => c.id === ann.courseId);
        lms.notifications = pushNotif(
          lms.notifications,
          'student',
          `${course?.code ?? 'Course'} Announcement: ${ann.title}`,
          ann.message.slice(0, 90),
          'forum'
        );
      });

      res.status(201).json({ announcement: ann, state: getScopedStateForUser(req.authUser!) });
    }
  );

  // Student: Ask Doubt
  app.post(
    '/api/lms/doubts',
    authenticate,
    requireRole('student'),
    (req: AuthenticatedRequest, res: Response) => {
      const { courseId, referenceLabel, title, question } = req.body ?? {};
      if (typeof title !== 'string' || !title.trim() || typeof question !== 'string' || !question.trim()) {
        res.status(400).json({ error: 'Question summary and details are required.' });
        return;
      }

      const doubt: DoubtThread = {
        id: uid('doubt'),
        courseId: typeof courseId === 'string' ? courseId : 'cs301',
        studentName: req.authUser!.name,
        referenceLabel:
          typeof referenceLabel === 'string' && referenceLabel.trim()
            ? referenceLabel.trim()
            : undefined,
        title: title.trim(),
        question: question.trim(),
        replies: [],
        createdAt: new Date().toISOString(),
      };

      updateLMSDatabase((lms) => {
        lms.doubts.unshift(doubt);
        const course = lms.courses.find((c) => c.id === doubt.courseId);
        lms.notifications = pushNotif(
          lms.notifications,
          'professor',
          `New Doubt in ${course?.code ?? 'Course'}`,
          `${req.authUser!.name}: ${doubt.title}`,
          'forum'
        );
      });

      res.status(201).json({ doubt, state: getScopedStateForUser(req.authUser!) });
    }
  );

  // Authenticated: Reply to Doubt
  app.post(
    '/api/lms/doubts/:id/reply',
    authenticate,
    (req: AuthenticatedRequest, res: Response) => {
      const doubtId = req.params.id;
      const { message } = req.body ?? {};
      if (typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'Reply message is required.' });
        return;
      }

      const user = req.authUser!;
      let found = false;
      updateLMSDatabase((lms) => {
        lms.doubts = lms.doubts.map((d) => {
          if (d.id !== doubtId) return d;
          found = true;
          return {
            ...d,
            replies: [
              ...d.replies,
              {
                id: uid('rep'),
                authorName: user.name,
                authorRole: user.role,
                message: message.trim(),
                createdAt: new Date().toISOString(),
              },
            ],
          };
        });

        const target = lms.doubts.find((d) => d.id === doubtId);
        if (target) {
          if (user.role === 'professor') {
            lms.notifications = pushNotif(
              lms.notifications,
              'student',
              `${user.name} replied to a doubt`,
              target.title,
              'forum'
            );
          } else {
            lms.notifications = pushNotif(
              lms.notifications,
              'professor',
              `${user.name} replied in Q&A`,
              target.title,
              'forum'
            );
          }
        }
      });

      if (!found) {
        res.status(404).json({ error: 'Doubt thread not found.' });
        return;
      }
      res.json({ state: getScopedStateForUser(user) });
    }
  );

  // Notifications
  app.patch(
    '/api/lms/notifications/read-all',
    authenticate,
    (req: AuthenticatedRequest, res: Response) => {
      const user = req.authUser!;
      updateLMSDatabase((lms) => {
        lms.notifications = lms.notifications.map((n) =>
          n.targetRole === user.role && (!n.targetUserId || n.targetUserId === user.id)
            ? { ...n, read: true }
            : n
        );
      });
      res.json({ state: getScopedStateForUser(user) });
    }
  );

  app.patch(
    '/api/lms/notifications/:id/read',
    authenticate,
    (req: AuthenticatedRequest, res: Response) => {
      const user = req.authUser!;
      updateLMSDatabase((lms) => {
        lms.notifications = lms.notifications.map((n) =>
          n.id === req.params.id ? { ...n, read: true } : n
        );
      });
      res.json({ state: getScopedStateForUser(user) });
    }
  );

  // Reset Demo Data
  app.post(
    '/api/lms/reset',
    authenticate,
    (req: AuthenticatedRequest, res: Response) => {
      resetDemoLMSData();
      res.json({ state: getScopedStateForUser(req.authUser!) });
    }
  );

  // ---------------------------------------------------------------------------
  // Server-Side Gemini AI Routes
  // ---------------------------------------------------------------------------
  app.post(
    '/api/ai/generate-quiz',
    authenticate,
    requireRole('professor'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { topic, courseTitle, count } = req.body ?? {};
        if (typeof topic !== 'string' || topic.trim().length < 5) {
          res.status(400).json({
            error: 'Please provide at least a short topic or lecture excerpt (5+ characters).',
          });
          return;
        }
        if (topic.length > 20000) {
          res.status(400).json({
            error: 'Source text is too long. Please keep it under 20,000 characters.',
          });
          return;
        }

        const ai = getGeminiClient();
        if (!ai) {
          res.status(503).json({
            error: 'Gemini API key is not configured. Please check Settings > Secrets.',
          });
          return;
        }

        const questionCount = Math.min(Math.max(Number(count) || 5, 1), 10);
        const safeCourse =
          typeof courseTitle === 'string' && courseTitle.trim()
            ? courseTitle.trim().slice(0, 120)
            : 'Computer Science';

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Course: ${safeCourse}\n\nSource material or topic:\n${topic.trim()}\n\nGenerate ${questionCount} rigorous university-level multiple-choice questions testing conceptual understanding and problem solving based on this material. Each question must have exactly 4 distinct answer choices, a single correct option index (0 to 3), a clear 1-2 sentence explanation, and a point value (default 10).`,
          config: {
            systemInstruction:
              'You are an experienced computer science professor writing clear, unambiguous university exam questions. Return valid JSON matching the schema.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: {
                        type: Type.STRING,
                        description: 'The multiple-choice question prompt.',
                      },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: 'Exactly 4 distinct answer choices.',
                      },
                      correctIndex: {
                        type: Type.INTEGER,
                        description: '0-based index (0, 1, 2, or 3) of the correct option.',
                      },
                      points: {
                        type: Type.INTEGER,
                        description: 'Point value for the question, e.g. 10.',
                      },
                      explanation: {
                        type: Type.STRING,
                        description: 'Concise 1-2 sentence explanation of why the answer is correct.',
                      },
                    },
                    required: ['text', 'options', 'correctIndex', 'points', 'explanation'],
                  },
                },
              },
              required: ['questions'],
            },
          },
        });

        const raw = (response.text ?? '{}').trim();
        const parsed = JSON.parse(raw) as {
          questions?: Array<{
            text?: string;
            options?: string[];
            correctIndex?: number;
            points?: number;
            explanation?: string;
          }>;
        };

        const sanitized = (parsed.questions ?? [])
          .filter((q) => typeof q.text === 'string' && Array.isArray(q.options) && q.options.length >= 2)
          .map((q) => {
            const opts = (q.options ?? []).slice(0, 4).map((o) => String(o));
            while (opts.length < 4) opts.push(`Option ${opts.length + 1}`);
            const idx = Number.isInteger(q.correctIndex)
              ? Math.min(Math.max(Number(q.correctIndex), 0), 3)
              : 0;
            const pts = Number.isFinite(q.points) && Number(q.points) > 0 ? Math.round(Number(q.points)) : 10;
            return {
              text: String(q.text).trim(),
              options: opts,
              correctIndex: idx,
              points: pts,
              explanation: String(q.explanation ?? 'Review the course lecture notes for details.').trim(),
            };
          });

        if (sanitized.length === 0) {
          res.status(502).json({ error: 'Unable to generate structured questions. Please try refining your prompt.' });
          return;
        }

        res.json({ questions: sanitized });
      } catch (error) {
        console.error('AI quiz generation error:', error);
        const message =
          error instanceof Error ? error.message : 'Failed to generate quiz questions.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.post(
    '/api/ai/study-buddy',
    authenticate,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { noteTitle, noteContent, mode } = req.body ?? {};
        if (typeof noteContent !== 'string' || noteContent.trim().length < 20) {
          res.status(400).json({ error: 'Note content is required to run AI Study Buddy.' });
          return;
        }
        if (mode !== 'summary' && mode !== 'flashcards') {
          res.status(400).json({ error: 'Mode must be "summary" or "flashcards".' });
          return;
        }

        const ai = getGeminiClient();
        if (!ai) {
          res.status(503).json({
            error: 'Gemini API key is not configured. Please check Settings > Secrets.',
          });
          return;
        }

        const safeTitle =
          typeof noteTitle === 'string' && noteTitle.trim()
            ? noteTitle.trim().slice(0, 160)
            : 'Lecture Note';

        if (mode === 'summary') {
          const response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: `Lecture Note Title: ${safeTitle}\n\nContent:\n${noteContent.slice(0, 20000)}\n\nDistill this lecture note into exactly 5 crisp, high-yield study bullet points suitable for exam revision.`,
            config: {
              systemInstruction:
                'You are an academic tutor helping a computer science undergraduate revise lecture material clearly and accurately.',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  summaryPoints: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Exactly 5 concise, high-yield bullet point takeaways.',
                  },
                },
                required: ['summaryPoints'],
              },
            },
          });

          const parsed = JSON.parse((response.text ?? '{}').trim()) as { summaryPoints?: string[] };
          const points = (parsed.summaryPoints ?? []).map((p) => String(p).trim()).filter(Boolean).slice(0, 5);
          res.json({ summaryPoints: points });
          return;
        }

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Lecture Note Title: ${safeTitle}\n\nContent:\n${noteContent.slice(0, 20000)}\n\nCreate 5 high-impact active-recall practice flashcards (question/prompt on front, crisp answer on back) covering the core definitions, algorithms, or trade-offs in this note.`,
          config: {
            systemInstruction:
              'You are an academic tutor creating active-recall flashcards for university computer science students.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                flashcards: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      front: { type: Type.STRING, description: 'Question or concept prompt.' },
                      back: { type: Type.STRING, description: 'Concise accurate answer.' },
                    },
                    required: ['front', 'back'],
                  },
                },
              },
              required: ['flashcards'],
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '{}').trim()) as {
          flashcards?: Array<{ front?: string; back?: string }>;
        };
        const flashcards = (parsed.flashcards ?? [])
          .filter((f) => f.front && f.back)
          .map((f) => ({ front: String(f.front).trim(), back: String(f.back).trim() }))
          .slice(0, 6);
        res.json({ flashcards });
      } catch (error) {
        console.error('AI study buddy error:', error);
        const message =
          error instanceof Error ? error.message : 'Failed to generate study material.';
        res.status(500).json({ error: message });
      }
    }
  );

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EduPulse server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start EduPulse server:', err);
  process.exit(1);
});
