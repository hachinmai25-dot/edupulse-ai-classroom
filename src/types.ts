export type UserRole = 'professor' | 'student';

export type NavSection =
  | 'overview'
  | 'quizzes'
  | 'assignments'
  | 'notes'
  | 'forum'
  | 'analytics';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  subtitle: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  term: string;
  instructor: string;
  enrolledCount: number;
  accentHex: string;
  bannerUrl?: string;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex?: number;
  points: number;
  explanation?: string;
}

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  description: string;
  timeLimitMinutes: number;
  dueDate: string; // ISO date YYYY-MM-DD
  status: 'published' | 'draft';
  questions: QuizQuestion[];
  createdAt: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  studentName: string;
  answers: Record<string, number>;
  score: number;
  maxScore: number;
  timeTakenSeconds: number;
  submittedAt: string;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  dueDate: string; // ISO date YYYY-MM-DD
  maxPoints: number;
  createdAt: string;
}

export type SubmissionStatus = 'submitted' | 'graded';

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  textAnswer: string;
  projectUrl?: string;
  status: SubmissionStatus;
  grade?: number;
  feedback?: string;
  submittedAt: string;
  gradedAt?: string;
}

export interface LectureNote {
  id: string;
  courseId: string;
  title: string;
  moduleTag: string;
  attachmentName?: string;
  resourceUrl?: string;
  content: string;
  bookmarked: boolean;
  updatedAt: string;
}

export interface Announcement {
  id: string;
  courseId: string;
  title: string;
  message: string;
  authorName: string;
  createdAt: string;
}

export interface DoubtReply {
  id: string;
  authorName: string;
  authorRole: UserRole;
  message: string;
  createdAt: string;
}

export interface DoubtThread {
  id: string;
  courseId: string;
  studentName: string;
  referenceLabel?: string;
  title: string;
  question: string;
  replies: DoubtReply[];
  createdAt: string;
}

export interface AppNotification {
  id: string;
  targetRole: UserRole;
  targetUserId?: string;
  title: string;
  detail: string;
  section: NavSection;
  read: boolean;
  createdAt: string;
}

export interface LMSState {
  courses: Course[];
  quizzes: Quiz[];
  quizAttempts: QuizAttempt[];
  assignments: Assignment[];
  submissions: AssignmentSubmission[];
  notes: LectureNote[];
  announcements: Announcement[];
  doubts: DoubtThread[];
  notifications: AppNotification[];
  studyStreakDays: number;
}
