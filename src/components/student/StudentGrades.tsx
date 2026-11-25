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
import { useLMS } from '../../context/LMSContext';
import { formatShortDate } from '../../utils/helpers';

export function StudentGrades() {
  const { user, state, selectedCourseFilter } = useLMS();

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

  const gradeRows = useMemo(() => {
    const rows: Array<{
      id: string;
      courseCode: string;
      title: string;
      category: 'Quiz' | 'Assignment';
      status: string;
      scoreText: string;
      percentage: number | null;
      dateText: string;
    }> = [];

    for (const quiz of state.quizzes) {
      if (quiz.status !== 'published' || !courseIds.has(quiz.courseId)) continue;
      const att = state.quizAttempts.find(
        (a) => a.quizId === quiz.id && a.studentId === user?.id
      );
      const maxPts = quiz.questions.reduce((s, q) => s + q.points, 0);
      const pct = att && att.maxScore > 0 ? Math.round((att.score / att.maxScore) * 100) : null;
      rows.push({
        id: quiz.id,
        courseCode: courseById[quiz.courseId]?.code ?? '',
        title: quiz.title,
        category: 'Quiz',
        status: att ? 'Completed' : 'Pending',
        scoreText: att ? `${att.score}/${att.maxScore}` : `—/${maxPts}`,
        percentage: pct,
        dateText: att ? formatShortDate(att.submittedAt) : `Due ${formatShortDate(quiz.dueDate)}`,
      });
    }

    for (const assign of state.assignments) {
      if (!courseIds.has(assign.courseId)) continue;
      const sub = state.submissions.find(
        (s) => s.assignmentId === assign.id && s.studentId === user?.id
      );
      const pct =
        sub && sub.status === 'graded' && typeof sub.grade === 'number' && assign.maxPoints > 0
          ? Math.round((sub.grade / assign.maxPoints) * 100)
          : null;
      rows.push({
        id: assign.id,
        courseCode: courseById[assign.courseId]?.code ?? '',
        title: assign.title,
        category: 'Assignment',
        status: sub
          ? sub.status === 'graded'
            ? 'Graded'
            : 'Awaiting Grade'
          : 'Not Submitted',
        scoreText:
          sub?.status === 'graded' && typeof sub.grade === 'number'
            ? `${sub.grade}/${assign.maxPoints}`
            : `—/${assign.maxPoints}`,
        percentage: pct,
        dateText: sub
          ? formatShortDate(sub.gradedAt ?? sub.submittedAt)
          : `Due ${formatShortDate(assign.dueDate)}`,
      });
    }

    return rows;
  }, [state, courseIds, courseById, user?.id]);

  const gradedOnly = useMemo(() => gradeRows.filter((r) => r.percentage !== null), [gradeRows]);

  const overallAverage = useMemo(() => {
    if (gradedOnly.length === 0) return 0;
    return Math.round(
      gradedOnly.reduce((s, r) => s + (r.percentage ?? 0), 0) / gradedOnly.length
    );
  }, [gradedOnly]);

  const chartData = useMemo(
    () =>
      gradedOnly.map((r) => ({
        name: `${r.courseCode} ${r.title.slice(0, 16)}${r.title.length > 16 ? '…' : ''}`,
        fullTitle: r.title,
        score: r.percentage ?? 0,
      })),
    [gradedOnly]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Grades &amp; Transcript
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your live scores across published quizzes and evaluated lab assignments.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-right">
          <p className="text-xs text-slate-500">Overall Weighted Average</p>
          <p className="font-mono text-2xl font-bold text-teal-700 tabular-nums">
            {gradedOnly.length > 0 ? `${overallAverage}%` : '—'}
          </p>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">Completed Assessment Scores</h2>
          <p className="text-xs text-slate-500 mb-5">Percentage earned per graded item</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#475569', fontSize: 12 }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#F1F5F9' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0].payload as { fullTitle: string; score: number };
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
                        <p className="text-xs font-semibold text-slate-900">{item.fullTitle}</p>
                        <p className="mt-1 font-mono text-sm font-semibold text-teal-700 tabular-nums">
                          {item.score}%
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="score" fill="#0F766E" radius={[6, 6, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                <th className="py-3 px-6">Course</th>
                <th className="py-3 px-4">Assessment</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Points</th>
                <th className="py-3 px-4 text-right">Percentage</th>
                <th className="py-3 px-6 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gradeRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-500">
                    No assessments available for this course.
                  </td>
                </tr>
              ) : (
                gradeRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-6 font-mono text-xs font-semibold text-slate-700">
                      {row.courseCode}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900">{row.title}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">{row.category}</td>
                    <td className="py-3.5 px-4 text-xs font-semibold">
                      <span
                        className={
                          row.status === 'Graded' || row.status === 'Completed'
                            ? 'text-emerald-700'
                            : row.status === 'Awaiting Grade'
                            ? 'text-blue-700'
                            : 'text-amber-700'
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700 tabular-nums">
                      {row.scoreText}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {row.percentage !== null ? `${row.percentage}%` : '—'}
                    </td>
                    <td className="py-3.5 px-6 text-right text-xs text-slate-500">
                      {row.dateText}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
