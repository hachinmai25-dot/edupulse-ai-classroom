import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import { Quiz, QuizQuestion } from '../../types';
import { formatDuration, formatShortDate, uid } from '../../utils/helpers';
import { Modal } from '../Modal';

function createEmptyQuestion(): QuizQuestion {
  return {
    id: uid('q'),
    text: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    points: 10,
    explanation: '',
  };
}

export function ProfessorQuizzes() {
  const { token, state, selectedCourseFilter, searchQuery, createQuiz, toggleQuizStatus, deleteQuiz } =
    useLMS();

  const [builderOpen, setBuilderOpen] = useState(false);
  const [leaderboardQuiz, setLeaderboardQuiz] = useState<Quiz | null>(null);

  // Builder state
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState(state.courses[0]?.id ?? 'cs301');
  const [description, setDescription] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [dueDate, setDueDate] = useState('2026-12-05');
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const [questions, setQuestions] = useState<QuizQuestion[]>([createEmptyQuestion()]);
  const [formError, setFormError] = useState<string | null>(null);

  // AI Generator state
  const [aiTopic, setAiTopic] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);

  const courseById = useMemo(
    () => Object.fromEntries(state.courses.map((c) => [c.id, c])),
    [state.courses]
  );

  const visibleQuizzes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.quizzes.filter((quiz) => {
      if (selectedCourseFilter !== 'all' && quiz.courseId !== selectedCourseFilter) return false;
      if (q && !quiz.title.toLowerCase().includes(q) && !quiz.description.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [state.quizzes, selectedCourseFilter, searchQuery]);

  const resetForm = () => {
    setTitle('');
    setCourseId(selectedCourseFilter !== 'all' ? selectedCourseFilter : state.courses[0]?.id ?? 'cs301');
    setDescription('');
    setTimeLimitMinutes(15);
    setDueDate('2026-12-05');
    setStatus('published');
    setQuestions([createEmptyQuestion()]);
    setFormError(null);
    setAiTopic('');
    setAiError(null);
    setAiSuccessMsg(null);
  };

  const handleGenerateWithAI = async () => {
    setAiError(null);
    setAiSuccessMsg(null);
    if (aiTopic.trim().length < 5) {
      setAiError('Enter a topic or paste lecture notes (at least 5 characters) first.');
      return;
    }

    setAiLoading(true);
    try {
      const course = courseById[courseId];
      const res = await fetch('/api/ai/generate-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          courseTitle: course ? `${course.code}: ${course.title}` : undefined,
          count: 5,
        }),
      });
      const data = (await res.json()) as {
        questions?: Array<{
          text: string;
          options: string[];
          correctIndex: number;
          points: number;
          explanation: string;
        }>;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate questions.');
      }

      const generated = (data.questions ?? []).map((q) => ({
        id: uid('q'),
        text: q.text,
        options: q.options.slice(0, 4),
        correctIndex: q.correctIndex,
        points: q.points || 10,
        explanation: q.explanation || '',
      }));

      if (generated.length === 0) {
        throw new Error('No questions were returned. Try a more detailed topic.');
      }

      setQuestions((prev) => {
        const hasOnlyEmpty =
          prev.length === 1 && !prev[0].text.trim() && prev[0].options.every((o) => !o.trim());
        return hasOnlyEmpty ? generated : [...prev, ...generated];
      });

      if (!title.trim()) {
        const firstLine = aiTopic.trim().split('\n')[0].replace(/^#+\s*/, '').slice(0, 56);
        setTitle(`${firstLine} Assessment`);
      }
      setAiSuccessMsg(`Added ${generated.length} AI-generated questions below. Review and save when ready.`);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to generate questions.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) {
      setFormError('Please enter a quiz title.');
      return;
    }
    if (questions.length === 0) {
      setFormError('Add at least one multiple-choice question.');
      return;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setFormError(`Question ${i + 1} is missing its prompt text.`);
        return;
      }
      if (q.options.some((opt) => !opt.trim())) {
        setFormError(`Question ${i + 1} must have all 4 answer options filled in.`);
        return;
      }
    }

    try {
      await createQuiz({
        courseId,
        title: title.trim(),
        description: description.trim() || 'Course comprehension and problem-solving assessment.',
        timeLimitMinutes: Math.max(1, Number(timeLimitMinutes) || 15),
        dueDate,
        status,
        questions,
      });

      setBuilderOpen(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save quiz.');
    }
  };

  const updateQuestion = (index: number, patch: Partial<QuizQuestion>) => {
    setQuestions((prev) => prev.map((q, idx) => (idx === index ? { ...q, ...patch } : q)));
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qIndex) return q;
        const nextOpts = [...q.options];
        nextOpts[optIndex] = value;
        return { ...q, options: nextOpts };
      })
    );
  };

  const leaderboardAttempts = useMemo(() => {
    if (!leaderboardQuiz) return [];
    return state.quizAttempts
      .filter((a) => a.quizId === leaderboardQuiz.id)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.timeTakenSeconds - b.timeTakenSeconds;
      });
  }, [leaderboardQuiz, state.quizAttempts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Quiz Builder &amp; Manager
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create timed assessments manually or generate questions from lecture material using AI.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setBuilderOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Create Quiz</span>
        </button>
      </div>

      {/* Quiz Cards */}
      {visibleQuizzes.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-base font-semibold text-slate-900">No quizzes match your filter</p>
          <p className="mt-1 text-sm text-slate-500">
            Create a new quiz or switch courses in the left sidebar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {visibleQuizzes.map((quiz) => {
            const course = courseById[quiz.courseId];
            const attempts = state.quizAttempts.filter((a) => a.quizId === quiz.id);
            const totalPoints = quiz.questions.reduce((s, q) => s + q.points, 0);
            const avgPct =
              attempts.length > 0
                ? Math.round(
                    attempts.reduce(
                      (s, a) => s + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0),
                      0
                    ) / attempts.length
                  )
                : null;

            return (
              <div
                key={quiz.id}
                className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-slate-700">{course?.code}</span>
                    <span aria-hidden="true">·</span>
                    <span>{quiz.questions.length} questions</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{totalPoints} pts</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{quiz.timeLimitMinutes} min limit</span>
                    <span aria-hidden="true">·</span>
                    <span>Due {formatShortDate(quiz.dueDate)}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">{quiz.title}</h2>
                  <p className="text-sm text-slate-600 line-clamp-2">{quiz.description}</p>
                  <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
                    <span
                      className={`inline-flex items-center gap-1.5 font-semibold ${
                        quiz.status === 'published' ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {quiz.status === 'published' ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Clock className="h-3.5 w-3.5" />
                      )}
                      {quiz.status === 'published' ? 'Published to Students' : 'Draft (Hidden)'}
                    </span>
                    <span className="text-slate-500 tabular-nums">
                      {attempts.length} {attempts.length === 1 ? 'submission' : 'submissions'}
                      {avgPct !== null ? ` · Avg ${avgPct}%` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setLeaderboardQuiz(quiz)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Trophy className="h-3.5 w-3.5 text-amber-600" />
                    <span>Leaderboard ({attempts.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleQuizStatus(quiz.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
                  >
                    {quiz.status === 'published' ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                        <span>Move to Draft</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Publish</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteQuiz(quiz.id)}
                    aria-label={`Delete ${quiz.title}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Quiz Modal */}
      <Modal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        title="Create New Quiz"
        subtitle="Configure timing, questions, or auto-generate MCQs with AI"
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleSaveQuiz} className="space-y-6">
          {/* AI Quiz Generator Box */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-700" />
                <h3 className="text-sm font-semibold text-slate-900">AI Quiz Generator</h3>
              </div>
              <select
                aria-label="Prefill topic from an existing lecture note"
                value=""
                onChange={(e) => {
                  const note = state.notes.find((n) => n.id === e.target.value);
                  if (note) {
                    setAiTopic(note.content);
                    setCourseId(note.courseId);
                    if (!title.trim()) setTitle(`${note.title} Quiz`);
                  }
                }}
                className="rounded-md border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
              >
                <option value="">Insert from Lecture Note...</option>
                {state.notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {courseById[n.courseId]?.code}: {n.title}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              rows={3}
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="Paste any lecture note excerpt or topic (e.g., 'B+ Tree insertion, splitting leaf nodes, and clustered vs unclustered indexes')..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
            {aiError && <p className="text-xs font-medium text-rose-700">{aiError}</p>}
            {aiSuccessMsg && <p className="text-xs font-medium text-emerald-700">{aiSuccessMsg}</p>}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={aiLoading}
                className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Generating 5 Questions...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Generate 5 Questions with AI</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quiz Metadata */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quiz Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Adversarial Search & Game Trees"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Time Limit (min)
                </label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of topics covered..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2 flex items-center gap-4">
              <span className="text-xs font-semibold text-slate-700">Initial Status:</span>
              <label className="inline-flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="quizStatus"
                  checked={status === 'published'}
                  onChange={() => setStatus('published')}
                  className="accent-blue-700"
                />
                <span>Published (visible to students)</span>
              </label>
              <label className="inline-flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="quizStatus"
                  checked={status === 'draft'}
                  onChange={() => setStatus('draft')}
                  className="accent-blue-700"
                />
                <span>Save as Draft</span>
              </label>
            </div>
          </div>

          {/* Dynamic Questions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Multiple-Choice Questions ({questions.length})
              </h3>
              <button
                type="button"
                onClick={() => setQuestions((prev) => [...prev, createEmptyQuestion()])}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Question</span>
              </button>
            </div>

            {questions.map((q, qIdx) => (
              <div
                key={q.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs font-semibold text-slate-600">
                    Question {qIdx + 1}
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                      <span>Points:</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={q.points}
                        onChange={(e) =>
                          updateQuestion(qIdx, { points: Math.max(1, Number(e.target.value) || 10) })
                        }
                        className="w-16 rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs tabular-nums"
                      />
                    </label>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setQuestions((prev) => prev.filter((_, idx) => idx !== qIdx))
                        }
                        className="text-xs font-medium text-rose-600 hover:text-rose-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  value={q.text}
                  onChange={(e) => updateQuestion(qIdx, { text: e.target.value })}
                  placeholder="Enter question prompt..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {q.options.map((opt, optIdx) => (
                    <div
                      key={optIdx}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                        q.correctIndex === optIdx
                          ? 'border-emerald-300 bg-emerald-50/50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={q.correctIndex === optIdx}
                        onChange={() => updateQuestion(qIdx, { correctIndex: optIdx })}
                        aria-label={`Mark option ${optIdx + 1} as correct`}
                        className="accent-emerald-600 shrink-0"
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(qIdx, optIdx, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                        className="w-full bg-transparent text-xs text-slate-900 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                <input
                  type="text"
                  value={q.explanation}
                  onChange={(e) => updateQuestion(qIdx, { explanation: e.target.value })}
                  placeholder="Optional answer explanation shown to students after submission..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 focus:border-blue-600 focus:outline-none"
                />
              </div>
            ))}
          </div>

          {formError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setBuilderOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Save Quiz
            </button>
          </div>
        </form>
      </Modal>

      {/* Leaderboard Modal */}
      <Modal
        open={Boolean(leaderboardQuiz)}
        onClose={() => setLeaderboardQuiz(null)}
        title={leaderboardQuiz ? `Leaderboard · ${leaderboardQuiz.title}` : 'Leaderboard'}
        subtitle="Ranked by highest score and fastest completion time"
        maxWidthClass="max-w-2xl"
      >
        {leaderboardAttempts.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No students have completed this quiz yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 pr-3">Rank</th>
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3 text-right">Score</th>
                  <th className="py-2.5 px-3 text-right">Time</th>
                  <th className="py-2.5 pl-3 text-right">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaderboardAttempts.map((att, idx) => {
                  const pct = att.maxScore > 0 ? Math.round((att.score / att.maxScore) * 100) : 0;
                  return (
                    <tr key={att.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-3 font-mono text-xs font-semibold text-slate-600 tabular-nums">
                        #{idx + 1}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900">{att.studentName}</td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <span className="font-semibold text-slate-900">
                          {att.score}/{att.maxScore}
                        </span>{' '}
                        <span className="text-xs text-slate-500">({pct}%)</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs text-slate-600 tabular-nums">
                        {formatDuration(att.timeTakenSeconds)}
                      </td>
                      <td className="py-3 pl-3 text-right text-xs text-slate-500">
                        {formatShortDate(att.submittedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
