import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  User,
  UserCheck,
} from 'lucide-react';
import { useLMS } from '../context/LMSContext';
import { LOGIN_CAMPUS_IMAGE, PROFESSOR_AVATAR, STUDENT_AVATAR } from '../data/seedData';
import { UserRole } from '../types';

export function AuthGateway() {
  const { login, register } = useLMS();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('student');
  const [subtitle, setSubtitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoadingRole, setDemoLoadingRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({ name, email, password, role: regRole, subtitle });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (targetRole: UserRole) => {
    setError(null);
    setDemoLoadingRole(targetRole);
    try {
      if (targetRole === 'professor') {
        await login('elena.vance@edupulse.edu', 'Professor2026!');
      } else {
        await login('alex.rivera@edupulse.edu', 'Student2026!');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed.');
    } finally {
      setDemoLoadingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-12">
      {/* Left Visual Campus Panel */}
      <div className="relative hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-between overflow-hidden bg-slate-900 p-10 text-white">
        <img
          src={LOGIN_CAMPUS_IMAGE}
          alt="University library study hall"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/55 to-slate-900/40"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">EduPulse</span>
        </div>

        <div className="relative z-10 max-w-xl space-y-6">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-balance">
            One academic platform, tailored portals for faculty and students.
          </h1>
          <p className="text-base leading-relaxed text-slate-200">
            Sign in with your university credentials to access your dedicated workspace—author timed
            exams and grade submissions as faculty, or take assessments and study with AI notes as a
            student.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <UserCheck className="h-4 w-4 text-blue-300" />
                <span>Professor Portal</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-200">
                Build AI-assisted quizzes, review student code submissions, publish lecture notes,
                and track class analytics.
              </p>
            </div>

            <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <BookOpen className="h-4 w-4 text-emerald-300" />
                <span>Student Portal</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-200">
                Complete timed quizzes with instant feedback, submit lab projects, and revise notes
                with AI flashcards.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-300">
          <span>Fall 2026 Academic Term · Computer Science Department</span>
          <span className="font-mono">CS301 · CS302</span>
        </div>
      </div>

      {/* Right Authentication Form Panel */}
      <div className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:col-span-6 xl:col-span-5">
        <div className="mx-auto w-full max-w-md space-y-7">
          {/* Mobile Brand Header */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-display text-xl font-bold text-slate-900">EduPulse</span>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              {mode === 'login' ? 'Sign in to your portal' : 'Create your EduPulse account'}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              {mode === 'login'
                ? 'Your account automatically routes you to the Professor or Student dashboard.'
                : 'Register as a professor or student to access your dedicated workspace.'}
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`rounded-md py-2 text-xs font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`rounded-md py-2 text-xs font-semibold transition-all ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Account Role
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setRegRole('student')}
                      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                        regRole === 'student'
                          ? 'border-blue-600 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>Student</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegRole('professor')}
                      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                        regRole === 'professor'
                          ? 'border-blue-600 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <UserCheck className="h-4 w-4" />
                      <span>Professor</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={regRole === 'professor' ? 'Dr. Marcus Wright' : 'Samira Patel'}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {regRole === 'professor' ? 'Department' : 'Major / Year'} (optional)
                  </label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder={
                      regRole === 'professor'
                        ? 'Faculty · Computer Science'
                        : 'B.S. Computer Science · Junior'
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                University Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@edupulse.edu"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || demoLoadingRole !== null}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Direct Demo Portal Access Cards */}
          <div className="border-t border-slate-200 pt-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700">One-Click Portal Sign-In</span>
              <span>Shared persistent database</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleQuickDemo('professor')}
                disabled={loading || demoLoadingRole !== null}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-blue-300 hover:bg-blue-50/40 disabled:opacity-60"
              >
                <img
                  src={PROFESSOR_AVATAR}
                  alt="Dr. Elena Vance"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 shrink-0 rounded-full object-cover border border-slate-200"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-900">
                    {demoLoadingRole === 'professor' ? 'Signing in...' : 'Professor Login'}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">Dr. Elena Vance</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('student')}
                disabled={loading || demoLoadingRole !== null}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50/40 disabled:opacity-60"
              >
                <img
                  src={STUDENT_AVATAR}
                  alt="Alex Rivera"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 shrink-0 rounded-full object-cover border border-slate-200"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-900">
                    {demoLoadingRole === 'student' ? 'Signing in...' : 'Student Login'}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">Alex Rivera</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
