import fs from 'fs';
import path from 'path';
import {
  createSeedState,
  PROFESSOR_AVATAR,
  PROFESSOR_NAME,
  STUDENT_AVATAR,
} from '../src/data/seedData';
import type { AuthUser, LMSState } from '../src/types';
import { hashPassword } from './auth';

export interface StoredUser extends AuthUser {
  passwordHash: string;
  createdAt: string;
}

interface DatabaseSchema {
  users: StoredUser[];
  lms: LMSState;
  bookmarksByUser: Record<string, string[]>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'edupulse-db.json');

function createInitialUsers(): StoredUser[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'prof-elena',
      name: PROFESSOR_NAME,
      email: 'elena.vance@edupulse.edu',
      role: 'professor',
      avatarUrl: PROFESSOR_AVATAR,
      subtitle: 'Faculty · Computer Science',
      passwordHash: hashPassword('Professor2026!'),
      createdAt: now,
    },
    {
      id: 'stu-alex',
      name: 'Alex Rivera',
      email: 'alex.rivera@edupulse.edu',
      role: 'student',
      avatarUrl: STUDENT_AVATAR,
      subtitle: 'B.S. Computer Science · Junior',
      passwordHash: hashPassword('Student2026!'),
      createdAt: now,
    },
    {
      id: 'stu-maya',
      name: 'Maya Lin',
      email: 'maya.lin@edupulse.edu',
      role: 'student',
      avatarUrl: STUDENT_AVATAR,
      subtitle: 'B.S. Computer Science · Senior',
      passwordHash: hashPassword('Student2026!'),
      createdAt: now,
    },
  ];
}

function createInitialDatabase(): DatabaseSchema {
  const lms = createSeedState();
  const initialBookmarks = lms.notes.filter((n) => n.bookmarked).map((n) => n.id);
  return {
    users: createInitialUsers(),
    lms,
    bookmarksByUser: {
      'stu-alex': initialBookmarks,
      'stu-maya': ['note-1'],
    },
  };
}

let cachedDb: DatabaseSchema | null = null;

function ensureLoaded(): DatabaseSchema {
  if (cachedDb) return cachedDb;
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
      if (Array.isArray(parsed.users) && parsed.lms) {
        cachedDb = {
          users: parsed.users,
          lms: parsed.lms,
          bookmarksByUser: parsed.bookmarksByUser ?? {},
        };
        return cachedDb;
      }
    }
  } catch (err) {
    console.error('Failed to read database file, re-seeding:', err);
  }
  const initial = createInitialDatabase();
  saveDatabase(initial);
  return initial;
}

function saveDatabase(db: DatabaseSchema): void {
  cachedDb = db;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

export function toPublicUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    subtitle: user.subtitle,
  };
}

export function findUserByEmail(email: string): StoredUser | undefined {
  const db = ensureLoaded();
  const normalized = email.trim().toLowerCase();
  return db.users.find((u) => u.email.toLowerCase() === normalized);
}

export function findUserById(id: string): StoredUser | undefined {
  const db = ensureLoaded();
  return db.users.find((u) => u.id === id);
}

export function createUser(user: StoredUser): AuthUser {
  const db = ensureLoaded();
  db.users.push(user);
  if (user.role === 'student') {
    db.bookmarksByUser[user.id] = ['note-1'];
  }
  saveDatabase(db);
  return toPublicUser(user);
}

export function getLMSDatabase(): LMSState {
  return ensureLoaded().lms;
}

export function updateLMSDatabase(updater: (lms: LMSState, db: DatabaseSchema) => void): LMSState {
  const db = ensureLoaded();
  updater(db.lms, db);
  saveDatabase(db);
  return db.lms;
}

export function getScopedStateForUser(user: AuthUser): LMSState {
  const db = ensureLoaded();
  const raw = db.lms;
  const userBookmarks = new Set(db.bookmarksByUser[user.id] ?? []);

  if (user.role === 'professor') {
    return {
      ...raw,
      notifications: raw.notifications.filter((n) => n.targetRole === 'professor'),
    };
  }

  // Student view: hide draft quizzes, strip answer keys from unattempted quizzes,
  // scope submissions & attempts cleanly, and apply user's personal bookmarks
  const studentAttempts = raw.quizAttempts.filter((a) => a.studentId === user.id);
  const attemptedQuizIds = new Set(studentAttempts.map((a) => a.quizId));

  const studentQuizzes = raw.quizzes
    .filter((q) => q.status === 'published')
    .map((q) => {
      const hasAttempted = attemptedQuizIds.has(q.id);
      if (hasAttempted) return q;
      return {
        ...q,
        questions: q.questions.map((question) => ({
          id: question.id,
          text: question.text,
          options: question.options,
          points: question.points,
        })),
      };
    });

  const studentSubmissions = raw.submissions.filter((s) => s.studentId === user.id);

  const studentNotes = raw.notes.map((n) => ({
    ...n,
    bookmarked: userBookmarks.has(n.id),
  }));

  const studentNotifications = raw.notifications.filter(
    (n) => n.targetRole === 'student' && (!n.targetUserId || n.targetUserId === user.id)
  );

  return {
    ...raw,
    quizzes: studentQuizzes,
    quizAttempts: studentAttempts,
    submissions: studentSubmissions,
    notes: studentNotes,
    notifications: studentNotifications,
  };
}

export function toggleUserBookmark(userId: string, noteId: string): boolean {
  const db = ensureLoaded();
  const current = new Set(db.bookmarksByUser[userId] ?? []);
  let bookmarked = false;
  if (current.has(noteId)) {
    current.delete(noteId);
    bookmarked = false;
  } else {
    current.add(noteId);
    bookmarked = true;
  }
  db.bookmarksByUser[userId] = Array.from(current);
  saveDatabase(db);
  return bookmarked;
}

export function resetDemoLMSData(): LMSState {
  const db = ensureLoaded();
  const fresh = createSeedState();
  db.lms = fresh;
  db.bookmarksByUser['stu-alex'] = fresh.notes.filter((n) => n.bookmarked).map((n) => n.id);
  saveDatabase(db);
  return db.lms;
}
