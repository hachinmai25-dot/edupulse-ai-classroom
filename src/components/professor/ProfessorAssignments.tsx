import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import { Assignment, AssignmentSubmission } from '../../types';
import { formatRelativeTime, formatShortDate, isSafeHttpUrl } from '../../utils/helpers';
import { Modal } from '../Modal';

export function ProfessorAssignments() {
  const { state, selectedCourseFilter, searchQuery, createAssignment, gradeSubmission } = useLMS();

  const [createOpen, setCreateOpen] = useState(false);
  const [reviewAssignment, setReviewAssignment] = useState<Assignment | null>(null);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState<string>('');
  const [feedbackInput, setFeedbackInput] = useState<string>('');
  const [gradeSavedNotice, setGradeSavedNotice] = useState<string | null>(null);

  // Create assignment form state
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState(state.courses[0]?.id ?? 'cs301');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('2026-12-06');
  const [maxPoints, setMaxPoints] = useState(100);

  const courseById = useMemo(
    () => Object.fromEntries(state.courses.map((c) => [c.id, c])),
    [state.courses]
  );

  const visibleAssignments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.assignments.filter((a) => {
      if (selectedCourseFilter !== 'all' && a.courseId !== selectedCourseFilter) return false;
      if (q && !a.title.toLowerCase().includes(q) && !a.instructions.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [state.assignments, selectedCourseFilter, searchQuery]);

  const reviewSubmissions = useMemo(() => {
    if (!reviewAssignment) return [];
    return state.submissions.filter((s) => s.assignmentId === reviewAssignment.id);
  }, [reviewAssignment, state.submissions]);

  const activeSubmission = useMemo(
    () => reviewSubmissions.find((s) => s.id === activeSubmissionId) ?? reviewSubmissions[0] ?? null,
    [reviewSubmissions, activeSubmissionId]
  );

  const openReviewModal = (assign: Assignment) => {
    setReviewAssignment(assign);
    const subs = state.submissions.filter((s) => s.assignmentId === assign.id);
    const firstPending = subs.find((s) => s.status === 'submitted') ?? subs[0] ?? null;
    if (firstPending) {
      setActiveSubmissionId(firstPending.id);
      setGradeInput(
        typeof firstPending.grade === 'number' ? String(firstPending.grade) : String(assign.maxPoints)
      );
      setFeedbackInput(firstPending.feedback ?? '');
    } else {
      setActiveSubmissionId(null);
      setGradeInput('');
      setFeedbackInput('');
    }
    setGradeSavedNotice(null);
  };

  const selectSubmission = (sub: AssignmentSubmission) => {
    setActiveSubmissionId(sub.id);
    setGradeInput(
      typeof sub.grade === 'number'
        ? String(sub.grade)
        : String(reviewAssignment?.maxPoints ?? 100)
    );
    setFeedbackInput(sub.feedback ?? '');
    setGradeSavedNotice(null);
  };

  const handleSaveGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubmission || !reviewAssignment) return;
    const numeric = Math.min(
      Math.max(0, Number(gradeInput) || 0),
      reviewAssignment.maxPoints
    );
    gradeSubmission({
      submissionId: activeSubmission.id,
      grade: numeric,
      feedback: feedbackInput,
    });
    setGradeSavedNotice(`Saved ${numeric}/${reviewAssignment.maxPoints} for ${activeSubmission.studentName}`);
  };

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !instructions.trim()) return;
    createAssignment({
      courseId,
      title: title.trim(),
      instructions: instructions.trim(),
      dueDate,
      maxPoints: Math.max(1, Number(maxPoints) || 100),
    });
    setTitle('');
    setInstructions('');
    setDueDate('2026-12-06');
    setMaxPoints(100);
    setCreateOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Assignment Creator &amp; Grader
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Publish labs, review student code and project links, and release rubric feedback.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCourseId(
              selectedCourseFilter !== 'all' ? selectedCourseFilter : state.courses[0]?.id ?? 'cs301'
            );
            setCreateOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Create Assignment</span>
        </button>
      </div>

      {visibleAssignments.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-base font-semibold text-slate-900">No assignments found</p>
          <p className="mt-1 text-sm text-slate-500">
            Create an assignment above or clear your search filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {visibleAssignments.map((assign) => {
            const course = courseById[assign.courseId];
            const subs = state.submissions.filter((s) => s.assignmentId === assign.id);
            const pendingCount = subs.filter((s) => s.status === 'submitted').length;
            const gradedSubs = subs.filter((s) => s.status === 'graded');
            const avgGrade =
              gradedSubs.length > 0
                ? Math.round(
                    gradedSubs.reduce((sum, s) => sum + (s.grade ?? 0), 0) / gradedSubs.length
                  )
                : null;

            return (
              <div
                key={assign.id}
                className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-slate-700">{course?.code}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{assign.maxPoints} pts</span>
                    <span aria-hidden="true">·</span>
                    <span>Due {formatShortDate(assign.dueDate)}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">{assign.title}</h2>
                  <p className="text-sm text-slate-600 line-clamp-2 whitespace-pre-line">
                    {assign.instructions}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
                    {pendingCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                        <Clock className="h-3.5 w-3.5" />
                        {pendingCount} pending review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        All current submissions graded
                      </span>
                    )}
                    <span className="text-slate-500 tabular-nums">
                      {subs.length} total {subs.length === 1 ? 'submission' : 'submissions'}
                      {avgGrade !== null ? ` · Avg ${avgGrade}/${assign.maxPoints}` : ''}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => openReviewModal(assign)}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                      pendingCount > 0
                        ? 'bg-blue-700 text-white hover:bg-blue-800'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    <span>Review Submissions ({subs.length})</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Assignment Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New Assignment"
        subtitle="Assignments appear immediately in the Student Assignment Workspace"
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleCreateAssignment} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Implement Query Cost Estimator in Python"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Course</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {state.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}: {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Max Points</label>
              <input
                type="number"
                min={1}
                max={1000}
                required
                value={maxPoints}
                onChange={(e) => setMaxPoints(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Instructions &amp; Deliverables
            </label>
            <textarea
              rows={5}
              required
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Provide detailed instructions, deliverables, and grading criteria..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Publish Assignment
            </button>
          </div>
        </form>
      </Modal>

      {/* Submission Review & Grading Panel Modal */}
      <Modal
        open={Boolean(reviewAssignment)}
        onClose={() => setReviewAssignment(null)}
        title={reviewAssignment ? `Submission Review · ${reviewAssignment.title}` : 'Review'}
        subtitle={
          reviewAssignment
            ? `${courseById[reviewAssignment.courseId]?.code} · Max ${reviewAssignment.maxPoints} pts`
            : undefined
        }
        maxWidthClass="max-w-4xl"
      >
        {reviewSubmissions.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No student submissions received for this assignment yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Student List */}
            <div className="space-y-2 border-b border-slate-200 pb-4 md:border-b-0 md:border-r md:pb-0 md:pr-4">
              <p className="text-xs font-semibold text-slate-500">
                Submissions ({reviewSubmissions.length})
              </p>
              <div className="space-y-1.5">
                {reviewSubmissions.map((sub) => {
                  const selected = activeSubmission?.id === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => selectSubmission(sub)}
                      className={`flex w-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        selected
                          ? 'border-blue-600 bg-blue-50/50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {sub.studentName}
                        </span>
                        <span
                          className={`text-[11px] font-semibold shrink-0 ${
                            sub.status === 'graded' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {sub.status === 'graded'
                            ? `${sub.grade}/${reviewAssignment?.maxPoints}`
                            : 'Pending'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {formatRelativeTime(sub.submittedAt)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Submission Details & Grading Form */}
            {activeSubmission && reviewAssignment && (
              <div className="md:col-span-2 space-y-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      {activeSubmission.studentName}&apos;s Submission
                    </h3>
                    <span className="text-xs text-slate-500">
                      Submitted {formatShortDate(activeSubmission.submittedAt)}
                    </span>
                  </div>

                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {activeSubmission.textAnswer}
                    </p>
                    {isSafeHttpUrl(activeSubmission.projectUrl) && (
                      <a
                        href={activeSubmission.projectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>{activeSubmission.projectUrl}</span>
                      </a>
                    )}
                  </div>
                </div>

                <form onSubmit={handleSaveGrade} className="space-y-4 border-t border-slate-200 pt-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Grade (out of {reviewAssignment.maxPoints})
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={reviewAssignment.maxPoints}
                        required
                        value={gradeInput}
                        onChange={(e) => setGradeInput(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2 flex items-end">
                      <p className="text-xs text-slate-500 pb-2">
                        Saving marks the submission as Graded and notifies the student immediately.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Personalized Feedback
                    </label>
                    <textarea
                      rows={3}
                      value={feedbackInput}
                      onChange={(e) => setFeedbackInput(e.target.value)}
                      placeholder="Write constructive feedback on strengths, edge cases, or improvements..."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  {gradeSavedNotice && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>{gradeSavedNotice}</span>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
                    >
                      Save &amp; Mark Graded
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
