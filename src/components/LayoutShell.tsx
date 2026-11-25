import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  CheckCheck,
  ClipboardCheck,
  FileText,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  RotateCcw,
  Search,
  Settings,
  UserCheck,
  X,
} from 'lucide-react';
import { useLMS } from '../context/LMSContext';
import { NavSection } from '../types';
import { PROFESSOR_AVATAR, STUDENT_AVATAR } from '../data/seedData';
import { formatRelativeTime } from '../utils/helpers';
import { Modal } from './Modal';

interface SearchHit {
  id: string;
  label: string;
  meta: string;
  section: NavSection;
}

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const {
    user,
    state,
    role,
    logout,
    activeSection,
    setActiveSection,
    searchQuery,
    setSearchQuery,
    selectedCourseFilter,
    setSelectedCourseFilter,
    markNotificationRead,
    markAllNotificationsRead,
    resetDemoData,
  } = useLMS();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roleNotifications = useMemo(
    () => state.notifications.filter((n) => n.targetRole === role),
    [state.notifications, role]
  );

  const unreadCount = useMemo(
    () => roleNotifications.filter((n) => !n.read).length,
    [roleNotifications]
  );

  const navItems: Array<{
    id: NavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'quizzes', label: 'Quizzes', icon: HelpCircle },
    { id: 'assignments', label: 'Assignments', icon: ClipboardCheck },
    { id: 'notes', label: 'Lecture Notes', icon: FileText },
    { id: 'forum', label: 'Doubts & Announcements', icon: MessageSquare },
    {
      id: 'analytics',
      label: role === 'professor' ? 'Analytics' : 'Grades',
      icon: BarChart3,
    },
  ];

  const searchResults = useMemo<SearchHit[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const hits: SearchHit[] = [];
    const courseById = Object.fromEntries(state.courses.map((c) => [c.id, c]));

    for (const quiz of state.quizzes) {
      if (role === 'student' && quiz.status !== 'published') continue;
      if (
        quiz.title.toLowerCase().includes(q) ||
        quiz.description.toLowerCase().includes(q) ||
        courseById[quiz.courseId]?.code.toLowerCase().includes(q)
      ) {
        hits.push({
          id: quiz.id,
          label: quiz.title,
          meta: `Quiz · ${courseById[quiz.courseId]?.code ?? ''}`,
          section: 'quizzes',
        });
      }
    }

    for (const assign of state.assignments) {
      if (
        assign.title.toLowerCase().includes(q) ||
        assign.instructions.toLowerCase().includes(q) ||
        courseById[assign.courseId]?.code.toLowerCase().includes(q)
      ) {
        hits.push({
          id: assign.id,
          label: assign.title,
          meta: `Assignment · ${courseById[assign.courseId]?.code ?? ''}`,
          section: 'assignments',
        });
      }
    }

    for (const note of state.notes) {
      if (
        note.title.toLowerCase().includes(q) ||
        note.moduleTag.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q)
      ) {
        hits.push({
          id: note.id,
          label: note.title,
          meta: `Lecture Note · ${courseById[note.courseId]?.code ?? ''}`,
          section: 'notes',
        });
      }
    }

    for (const ann of state.announcements) {
      if (ann.title.toLowerCase().includes(q) || ann.message.toLowerCase().includes(q)) {
        hits.push({
          id: ann.id,
          label: ann.title,
          meta: `Announcement · ${courseById[ann.courseId]?.code ?? ''}`,
          section: 'forum',
        });
      }
    }

    for (const d of state.doubts) {
      if (d.title.toLowerCase().includes(q) || d.question.toLowerCase().includes(q)) {
        hits.push({
          id: d.id,
          label: d.title,
          meta: `Q&A Doubt · ${courseById[d.courseId]?.code ?? ''}`,
          section: 'forum',
        });
      }
    }

    return hits.slice(0, 8);
  }, [searchQuery, state, role]);

  const handleSelectNav = (id: NavSection) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
  };

  const handleResetDemo = async () => {
    await resetDemoData();
    setResetConfirmed(true);
    setTimeout(() => {
      setResetConfirmed(false);
      setSettingsOpen(false);
    }, 900);
  };

  const avatarSrc = user?.avatarUrl || (role === 'professor' ? PROFESSOR_AVATAR : STUDENT_AVATAR);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          {/* Left: Mobile Menu + Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('overview')}
              className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-white ${
                  role === 'professor' ? 'bg-blue-700' : 'bg-teal-700'
                }`}
              >
                <GraduationCap className="h-5 w-5" />
              </span>
              <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
                EduPulse
              </span>
            </button>
          </div>

          {/* Center: Live Search Bar */}
          <div ref={searchRef} className="relative hidden md:block flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchFocused(true);
              }}
              placeholder="Search quizzes, assignments, notes, Q&A..."
              aria-label="Search course materials"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/15"
            />
            {searchFocused && searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500">
                    No matching items for "{searchQuery}"
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {searchResults.map((hit) => (
                      <li key={hit.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSection(hit.section);
                            setSearchFocused(false);
                          }}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                        >
                          <span className="truncate text-sm font-medium text-slate-900">
                            {hit.label}
                          </span>
                          <span className="shrink-0 text-xs text-slate-500">{hit.meta}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Right: Logged-in Role Identity + Notifications + Sign Out */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
              {role === 'professor' ? (
                <UserCheck className="h-3.5 w-3.5 text-blue-700" />
              ) : (
                <BookOpen className="h-3.5 w-3.5 text-teal-700" />
              )}
              <span>{role === 'professor' ? 'Professor Portal' : 'Student Portal'}</span>
            </div>

            {/* Notification Bell */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label={`Notifications (${unreadCount} unread)`}
                className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <Bell className="h-4.5 w-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-700 px-1 font-mono text-[11px] font-semibold text-white tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 z-40 w-80 sm:w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <span className="text-sm font-semibold text-slate-900">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => void markAllNotificationsRead()}
                        className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {roleNotifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        You are all caught up.
                      </div>
                    ) : (
                      roleNotifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            void markNotificationRead(n.id);
                            setActiveSection(n.section);
                            setNotifOpen(false);
                          }}
                          className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                            !n.read ? 'bg-blue-50/40' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-900 line-clamp-1">
                              {n.title}
                            </span>
                            {!n.read && (
                              <span className="shrink-0 text-[11px] font-semibold text-blue-700">
                                New
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-2">{n.detail}</p>
                          <span className="text-[11px] text-slate-400">
                            {formatRelativeTime(n.createdAt)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="border-t border-slate-100 px-4 py-2 md:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quizzes, notes, assignments..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-20 w-64 border-r border-slate-200 bg-white pt-20 lg:pt-0 lg:static lg:flex lg:flex-col lg:justify-between transition-transform duration-200 ${
            mobileMenuOpen
              ? 'translate-x-0 flex flex-col justify-between'
              : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
            <div>
              <p className="px-3 mb-2 text-xs font-medium text-slate-400">
                {role === 'professor' ? 'Instructor Navigation' : 'Student Navigation'}
              </p>
              <nav className="space-y-1" aria-label="Workspace navigation">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectNav(item.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                        active
                          ? role === 'professor'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-teal-50 text-teal-800'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon
                        className={`h-4.5 w-4.5 shrink-0 ${
                          active
                            ? role === 'professor'
                              ? 'text-blue-700'
                              : 'text-teal-700'
                            : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Course Filter */}
            <div>
              <p className="px-3 mb-2 text-xs font-medium text-slate-400">Courses</p>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setSelectedCourseFilter('all')}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                    selectedCourseFilter === 'all'
                      ? 'bg-slate-100 font-semibold text-slate-900'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="truncate">All Courses</span>
                  <span className="font-mono text-xs text-slate-400 tabular-nums">
                    {state.courses.length}
                  </span>
                </button>
                {state.courses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => setSelectedCourseFilter(course.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      selectedCourseFilter === course.id
                        ? 'bg-slate-100 font-semibold text-slate-900'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="truncate">
                      <span className="font-mono text-xs font-semibold text-slate-500 mr-1.5">
                        {course.code}
                      </span>
                      {course.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Authenticated Profile & Settings Footer */}
          <div className="border-t border-slate-200 p-3 space-y-2">
            <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                <img
                  src={avatarSrc}
                  alt={user?.name ?? 'User'}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
                <p className="truncate text-xs text-slate-500">{user?.subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Settings className="h-4 w-4 text-slate-400" />
              <span>Settings &amp; Demo Data</span>
            </button>
          </div>
        </aside>

        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-10 bg-slate-900/30 lg:hidden"
          />
        )}

        {/* Main Viewport */}
        <main className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-7">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Settings & Reset Demo Data Modal */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Account & Workspace Settings"
        subtitle={`Signed in as ${user?.email}`}
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">Server-Side Persistence</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your account session is verified on the server, and all quizzes, submissions, grades,
              lecture notes, and Q&amp;A threads persist on the backend across both Professor and
              Student logins.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Reset Demo Courses &amp; Work</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Restore default CS301 &amp; CS302 quizzes, assignments, notes, and announcements.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleResetDemo()}
              className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-4 w-4" />
              <span>{resetConfirmed ? 'Reset Complete' : 'Reset Demo Data'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
