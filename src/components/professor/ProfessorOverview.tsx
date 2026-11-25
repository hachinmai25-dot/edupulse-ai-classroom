import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  HelpCircle,
  MessageSquare,
  Users,
} from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import { formatRelativeTime, formatShortDate } from '../../utils/helpers';

export function ProfessorOverview() {
  const { user, state, selectedCourseFilter, setSelectedCourseFilter, setActiveSection } =
    useLMS();

  const filteredCourses = useMemo(
    () =>
      selectedCourseFilter === 'all'
        ? state.courses
        : state.courses.filter((c) => c.id === selectedCourseFilter),
    [state.courses, selectedCourseFilter]
  );

  const courseIds = useMemo(() => new Set(filteredCourses.map((c) => c.id)), [filteredCourses]);
  const courseById = useMemo(
    () => Object.fromEntries(state.courses.map((c) => [c.id, c])),
    [state.courses]
  );

  const filteredQuizzes = useMemo(
    () => state.quizzes.filter((q) => courseIds.has(q.courseId)),
    [state.quizzes, courseIds]
  );

  const filteredAssignments = useMemo(
    () => state.assignments.filter((a) => courseIds.has(a.courseId)),
    [state.assignments, courseIds]
  );

  const totalStudents = useMemo(
    () => filteredCourses.reduce((acc, c) => acc + c.enrolledCount, 0),
    [filteredCourses]
  );

  const activeQuizzesCount = useMemo(
    () => filteredQuizzes.filter((q) => q.status === 'published').length,
    [filteredQuizzes]
  );

  const pendingSubmissions = useMemo(() => {
    const assignSet = new Set(filteredAssignments.map((a) => a.id));
    return state.submissions.filter(
      (s) => assignSet.has(s.assignmentId) && s.status === 'submitted'
    );
  }, [state.submissions, filteredAssignments]);

  const { classAveragePct, chartData } = useMemo(() => {
    const bars: Array<{ name: string; fullTitle: string; average: number; type: string }> = [];
    const percentages: number[] = [];

    for (const quiz of filteredQuizzes) {
      const attempts = state.quizAttempts.filter((a) => a.quizId === quiz.id);
      if (attempts.length > 0) {
        const avg =
          attempts.reduce((sum, a) => sum + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0), 0) /
          attempts.length;
        const rounded = Math.round(avg);
        percentages.push(rounded);
        bars.push({
          name: `${courseById[quiz.courseId]?.code ?? ''} Q: ${quiz.title.slice(0, 14)}${
            quiz.title.length > 14 ? '…' : ''
          }`,
          fullTitle: quiz.title,
          average: rounded,
          type: 'Quiz',
        });
      } else {
        bars.push({
          name: `${courseById[quiz.courseId]?.code ?? ''} Q: ${quiz.title.slice(0, 14)}${
            quiz.title.length > 14 ? '…' : ''
          }`,
          fullTitle: quiz.title,
          average: 0,
          type: 'Quiz (No attempts)',
        });
      }
    }

    for (const assign of filteredAssignments) {
      const graded = state.submissions.filter(
        (s) => s.assignmentId === assign.id && s.status === 'graded' && typeof s.grade === 'number'
      );
      if (graded.length > 0) {
        const avg =
          graded.reduce(
            (sum, s) => sum + (assign.maxPoints > 0 ? ((s.grade ?? 0) / assign.maxPoints) * 100 : 0),
            0
          ) / graded.length;
        const rounded = Math.round(avg);
        percentages.push(rounded);
        bars.push({
          name: `${courseById[assign.courseId]?.code ?? ''} A: ${assign.title.slice(0, 14)}${
            assign.title.length > 14 ? '…' : ''
          }`,
          fullTitle: assign.title,
          average: rounded,
          type: 'Assignment',
        });
      } else {
        bars.push({
          name: `${courseById[assign.courseId]?.code ?? ''} A: ${assign.title.slice(0, 14)}${
            assign.title.length > 14 ? '…' : ''
          }`,
          fullTitle: assign.title,
          average: 0,
          type: 'Assignment (Pending)',
        });
      }
    }

    const overall =
      percentages.length > 0
        ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
        : 0;

    return { classAveragePct: overall, chartData: bars };
  }, [filteredQuizzes, filteredAssignments, state.quizAttempts, state.submissions, courseById]);

  const unansweredDoubts = useMemo(
    () => state.doubts.filter((d) => courseIds.has(d.courseId) && d.replies.length === 0),
    [state.doubts, courseIds]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Instructor Overview · {user?.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Fall 2026 · {filteredCourses.map((c) => `${c.code}: ${c.title}`).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setActiveSection('quizzes')}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
          >
            Manage Quizzes
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('assignments')}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap"
          >
            Grade Submissions ({pendingSubmissions.length})
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total Students</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
            {totalStudents}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Across {filteredCourses.length} active{' '}
            {filteredCourses.length === 1 ? 'course' : 'courses'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Active Quizzes</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
              <HelpCircle className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
            {activeQuizzesCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {filteredQuizzes.length - activeQuizzesCount} saved as draft
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Pending to Grade</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <ClipboardCheck className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
            {pendingSubmissions.length}
          </p>
          <p className="mt-1 text-xs text-amber-700 font-medium">
            {pendingSubmissions.length > 0 ? 'Awaiting rubric review' : 'All submissions graded'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Class Average</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold text-slate-900 tabular-nums">
            {classAveragePct}%
          </p>
          <p className="mt-1 text-xs text-slate-500">Combined quizzes &amp; graded labs</p>
        </div>
      </div>

      {/* Course Showcase Strip */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {state.courses.map((course) => {
          const courseQuizzes = state.quizzes.filter(
            (q) => q.courseId === course.id && q.status === 'published'
          ).length;
          const courseNotes = state.notes.filter((n) => n.courseId === course.id).length;
          const isSelected = selectedCourseFilter === course.id;

          return (
            <div
              key={course.id}
              className={`group overflow-hidden rounded-xl border bg-white transition-all ${
                isSelected ? 'border-blue-600 shadow-sm' : 'border-slate-200 hover:border-slate-300'
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
                    <p className="font-mono text-xs font-semibold text-blue-200">
                      {course.code} · {course.term}
                    </p>
                    <h2 className="text-lg font-bold leading-snug">{course.title}</h2>
                  </div>
                  <span className="font-mono text-xs text-slate-200 tabular-nums">
                    {course.enrolledCount} students
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
                <span className="text-slate-600 tabular-nums">
                  {courseQuizzes} active quizzes · {courseNotes} lecture notes
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCourseFilter(isSelected ? 'all' : course.id)
                  }
                  className="font-semibold text-blue-700 hover:text-blue-800"
                >
                  {isSelected ? 'Show All Courses' : `Filter ${course.code}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bar Chart + Action Queues */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Assessment Performance Breakdown
              </h2>
              <p className="text-xs text-slate-500">
                Average percentage score across published quizzes and graded assignments
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No assessments available for the selected course.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 16, left: -12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: '#64748B', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    unit="%"
                  />
                  <Tooltip
                    cursor={{ fill: '#F1F5F9' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload as {
                        fullTitle: string;
                        average: number;
                        type: string;
                      };
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
                          <p className="text-xs font-semibold text-slate-900">{item.fullTitle}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{item.type}</p>
                          <p className="mt-1 font-mono text-sm font-semibold text-blue-700 tabular-nums">
                            Average: {item.average}%
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="average" fill="#1D4ED8" radius={[6, 6, 0, 0]} maxBarSize={52} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Grading & Doubt Queue */}
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Grading Queue</h2>
              <button
                type="button"
                onClick={() => setActiveSection('assignments')}
                className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                <span>Open Grader</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {pendingSubmissions.length === 0 ? (
                <p className="py-4 text-sm text-slate-500">No submissions waiting for review.</p>
              ) : (
                pendingSubmissions.slice(0, 4).map((sub) => {
                  const assign = state.assignments.find((a) => a.id === sub.assignmentId);
                  const course = assign ? courseById[assign.courseId] : undefined;
                  return (
                    <div key={sub.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-sm font-medium text-slate-900">{sub.studentName}</p>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        {course?.code} · {assign?.title}
                      </p>
                      <p className="mt-1 text-[11px] text-amber-700 font-medium">
                        Submitted {formatRelativeTime(sub.submittedAt)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Student Doubts</h2>
              <button
                type="button"
                onClick={() => setActiveSection('forum')}
                className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                <span>Answer Q&amp;A</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {unansweredDoubts.length === 0 ? (
                <p className="py-4 text-sm text-slate-500">All student doubts have been answered.</p>
              ) : (
                unansweredDoubts.slice(0, 3).map((d) => (
                  <div key={d.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <MessageSquare className="h-3.5 w-3.5 text-blue-700" />
                      <span>{courseById[d.courseId]?.code}</span>
                      <span>·</span>
                      <span>{d.studentName}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-900 line-clamp-2">{d.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Asked {formatShortDate(d.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
