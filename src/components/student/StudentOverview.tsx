import React, { useMemo } from 'react';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Flame,
  GraduationCap,
  Megaphone,
} from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import { formatRelativeTime, formatShortDate, getDueCountdown } from '../../utils/helpers';

export function StudentOverview() {
  const { user, state, selectedCourseFilter, setSelectedCourseFilter, setActiveSection } =
    useLMS();

  const courseIds = useMemo(
    () =>
      new Set(
        selectedCourseFilter === 'all'
          ? state.courses.map((c) => c.id)
          : [selectedCourseFilter]
      ),
    [state.courses, selectedCourseFilter]
  );

  const courseById = useMemo(
    () => Object.fromEntries(state.courses.map((c) => [c.id, c])),
    [state.courses]
  );

  const myAttempts = useMemo(
    () => state.quizAttempts.filter((a) => a.studentId === user?.id),
    [state.quizAttempts, user?.id]
  );

  const mySubmissions = useMemo(
    () => state.submissions.filter((s) => s.studentId === user?.id),
    [state.submissions, user?.id]
  );

  const publishedQuizzes = useMemo(
    () => state.quizzes.filter((q) => q.status === 'published' && courseIds.has(q.courseId)),
    [state.quizzes, courseIds]
  );

  const courseAssignments = useMemo(
    () => state.assignments.filter((a) => courseIds.has(a.courseId)),
    [state.assignments, courseIds]
  );

  const completedQuizCount = useMemo(() => {
    const attemptQuizIds = new Set(myAttempts.map((a) => a.quizId));
    return publishedQuizzes.filter((q) => attemptQuizIds.has(q.id)).length;
  }, [publishedQuizzes, myAttempts]);

  const { avgPct, gpa } = useMemo(() => {
    const scores: number[] = [];
    for (const att of myAttempts) {
      const quiz = state.quizzes.find((q) => q.id === att.quizId);
      if (quiz && courseIds.has(quiz.courseId) && att.maxScore > 0) {
        scores.push((att.score / att.maxScore) * 100);
      }
    }
    for (const sub of mySubmissions) {
      const assign = state.assignments.find((a) => a.id === sub.assignmentId);
      if (
        assign &&
        courseIds.has(assign.courseId) &&
        sub.status === 'graded' &&
        typeof sub.grade === 'number' &&
        assign.maxPoints > 0
      ) {
        scores.push((sub.grade / assign.maxPoints) * 100);
      }
    }
    if (scores.length === 0) return { avgPct: 0, gpa: '—' };
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const rounded = Math.round(mean);
    const gpaVal = Math.min(4.0, Math.max(0, (mean / 100) * 4.0)).toFixed(2);
    return { avgPct: rounded, gpa: gpaVal };
  }, [myAttempts, mySubmissions, state.quizzes, state.assignments, courseIds]);

  const todoItems = useMemo(() => {
    const items: Array<{
      id: string;
      kind: 'quiz' | 'assignment';
      courseCode: string;
      title: string;
      dueDate: string;
      meta: string;
      section: 'quizzes' | 'assignments';
      actionLabel: string;
    }> = [];

    for (const q of publishedQuizzes) {
      const attempted = myAttempts.some((a) => a.quizId === q.id);
      if (!attempted) {
        const pts = q.questions.reduce((s, x) => s + x.points, 0);
        items.push({
          id: q.id,
          kind: 'quiz',
          courseCode: courseById[q.courseId]?.code ?? '',
          title: q.title,
          dueDate: q.dueDate,
          meta: `${q.timeLimitMinutes} min · ${pts} pts`,
          section: 'quizzes',
          actionLabel: 'Take Quiz',
        });
      }
    }

    for (const a of courseAssignments) {
      const submitted = mySubmissions.some((s) => s.assignmentId === a.id);
      if (!submitted) {
        items.push({
          id: a.id,
          kind: 'assignment',
          courseCode: courseById[a.courseId]?.code ?? '',
          title: a.title,
          dueDate: a.dueDate,
          meta: `${a.maxPoints} pts`,
          section: 'assignments',
          actionLabel: 'Submit Work',
        });
      }
    }

    return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [publishedQuizzes, courseAssignments, myAttempts, mySubmissions, courseById]);

  const recentAnnouncements = useMemo(
    () => state.announcements.filter((a) => courseIds.has(a.courseId)).slice(0, 3),
    [state.announcements, courseIds]
  );

  const bookmarkedNotes = useMemo(
    () => state.notes.filter((n) => n.bookmarked && courseIds.has(n.courseId)),
    [state.notes, courseIds]
  );

  const firstName = user?.name.split(' ')[0] ?? 'Student';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Fall 2026 · Track upcoming deadlines, quizzes, and feedback across your courses.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveSection('notes')}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap"
        >
          Open Study Hub
        </button>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Upcoming Deadlines</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <CalendarClock className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
            {todoItems.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {todoItems.length === 0 ? 'All tasks completed' : 'Pending quizzes & labs'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Completed Quizzes</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
            {completedQuizCount}/{publishedQuizzes.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Published quizzes finished</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Current Average</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <GraduationCap className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
            {avgPct > 0 ? `${avgPct}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            Estimated GPA: {gpa} / 4.00
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Study Streak</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
              <Flame className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
            {state.studyStreakDays} days
          </p>
          <p className="mt-1 text-xs text-slate-500">Consistent daily review</p>
        </div>
      </div>

      {/* Enrolled Course Cards with Progress */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {state.courses.map((course) => {
          const totalItems =
            state.quizzes.filter((q) => q.courseId === course.id && q.status === 'published')
              .length + state.assignments.filter((a) => a.courseId === course.id).length;
          const completedItems =
            myAttempts.filter((att) =>
              state.quizzes.some((q) => q.id === att.quizId && q.courseId === course.id)
            ).length +
            mySubmissions.filter((sub) =>
              state.assignments.some((a) => a.id === sub.assignmentId && a.courseId === course.id)
            ).length;
          const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
          const isSelected = selectedCourseFilter === course.id;

          return (
            <div
              key={course.id}
              className={`group overflow-hidden rounded-xl border bg-white transition-all ${
                isSelected ? 'border-teal-700 shadow-sm' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="relative h-32 w-full overflow-hidden bg-slate-100">
                {course.bannerUrl ? (
                  <img
                    src={course.bannerUrl}
                    alt={`${course.code} ${course.title}`}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-slate-100 text-slate-400">
                    <BookOpen className="h-8 w-8" />
                  </div>
                )}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/35 to-transparent"
                  aria-hidden="true"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 text-white">
                  <div>
                    <p className="font-mono text-xs font-semibold text-teal-200">
                      {course.code} · {course.instructor}
                    </p>
                    <h2 className="text-lg font-bold leading-snug">{course.title}</h2>
                  </div>
                  <span className="font-mono text-xs text-slate-200 tabular-nums">
                    {progressPct}% done
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 px-4 py-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-700 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 tabular-nums">
                    {completedItems} of {totalItems} assessments submitted
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedCourseFilter(isSelected ? 'all' : course.id)}
                    className="font-semibold text-teal-700 hover:text-teal-800"
                  >
                    {isSelected ? 'Show All' : `Focus ${course.code}`}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Split: To-Do Today Timeline + Announcements/Bookmarks */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">To-Do Today</h2>
              <p className="text-xs text-slate-500">
                Chronological action queue sorted by nearest deadline
              </p>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {todoItems.length} remaining
            </span>
          </div>

          {todoItems.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
              <p className="text-sm font-semibold text-slate-900">You&apos;re all caught up</p>
              <p className="text-xs text-slate-500">
                Review graded feedback in Assignments or practice with AI Study Buddy in Notes.
              </p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {todoItems.map((item) => {
                const countdown = getDueCountdown(item.dueDate);
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 py-4 first:pt-1 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-semibold text-slate-700">
                          {item.courseCode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-500">{item.meta}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold ${
                            countdown.urgency === 'overdue'
                              ? 'text-rose-700'
                              : countdown.urgency === 'soon'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {countdown.label} ({formatShortDate(item.dueDate)})
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection(item.section)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0 self-start sm:self-center"
                    >
                      <span>{item.actionLabel}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-teal-700" />
                <h2 className="text-base font-semibold text-slate-900">Latest Announcements</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('forum')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                View all
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {recentAnnouncements.map((ann) => (
                <div key={ann.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono font-semibold text-teal-700">
                      {courseById[ann.courseId]?.code}
                    </span>
                    <span>{formatRelativeTime(ann.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{ann.title}</p>
                  <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{ann.message}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-amber-600" />
                <h2 className="text-base font-semibold text-slate-900">Bookmarked Notes</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('notes')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                Study Hub
              </button>
            </div>
            {bookmarkedNotes.length === 0 ? (
              <p className="text-sm text-slate-500">
                Bookmark lecture notes in the Study Hub for quick exam revision.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {bookmarkedNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => setActiveSection('notes')}
                    className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-slate-50 rounded-md px-1 -mx-1"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{note.title}</p>
                      <p className="text-xs text-slate-500">
                        {courseById[note.courseId]?.code} · {note.moduleTag}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
