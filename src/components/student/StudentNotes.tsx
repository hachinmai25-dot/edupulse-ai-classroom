import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  Download,
  ExternalLink,
  Layers,
  Loader2,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import { LectureNote } from '../../types';
import {
  downloadNoteAsMarkdown,
  formatShortDate,
  isSafeHttpUrl,
} from '../../utils/helpers';
import { MarkdownView } from '../MarkdownView';
import { Modal } from '../Modal';

interface Flashcard {
  front: string;
  back: string;
}

export function StudentNotes() {
  const { token, state, selectedCourseFilter, searchQuery, toggleBookmarkNote } = useLMS();

  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [readerNoteId, setReaderNoteId] = useState<string | null>(null);

  // AI Study Buddy state
  const [aiMode, setAiMode] = useState<'summary' | 'flashcards' | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [summaryPoints, setSummaryPoints] = useState<string[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});

  const courseById = useMemo(
    () => Object.fromEntries(state.courses.map((c) => [c.id, c])),
    [state.courses]
  );

  const uniqueModules = useMemo(() => {
    const set = new Set<string>();
    for (const n of state.notes) {
      if (selectedCourseFilter === 'all' || n.courseId === selectedCourseFilter) {
        set.add(n.moduleTag);
      }
    }
    return Array.from(set);
  }, [state.notes, selectedCourseFilter]);

  const visibleNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.notes.filter((n) => {
      if (selectedCourseFilter !== 'all' && n.courseId !== selectedCourseFilter) return false;
      if (moduleFilter !== 'all' && n.moduleTag !== moduleFilter) return false;
      if (bookmarkedOnly && !n.bookmarked) return false;
      if (
        q &&
        !n.title.toLowerCase().includes(q) &&
        !n.moduleTag.toLowerCase().includes(q) &&
        !n.content.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [state.notes, selectedCourseFilter, moduleFilter, bookmarkedOnly, searchQuery]);

  const activeNote: LectureNote | null = useMemo(
    () => state.notes.find((n) => n.id === readerNoteId) ?? null,
    [state.notes, readerNoteId]
  );

  const openReader = (note: LectureNote) => {
    setReaderNoteId(note.id);
    setAiMode(null);
    setAiError(null);
    setSummaryPoints([]);
    setFlashcards([]);
    setFlippedCards({});
  };

  const runStudyBuddy = async (mode: 'summary' | 'flashcards') => {
    if (!activeNote) return;
    setAiMode(mode);
    setAiLoading(true);
    setAiError(null);
    setFlippedCards({});

    try {
      const res = await fetch('/api/ai/study-buddy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          noteTitle: activeNote.title,
          noteContent: activeNote.content,
          mode,
        }),
      });
      const data = (await res.json()) as {
        summaryPoints?: string[];
        flashcards?: Flashcard[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'AI Study Buddy request failed.');
      }
      if (mode === 'summary') {
        setSummaryPoints(data.summaryPoints ?? []);
      } else {
        setFlashcards(data.flashcards ?? []);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to reach AI Study Buddy.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Notes &amp; Study Hub
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Read lecture guides, download Markdown handouts, and revise with AI Study Buddy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter by module"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">All Modules</option>
            {uniqueModules.map((mod) => (
              <option key={mod} value={mod}>
                {mod}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setBookmarkedOnly((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              bookmarkedOnly
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${bookmarkedOnly ? 'fill-amber-600' : ''}`} />
            <span>Bookmarked</span>
          </button>
        </div>
      </div>

      {visibleNotes.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-base font-semibold text-slate-900">No lecture notes found</p>
          <p className="mt-1 text-sm text-slate-500">
            Clear your module or bookmark filters to see all available course notes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleNotes.map((note) => {
            const course = courseById[note.courseId];
            return (
              <div
                key={note.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-700">{course?.code}</span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>{note.moduleTag}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleBookmarkNote(note.id)}
                      aria-label={note.bookmarked ? 'Remove bookmark' : 'Bookmark note'}
                      className={`rounded-md p-1 transition-colors ${
                        note.bookmarked
                          ? 'text-amber-600 hover:bg-amber-50'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                      }`}
                    >
                      <Bookmark className={`h-4 w-4 ${note.bookmarked ? 'fill-amber-500' : ''}`} />
                    </button>
                  </div>

                  <h2 className="text-base font-semibold text-slate-900 line-clamp-2">
                    {note.title}
                  </h2>
                  <p className="text-xs text-slate-500 line-clamp-3">
                    {note.content.replace(/[#`*]/g, '').slice(0, 145)}…
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Updated {formatShortDate(note.updatedAt)}
                  </p>
                </div>

                <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => openReader(note)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Read &amp; Study</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadNoteAsMarkdown({
                        title: note.title,
                        courseLabel: `${course?.code ?? ''} ${course?.title ?? ''}`,
                        moduleTag: note.moduleTag,
                        content: note.content,
                        attachmentName: note.attachmentName,
                      })
                    }
                    aria-label={`Download ${note.title}`}
                    title="Download Markdown Note"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reader + AI Study Buddy Modal */}
      <Modal
        open={Boolean(activeNote)}
        onClose={() => setReaderNoteId(null)}
        title={activeNote?.title ?? 'Lecture Note'}
        subtitle={
          activeNote
            ? `${courseById[activeNote.courseId]?.code} · ${activeNote.moduleTag}`
            : undefined
        }
        maxWidthClass="max-w-4xl"
      >
        {activeNote && (
          <div className="space-y-6">
            {/* Reader Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => runStudyBuddy('summary')}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
                >
                  {aiLoading && aiMode === 'summary' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>AI Study Buddy: 5-Point Summary</span>
                </button>
                <button
                  type="button"
                  onClick={() => runStudyBuddy('flashcards')}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3.5 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-60"
                >
                  {aiLoading && aiMode === 'flashcards' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Layers className="h-3.5 w-3.5" />
                  )}
                  <span>Generate Practice Flashcards</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleBookmarkNote(activeNote.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Bookmark
                    className={`h-3.5 w-3.5 ${
                      activeNote.bookmarked ? 'fill-amber-500 text-amber-600' : 'text-slate-500'
                    }`}
                  />
                  <span>{activeNote.bookmarked ? 'Bookmarked' : 'Bookmark'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadNoteAsMarkdown({
                      title: activeNote.title,
                      courseLabel: `${courseById[activeNote.courseId]?.code ?? ''} ${
                        courseById[activeNote.courseId]?.title ?? ''
                      }`,
                      moduleTag: activeNote.moduleTag,
                      content: activeNote.content,
                      attachmentName: activeNote.attachmentName,
                    })
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .md</span>
                </button>
              </div>
            </div>

            {/* AI Study Buddy Output Panel */}
            {(aiLoading || aiError || (aiMode === 'summary' && summaryPoints.length > 0) || (aiMode === 'flashcards' && flashcards.length > 0)) && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-700" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    {aiMode === 'summary'
                      ? 'AI Study Buddy · 5 Key Revision Points'
                      : 'AI Study Buddy · Active Recall Flashcards'}
                  </h3>
                </div>

                {aiLoading && (
                  <div className="flex items-center gap-2 py-4 text-sm text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-700" />
                    <span>Analyzing lecture note with Gemini...</span>
                  </div>
                )}

                {aiError && <p className="text-sm font-medium text-rose-700">{aiError}</p>}

                {!aiLoading && aiMode === 'summary' && summaryPoints.length > 0 && (
                  <ol className="space-y-2 list-decimal pl-5 text-sm text-slate-800 leading-relaxed">
                    {summaryPoints.map((pt, idx) => (
                      <li key={idx}>{pt}</li>
                    ))}
                  </ol>
                )}

                {!aiLoading && aiMode === 'flashcards' && flashcards.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {flashcards.map((card, idx) => {
                      const flipped = Boolean(flippedCards[idx]);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            setFlippedCards((prev) => ({ ...prev, [idx]: !prev[idx] }))
                          }
                          className={`flex min-h-32 flex-col justify-between rounded-lg border p-4 text-left transition-colors ${
                            flipped
                              ? 'border-emerald-300 bg-emerald-50/70'
                              : 'border-slate-200 bg-white hover:border-blue-300'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                            <span>
                              Card {idx + 1} · {flipped ? 'Answer' : 'Prompt'}
                            </span>
                            <span className="inline-flex items-center gap-1 text-blue-700">
                              <RotateCw className="h-3 w-3" />
                              Flip
                            </span>
                          </div>
                          <p className="my-2 text-sm font-medium text-slate-900 leading-relaxed">
                            {flipped ? card.back : card.front}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {isSafeHttpUrl(activeNote.resourceUrl) && (
              <a
                href={activeNote.resourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Supplementary Resource</span>
              </a>
            )}

            {/* Main Lecture Markdown Content */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <MarkdownView content={activeNote.content} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
