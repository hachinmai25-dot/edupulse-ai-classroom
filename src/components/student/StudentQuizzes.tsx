import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import { Quiz, QuizAttempt } from '../../types';
import { formatDuration, formatShortDate } from '../../utils/helpers';

export function StudentQuizzes() {
  const { user, state, selectedCourseFilter, searchQuery, submitQuizAttempt } = useLMS();

  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reviewAttempt, setReviewAttempt] = useState<{
    quiz: Quiz;
    attempt: QuizAttempt;
    autoSubmitted?: boolean;
  } | null>(null);

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const activeQuizRef = useRef(activeQuiz);
  activeQuizRef.current = activeQuiz;
  const startTimestampRef = useRef<number>(0);

  const courseById = useMemo(
    () => Object.fromEntries(state.courses.map((c) => [c.id, c])),
    [state.courses]
  );

  const publishedQuizzes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.quizzes.filter((quiz) => {
      if (quiz.status !== 'published') return false;
      if (selectedCourseFilter !== 'all' && quiz.courseId !== selectedCourseFilter) return false;
      if (q && !quiz.title.toLowerCase().includes(q) && !quiz.description.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [state.quizzes, selectedCourseFilter, searchQuery]);

  const myAttemptsByQuiz = useMemo(() => {
    const map: Record<string, QuizAttempt> = {};
    for (const att of state.quizAttempts) {
      if (att.studentId === user?.id) {
        map[att.quizId] = att;
      }
    }
    return map;
  }, [state.quizAttempts, user?.id]);

  const finalizeQuiz = useCallback(
    async (autoSubmitted = false) => {
      const quiz = activeQuizRef.current;
      if (!quiz || submitting) return;
      setSubmitting(true);
      setSubmitError(null);
      try {
        const elapsed = Math.max(
          1,
          Math.min(
            quiz.timeLimitMinutes * 60,
            Math.round((Date.now() - startTimestampRef.current) / 1000)
          )
        );
        const { attempt, quiz: gradedQuiz } = await submitQuizAttempt({
          quizId: quiz.id,
          answers: answersRef.current,
          timeTakenSeconds: elapsed,
        });
        setActiveQuiz(null);
        setReviewAttempt({ quiz: gradedQuiz, attempt, autoSubmitted });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Unable to submit quiz.');
      } finally {
        setSubmitting(false);
      }
    },
    [submitQuizAttempt, submitting]
  );

  useEffect(() => {
    if (!activeQuiz) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          void finalizeQuiz(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeQuiz, finalizeQuiz]);

  const startQuiz = (quiz: Quiz) => {
    setReviewAttempt(null);
    setAnswers({});
    setCurrentIdx(0);
    setSubmitError(null);
    setSecondsLeft(quiz.timeLimitMinutes * 60);
    startTimestampRef.current = Date.now();
    setActiveQuiz(quiz);
  };

  if (activeQuiz) {
    const question = activeQuiz.questions[currentIdx];
    const answeredCount = activeQuiz.questions.filter((q) => answers[q.id] !== undefined).length;
    const isUrgent = secondsLeft <= 120;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-mono font-semibold text-teal-700">
              {courseById[activeQuiz.courseId]?.code} · Live Assessment
            </p>
            <h1 className="text-lg font-bold text-slate-900 truncate">{activeQuiz.title}</h1>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div
              className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 font-mono text-sm font-semibold tabular-nums ${
                isUrgent
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-slate-50 text-slate-900'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>{formatDuration(secondsLeft)}</span>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void finalizeQuiz(false)}
              className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Submit Quiz</span>
            </button>
          </div>
        </div>

        {submitError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {submitError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8 flex flex-col justify-between space-y-6">
            {question && (
              <div className="space-y-5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono font-semibold text-slate-700">
                    Question {currentIdx + 1} of {activeQuiz.questions.length}
                  </span>
                  <span className="font-mono tabular-nums">{question.points} pts</span>
                </div>

                <h2 className="text-lg font-semibold leading-snug text-slate-900">
                  {question.text}
                </h2>

                <div className="space-y-2.5" role="radiogroup" aria-label="Answer options">
                  {question.options.map((opt, optIdx) => {
                    const checked = answers[question.id] === optIdx;
                    return (
                      <label
                        key={optIdx}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                          checked
                            ? 'border-teal-700 bg-teal-50/50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          checked={checked}
                          onChange={() =>
                            setAnswers((prev) => ({ ...prev, [question.id]: optIdx }))
                          }
                          className="mt-0.5 accent-teal-700"
                        />
                        <span className="font-mono text-xs font-semibold text-slate-500 mt-0.5">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        <span className="text-sm text-slate-800 leading-relaxed">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>

              {currentIdx < activeQuiz.questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCurrentIdx((i) => Math.min(activeQuiz.questions.length - 1, i + 1))
                  }
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <span>Next</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void finalizeQuiz(false)}
                  className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {submitting ? 'Grading...' : 'Finish & Submit'}
                </button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4 space-y-4 self-start">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Question Palette</h3>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {answeredCount}/{activeQuiz.questions.length} answered
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {activeQuiz.questions.map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined;
                const isCurrent = idx === currentIdx;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-10 rounded-lg font-mono text-xs font-semibold tabular-nums transition-colors ${
                      isCurrent
                        ? 'bg-teal-700 text-white'
                        : isAnswered
                        ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-slate-100 pt-3 text-xs text-slate-500">
              <p>Timer auto-submits automatically when it reaches 00:00.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (reviewAttempt) {
    const { quiz, attempt, autoSubmitted } = reviewAttempt;
    const pct = attempt.maxScore > 0 ? Math.round((attempt.score / attempt.maxScore) * 100) : 0;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setReviewAttempt(null)}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Quizzes</span>
          </button>

          <button
            type="button"
            onClick={() => startQuiz(quiz)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Retake Quiz</span>
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-semibold text-teal-700">
                {courseById[quiz.courseId]?.code} · Assessment Results
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">{quiz.title}</h1>
              {autoSubmitted && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Time expired — your quiz was submitted automatically.</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-slate-500">Score</p>
                <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {attempt.score}/{attempt.maxScore}{' '}
                  <span className="text-base font-semibold text-teal-700">({pct}%)</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Time Taken</p>
                <p className="font-mono text-xl font-semibold text-slate-700 tabular-nums">
                  {formatDuration(attempt.timeTakenSeconds)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {quiz.questions.map((q, idx) => {
            const chosen = attempt.answers[q.id];
            const isCorrect = chosen === q.correctIndex;
            return (
              <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="font-mono text-xs font-semibold text-slate-500">
                      Question {idx + 1} · {q.points} pts
                    </span>
                    <h2 className="text-base font-semibold text-slate-900">{q.text}</h2>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold shrink-0 ${
                      isCorrect ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {isCorrect ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Correct</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        <span>Incorrect</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {q.options.map((opt, optIdx) => {
                    const isRightOpt = optIdx === q.correctIndex;
                    const isUserChoice = optIdx === chosen;
                    let cls = 'border-slate-200 bg-slate-50/50 text-slate-700';
                    if (isRightOpt) {
                      cls = 'border-emerald-300 bg-emerald-50 text-emerald-900 font-medium';
                    } else if (isUserChoice && !isRightOpt) {
                      cls = 'border-rose-300 bg-rose-50 text-rose-900';
                    }
                    return (
                      <div key={optIdx} className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>
                        <span className="font-mono font-semibold mr-1.5">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        {opt}
                        {isRightOpt && (
                          <span className="ml-2 text-emerald-700">(Correct Answer)</span>
                        )}
                        {isUserChoice && !isRightOpt && (
                          <span className="ml-2 text-rose-700">(Your Answer)</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {q.explanation && (
                  <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600 border border-slate-100">
                    <strong className="text-slate-800">Explanation: </strong>
                    {q.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quizzes &amp; Exams</h1>
        <p className="mt-1 text-sm text-slate-500">
          Launch timed assessments with live countdown tracking and instant explanations.
        </p>
      </div>

      {publishedQuizzes.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-base font-semibold text-slate-900">No published quizzes available</p>
          <p className="mt-1 text-sm text-slate-500">
            Check back once your instructor publishes a quiz.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {publishedQuizzes.map((quiz) => {
            const course = courseById[quiz.courseId];
            const attempt = myAttemptsByQuiz[quiz.id];
            const totalPts = quiz.questions.reduce((s, q) => s + q.points, 0);
            const pct =
              attempt && attempt.maxScore > 0
                ? Math.round((attempt.score / attempt.maxScore) * 100)
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
                    <span className="tabular-nums">{totalPts} pts</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{quiz.timeLimitMinutes} min</span>
                    <span aria-hidden="true">·</span>
                    <span>Due {formatShortDate(quiz.dueDate)}</span>
                  </div>

                  <h2 className="text-lg font-semibold text-slate-900">{quiz.title}</h2>
                  <p className="text-sm text-slate-600">{quiz.description}</p>

                  <div className="pt-1 text-xs">
                    {attempt ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 tabular-nums">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>
                          Completed · {attempt.score}/{attempt.maxScore} ({pct}%)
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Not Attempted</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {attempt && (
                    <button
                      type="button"
                      onClick={() => setReviewAttempt({ quiz, attempt })}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      Review Results
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => startQuiz(quiz)}
                    className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>{attempt ? 'Retake Quiz' : 'Start Quiz'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
