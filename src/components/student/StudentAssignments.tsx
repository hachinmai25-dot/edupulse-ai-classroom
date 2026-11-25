import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  Loader2,
  Send,
  Upload,
} from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import { Assignment } from '../../types';
import { formatShortDate, getDueCountdown, isSafeHttpUrl } from '../../utils/helpers';
import { Modal } from '../Modal';

export function StudentAssignments() {
  const { user, state, selectedCourseFilter, searchQuery, submitAssignment } = useLMS();

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'submitted' | 'graded'>(
    'all'
  );
  const [modalAssignment, setModalAssignment] = useState<Assignment | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const courseById = useMemo(
    () => Object.fromEntries(state.courses.map((c) => [c.id, c])),
    [state.courses]
  );

  const mySubmissionByAssign = useMemo(() => {
    const map: Record<string, (typeof state.submissions)[number]> = {};
    for (const sub of state.submissions) {
      if (sub.studentId === user?.id) {
        map[sub.assignmentId] = sub;
      }
    }
    return map;
  }, [state.submissions, user?.id]);

  const visibleAssignments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.assignments.filter((a) => {
      if (selectedCourseFilter !== 'all' && a.courseId !== selectedCourseFilter) return false;
      if (q && !a.title.toLowerCase().includes(q) && !a.instructions.toLowerCase().includes(q)) {
        return false;
      }
      const sub = mySubmissionByAssign[a.id];
      const status = sub ? sub.status : 'pending';
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      return true;
    });
  }, [state.assignments, selectedCourseFilter, searchQuery, statusFilter, mySubmissionByAssign]);

  const openSubmitModal = (assign: Assignment) => {
    const existing = mySubmissionByAssign[assign.id];
    setModalAssignment(assign);
    setTextAnswer(existing?.textAnswer ?? '');
    setProjectUrl(existing?.projectUrl ?? '');
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAssignment) return;
    if (!textAnswer.trim() && !projectUrl.trim()) {
      setSubmitError('Provide either a written/code solution or a valid repository URL.');
      return;
    }
    if (projectUrl.trim() && !isSafeHttpUrl(projectUrl)) {
      setSubmitError('Project URL must start with https:// or http://.');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      await submitAssignment({
        assignmentId: modalAssignment.id,
        textAnswer: textAnswer.trim(),
        projectUrl: projectUrl.trim() || undefined,
      });
      setModalAssignment(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to submit assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Assignment Workspace
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Submit written solutions, code snippets, or repository links and review instructor
            feedback.
          </p>
        </div>

        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1">
          {(['all', 'pending', 'submitted', 'graded'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {visibleAssignments.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-base font-semibold text-slate-900">No assignments match this filter</p>
          <p className="mt-1 text-sm text-slate-500">
            Switch status tabs or check another course in the sidebar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {visibleAssignments.map((assign) => {
            const course = courseById[assign.courseId];
            const sub = mySubmissionByAssign[assign.id];
            const status = sub ? sub.status : 'pending';
            const countdown = getDueCountdown(assign.dueDate);

            return (
              <div
                key={assign.id}
                className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-700">{course?.code}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{assign.maxPoints} pts</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          status === 'pending' && countdown.urgency !== 'normal'
                            ? 'font-semibold text-amber-700'
                            : ''
                        }
                      >
                        Due {formatShortDate(assign.dueDate)}
                        {status === 'pending' ? ` (${countdown.label})` : ''}
                      </span>
                    </div>

                    <h2 className="text-lg font-semibold text-slate-900">{assign.title}</h2>
                    <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                      {assign.instructions}
                    </p>
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
                    {status === 'graded' && sub && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 tabular-nums">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>
                          Graded · {sub.grade}/{assign.maxPoints}
                        </span>
                      </span>
                    )}
                    {status === 'submitted' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                        <FileCheck2 className="h-4 w-4" />
                        <span>Submitted · Awaiting Grade</span>
                      </span>
                    )}
                    {status === 'pending' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                        <Clock className="h-4 w-4" />
                        <span>Pending Submission</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => openSubmitModal(assign)}
                      className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                        status === 'pending'
                          ? 'bg-teal-700 text-white hover:bg-teal-800'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>
                        {status === 'pending'
                          ? 'Submit Assignment'
                          : status === 'graded'
                          ? 'View Submission'
                          : 'Update Submission'}
                      </span>
                    </button>
                  </div>
                </div>

                {status === 'graded' && sub && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-900">
                        Instructor Evaluation &amp; Feedback
                      </span>
                      <span className="font-mono font-bold text-emerald-800 tabular-nums">
                        Score: {sub.grade}/{assign.maxPoints} (
                        {assign.maxPoints > 0
                          ? Math.round(((sub.grade ?? 0) / assign.maxPoints) * 100)
                          : 0}
                        %)
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {sub.feedback || 'No additional written comments provided.'}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(modalAssignment)}
        onClose={() => setModalAssignment(null)}
        title={modalAssignment ? modalAssignment.title : 'Submit Assignment'}
        subtitle={
          modalAssignment
            ? `${courseById[modalAssignment.courseId]?.code} · Max ${modalAssignment.maxPoints} pts`
            : undefined
        }
        maxWidthClass="max-w-xl"
      >
        {modalAssignment && (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 leading-relaxed whitespace-pre-line">
              {modalAssignment.instructions}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Written Response or Code Snippet
              </label>
              <textarea
                rows={6}
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder="Paste your algorithm explanation, analysis, or code snippet here..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project or Repository URL (optional)
              </label>
              <input
                type="url"
                value={projectUrl}
                onChange={(e) => setProjectUrl(e.target.value)}
                placeholder="https://github.com/username/project"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
              {isSafeHttpUrl(projectUrl) && (
                <a
                  href={projectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Preview link</span>
                </a>
              )}
            </div>

            {submitError && (
              <p className="text-xs font-medium text-rose-700">{submitError}</p>
            )}

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setModalAssignment(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>{submitting ? 'Submitting...' : 'Submit Work'}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
