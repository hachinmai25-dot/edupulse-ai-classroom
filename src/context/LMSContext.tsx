import React, { createContext, useCallback, useContext, useState } from 'react';
import {
  AuthUser,
  LMSState,
  NavSection,
  Quiz,
  QuizAttempt,
  QuizQuestion,
  UserRole,
} from '../types';
import { createSeedState } from '../data/seedData';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  subtitle?: string;
}

interface LMSContextValue {
  user: AuthUser | null;
  token: string | null;
  role: UserRole;
  state: LMSState;
  stateLoading: boolean;
  activeSection: NavSection;
  setActiveSection: (section: NavSection) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCourseFilter: string;
  setSelectedCourseFilter: (courseId: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  refreshState: () => Promise<void>;
  createQuiz: (input: {
    courseId: string;
    title: string;
    description: string;
    timeLimitMinutes: number;
    dueDate: string;
    status: 'published' | 'draft';
    questions: QuizQuestion[];
  }) => Promise<Quiz>;
  toggleQuizStatus: (quizId: string) => Promise<void>;
  deleteQuiz: (quizId: string) => Promise<void>;
  submitQuizAttempt: (input: {
    quizId: string;
    answers: Record<string, number>;
    timeTakenSeconds: number;
  }) => Promise<{ attempt: QuizAttempt; quiz: Quiz }>;
  createAssignment: (input: {
    courseId: string;
    title: string;
    instructions: string;
    dueDate: string;
    maxPoints: number;
  }) => Promise<void>;
  submitAssignment: (input: {
    assignmentId: string;
    textAnswer: string;
    projectUrl?: string;
  }) => Promise<void>;
  gradeSubmission: (input: {
    submissionId: string;
    grade: number;
    feedback: string;
  }) => Promise<void>;
  createNote: (input: {
    courseId: string;
    title: string;
    moduleTag: string;
    attachmentName?: string;
    resourceUrl?: string;
    content: string;
  }) => Promise<void>;
  toggleBookmarkNote: (noteId: string) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  createAnnouncement: (input: { courseId: string; title: string; message: string }) => Promise<void>;
  createDoubt: (input: {
    courseId: string;
    referenceLabel?: string;
    title: string;
    question: string;
  }) => Promise<void>;
  replyToDoubt: (input: { doubtId: string; message: string }) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  resetDemoData: () => Promise<void>;
}

const LMSContext = createContext<LMSContextValue | null>(null);

export function LMSProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<LMSState>(() => createSeedState());
  const [stateLoading, setStateLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');

  const role: UserRole = user?.role ?? 'student';

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setActiveSection('overview');
    setSearchQuery('');
    setSelectedCourseFilter('all');
  }, []);

  const authRequest = useCallback(
    async <T,>(url: string, init: RequestInit = {}, overrideToken?: string): Promise<T> => {
      const activeToken = overrideToken ?? token;
      const headers = new Headers(init.headers);
      if (activeToken) {
        headers.set('Authorization', `Bearer ${activeToken}`);
      }
      if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const res = await fetch(url, { ...init, headers });
      const data = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (!res.ok) {
        if (res.status === 401 && activeToken) {
          logout();
        }
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      return data;
    },
    [token, logout]
  );

  const loadStateWithToken = useCallback(
    async (bearer: string) => {
      setStateLoading(true);
      try {
        const res = await authRequest<{ state: LMSState }>('/api/lms/state', {}, bearer);
        setState(res.state);
      } finally {
        setStateLoading(false);
      }
    },
    [authRequest]
  );

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as { token?: string; user?: AuthUser; error?: string };
    if (!res.ok || !data.token || !data.user) {
      throw new Error(data.error || 'Unable to sign in.');
    }
    setToken(data.token);
    setUser(data.user);
    setActiveSection('overview');
    setSelectedCourseFilter('all');
    setSearchQuery('');
    await loadStateWithToken(data.token);
  };

  const register = async (input: RegisterInput) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as { token?: string; user?: AuthUser; error?: string };
    if (!res.ok || !data.token || !data.user) {
      throw new Error(data.error || 'Unable to create account.');
    }
    setToken(data.token);
    setUser(data.user);
    setActiveSection('overview');
    setSelectedCourseFilter('all');
    setSearchQuery('');
    await loadStateWithToken(data.token);
  };

  const refreshState = async () => {
    if (!token) return;
    await loadStateWithToken(token);
  };

  const createQuiz = async (input: {
    courseId: string;
    title: string;
    description: string;
    timeLimitMinutes: number;
    dueDate: string;
    status: 'published' | 'draft';
    questions: QuizQuestion[];
  }): Promise<Quiz> => {
    const data = await authRequest<{ quiz: Quiz; state: LMSState }>('/api/lms/quizzes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setState(data.state);
    return data.quiz;
  };

  const toggleQuizStatus = async (quizId: string) => {
    const data = await authRequest<{ state: LMSState }>(`/api/lms/quizzes/${quizId}/toggle`, {
      method: 'PATCH',
    });
    setState(data.state);
  };

  const deleteQuiz = async (quizId: string) => {
    const data = await authRequest<{ state: LMSState }>(`/api/lms/quizzes/${quizId}`, {
      method: 'DELETE',
    });
    setState(data.state);
  };

  const submitQuizAttempt = async (input: {
    quizId: string;
    answers: Record<string, number>;
    timeTakenSeconds: number;
  }): Promise<{ attempt: QuizAttempt; quiz: Quiz }> => {
    const data = await authRequest<{ attempt: QuizAttempt; quiz: Quiz; state: LMSState }>(
      `/api/lms/quizzes/${input.quizId}/attempt`,
      {
        method: 'POST',
        body: JSON.stringify({
          answers: input.answers,
          timeTakenSeconds: input.timeTakenSeconds,
        }),
      }
    );
    setState(data.state);
    return { attempt: data.attempt, quiz: data.quiz };
  };

  const createAssignment = async (input: {
    courseId: string;
    title: string;
    instructions: string;
    dueDate: string;
    maxPoints: number;
  }) => {
    const data = await authRequest<{ state: LMSState }>('/api/lms/assignments', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setState(data.state);
  };

  const submitAssignment = async (input: {
    assignmentId: string;
    textAnswer: string;
    projectUrl?: string;
  }) => {
    const data = await authRequest<{ state: LMSState }>(
      `/api/lms/assignments/${input.assignmentId}/submit`,
      {
        method: 'POST',
        body: JSON.stringify({
          textAnswer: input.textAnswer,
          projectUrl: input.projectUrl,
        }),
      }
    );
    setState(data.state);
  };

  const gradeSubmission = async (input: {
    submissionId: string;
    grade: number;
    feedback: string;
  }) => {
    const data = await authRequest<{ state: LMSState }>(
      `/api/lms/submissions/${input.submissionId}/grade`,
      {
        method: 'POST',
        body: JSON.stringify({
          grade: input.grade,
          feedback: input.feedback,
        }),
      }
    );
    setState(data.state);
  };

  const createNote = async (input: {
    courseId: string;
    title: string;
    moduleTag: string;
    attachmentName?: string;
    resourceUrl?: string;
    content: string;
  }) => {
    const data = await authRequest<{ state: LMSState }>('/api/lms/notes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setState(data.state);
  };

  const toggleBookmarkNote = async (noteId: string) => {
    const data = await authRequest<{ state: LMSState }>(`/api/lms/notes/${noteId}/bookmark`, {
      method: 'PATCH',
    });
    setState(data.state);
  };

  const deleteNote = async (noteId: string) => {
    const data = await authRequest<{ state: LMSState }>(`/api/lms/notes/${noteId}`, {
      method: 'DELETE',
    });
    setState(data.state);
  };

  const createAnnouncement = async (input: {
    courseId: string;
    title: string;
    message: string;
  }) => {
    const data = await authRequest<{ state: LMSState }>('/api/lms/announcements', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setState(data.state);
  };

  const createDoubt = async (input: {
    courseId: string;
    referenceLabel?: string;
    title: string;
    question: string;
  }) => {
    const data = await authRequest<{ state: LMSState }>('/api/lms/doubts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setState(data.state);
  };

  const replyToDoubt = async (input: { doubtId: string; message: string }) => {
    const data = await authRequest<{ state: LMSState }>(
      `/api/lms/doubts/${input.doubtId}/reply`,
      {
        method: 'POST',
        body: JSON.stringify({ message: input.message }),
      }
    );
    setState(data.state);
  };

  const markNotificationRead = async (id: string) => {
    const data = await authRequest<{ state: LMSState }>(`/api/lms/notifications/${id}/read`, {
      method: 'PATCH',
    });
    setState(data.state);
  };

  const markAllNotificationsRead = async () => {
    const data = await authRequest<{ state: LMSState }>('/api/lms/notifications/read-all', {
      method: 'PATCH',
    });
    setState(data.state);
  };

  const resetDemoData = async () => {
    const data = await authRequest<{ state: LMSState }>('/api/lms/reset', {
      method: 'POST',
    });
    setState(data.state);
  };

  return (
    <LMSContext.Provider
      value={{
        user,
        token,
        role,
        state,
        stateLoading,
        activeSection,
        setActiveSection,
        searchQuery,
        setSearchQuery,
        selectedCourseFilter,
        setSelectedCourseFilter,
        login,
        register,
        logout,
        refreshState,
        createQuiz,
        toggleQuizStatus,
        deleteQuiz,
        submitQuizAttempt,
        createAssignment,
        submitAssignment,
        gradeSubmission,
        createNote,
        toggleBookmarkNote,
        deleteNote,
        createAnnouncement,
        createDoubt,
        replyToDoubt,
        markNotificationRead,
        markAllNotificationsRead,
        resetDemoData,
      }}
    >
      {children}
    </LMSContext.Provider>
  );
}

export function useLMS(): LMSContextValue {
  const ctx = useContext(LMSContext);
  if (!ctx) {
    throw new Error('useLMS must be used inside LMSProvider');
  }
  return ctx;
}
