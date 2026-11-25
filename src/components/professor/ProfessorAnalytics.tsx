import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLMS } from '../../context/LMSContext';

export function ProfessorAnalytics() {
  const { state, selectedCourseFilter } = useLMS();

  const courses = useMemo(
    () =>
      selectedCourseFilter === 'all'
        ? state.courses
        : state.courses.filter((c) => c.id === selectedCourseFilter),
    [state.courses, selectedCourseFilter]
  );

  const courseById = useMemo(
    () => Object.fromEntries(state.courses.map((c) => [c.id, c])),
    [state.courses]
  );

  const courseComparisonData = useMemo(() => {
    return courses.map((course) => {
      const courseQuizzes = state.quizzes.filter((q) => q.courseId === course.id);
      const quizIds = new Set(courseQuizzes.map((q) => q.id));
      const quizAttempts = state.quizAttempts.filter((a) => quizIds.has(a.quizId));
      const quizAvg =
        quizAttempts.length > 0
          ? Math.round(
              quizAttempts.reduce(
                (s, a) => s + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0),
                0
              ) / quizAttempts.length
            )
          : 0;

      const courseAssigns = state.assignments.filter((a) => a.courseId === course.id);
      const assignMap = Object.fromEntries(courseAssigns.map((a) => [a.id, a]));
      const gradedSubs = state.submissions.filter(
        (s) => assignMap[s.assignmentId] && s.status === 'graded' && typeof s.grade === 'number'
      );
      const assignAvg =
        gradedSubs.length > 0
          ? Math.round(
              gradedSubs.reduce((s, sub) => {
                const maxP = assignMap[sub.assignmentId]?.maxPoints ?? 100;
                return s + (maxP > 0 ? ((sub.grade ?? 0) / maxP) * 100 : 0);
              }, 0) / gradedSubs.length
            )
          : 0;

      return {
        course: `${course.code}: ${course.title}`,
        Quizzes: quizAvg,
        Assignments: assignAvg,
      };
    });
  }, [courses, state]);

  // Aggregate per-student performance table
  const studentRows = useMemo(() => {
    const courseIds = new Set(courses.map((c) => c.id));
    const quizMap = Object.fromEntries(state.quizzes.map((q) => [q.id, q]));
    const assignMap = Object.fromEntries(state.assignments.map((a) => [a.id, a]));

    const byStudent: Record<
      string,
      {
        name: string;
        quizScores: number[];
        assignScores: number[];
        pendingCount: number;
      }
    > = {};

    for (const att of state.quizAttempts) {
      const quiz = quizMap[att.quizId];
      if (!quiz || !courseIds.has(quiz.courseId)) continue;
      if (!byStudent[att.studentId]) {
        byStudent[att.studentId] = {
          name: att.studentName,
          quizScores: [],
          assignScores: [],
          pendingCount: 0,
        };
      }
      if (att.maxScore > 0) {
        byStudent[att.studentId].quizScores.push((att.score / att.maxScore) * 100);
      }
    }

    for (const sub of state.submissions) {
      const assign = assignMap[sub.assignmentId];
      if (!assign || !courseIds.has(assign.courseId)) continue;
      if (!byStudent[sub.studentId]) {
        byStudent[sub.studentId] = {
          name: sub.studentName,
          quizScores: [],
          assignScores: [],
          pendingCount: 0,
        };
      }
      if (sub.status === 'graded' && typeof sub.grade === 'number' && assign.maxPoints > 0) {
        byStudent[sub.studentId].assignScores.push((sub.grade / assign.maxPoints) * 100);
      } else if (sub.status === 'submitted') {
        byStudent[sub.studentId].pendingCount += 1;
      }
    }

    return Object.entries(byStudent)
      .map(([id, row]) => {
        const all = [...row.quizScores, ...row.assignScores];
        const avg = all.length > 0 ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : null;
        const quizAvg =
          row.quizScores.length > 0
            ? Math.round(row.quizScores.reduce((a, b) => a + b, 0) / row.quizScores.length)
            : null;
        const assignAvg =
          row.assignScores.length > 0
            ? Math.round(row.assignScores.reduce((a, b) => a + b, 0) / row.assignScores.length)
            : null;
        return {
          id,
          name: row.name,
          quizCount: row.quizScores.length,
          quizAvg,
          assignAvg,
          pendingCount: row.pendingCount,
          overallAvg: avg,
        };
      })
      .sort((a, b) => (b.overallAvg ?? -1) - (a.overallAvg ?? -1));
  }, [courses, state]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Class Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">
          Course-level quiz vs. assignment averages and individual student standing.
        </p>
      </div>

      {/* Course Comparison Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">
          Quiz vs. Assignment Average by Course
        </h2>
        <p className="text-xs text-slate-500 mb-5">
          Mean percentage across recorded submissions
        </p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={courseComparisonData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="course"
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
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Quizzes" fill="#1D4ED8" radius={[6, 6, 0, 0]} maxBarSize={56} />
              <Bar dataKey="Assignments" fill="#0F766E" radius={[6, 6, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Student Roster Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Student Roster Standing</h2>
            <p className="text-xs text-slate-500">
              Active students with recorded quiz attempts or assignment submissions
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {Object.keys(courseById).length} courses
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                <th className="py-3 px-6">Student</th>
                <th className="py-3 px-4 text-right">Quizzes Completed</th>
                <th className="py-3 px-4 text-right">Quiz Avg</th>
                <th className="py-3 px-4 text-right">Assignment Avg</th>
                <th className="py-3 px-4 text-right">Pending Review</th>
                <th className="py-3 px-6 text-right">Overall</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studentRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-500">
                    No student assessment activity recorded yet.
                  </td>
                </tr>
              ) : (
                studentRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-6 font-medium text-slate-900">{row.name}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-600 tabular-nums">
                      {row.quizCount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700 tabular-nums">
                      {row.quizAvg !== null ? `${row.quizAvg}%` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700 tabular-nums">
                      {row.assignAvg !== null ? `${row.assignAvg}%` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-amber-700 tabular-nums">
                      {row.pendingCount}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {row.overallAvg !== null ? `${row.overallAvg}%` : 'Pending'}
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
