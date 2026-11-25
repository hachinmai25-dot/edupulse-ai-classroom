import React, { useMemo, useState } from 'react';
import { CheckCircle2, Megaphone, MessageSquare, Plus, Send } from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import { formatRelativeTime } from '../../utils/helpers';
import { Modal } from '../Modal';

export function ForumSection() {
  const {
    state,
    role,
    selectedCourseFilter,
    searchQuery,
    createAnnouncement,
    createDoubt,
    replyToDoubt,
  } = useLMS();

  const [activeTab, setActiveTab] = useState<'all' | 'announcements' | 'doubts'>('all');
  const [annModalOpen, setAnnModalOpen] = useState(false);
  const [doubtModalOpen, setDoubtModalOpen] = useState(false);

  // Announcement form
  const [annCourseId, setAnnCourseId] = useState(state.courses[0]?.id ?? 'cs301');
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');

  // Doubt form
  const [doubtCourseId, setDoubtCourseId] = useState(state.courses[0]?.id ?? 'cs301');
  const [doubtRef, setDoubtRef] = useState('');
  const [doubtTitle, setDoubtTitle] = useState('');
  const [doubtQuestion, setDoubtQuestion] = useState('');

  // Inline replies keyed by doubt ID
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const courseById = useMemo(
    () => Object.fromEntries(state.courses.map((c) => [c.id, c])),
    [state.courses]
  );

  const visibleAnnouncements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.announcements.filter((a) => {
      if (selectedCourseFilter !== 'all' && a.courseId !== selectedCourseFilter) return false;
      if (q && !a.title.toLowerCase().includes(q) && !a.message.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [state.announcements, selectedCourseFilter, searchQuery]);

  const visibleDoubts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.doubts.filter((d) => {
      if (selectedCourseFilter !== 'all' && d.courseId !== selectedCourseFilter) return false;
      if (
        q &&
        !d.title.toLowerCase().includes(q) &&
        !d.question.toLowerCase().includes(q) &&
        !d.studentName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [state.doubts, selectedCourseFilter, searchQuery]);

  const referenceOptions = useMemo(() => {
    const list: string[] = [];
    for (const n of state.notes.filter((x) => x.courseId === doubtCourseId)) {
      list.push(`Note: ${n.title}`);
    }
    for (const a of state.assignments.filter((x) => x.courseId === doubtCourseId)) {
      list.push(`Assignment: ${a.title}`);
    }
    for (const q of state.quizzes.filter((x) => x.courseId === doubtCourseId && x.status === 'published')) {
      list.push(`Quiz: ${q.title}`);
    }
    return list;
  }, [state.notes, state.assignments, state.quizzes, doubtCourseId]);

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annMessage.trim()) return;
    createAnnouncement({
      courseId: annCourseId,
      title: annTitle,
      message: annMessage,
    });
    setAnnTitle('');
    setAnnMessage('');
    setAnnModalOpen(false);
  };

  const handleCreateDoubt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doubtTitle.trim() || !doubtQuestion.trim()) return;
    createDoubt({
      courseId: doubtCourseId,
      referenceLabel: doubtRef || undefined,
      title: doubtTitle,
      question: doubtQuestion,
    });
    setDoubtTitle('');
    setDoubtQuestion('');
    setDoubtRef('');
    setDoubtModalOpen(false);
  };

  const handleSendReply = (doubtId: string) => {
    const text = replyDrafts[doubtId]?.trim();
    if (!text) return;
    replyToDoubt({ doubtId, message: text });
    setReplyDrafts((prev) => ({ ...prev, [doubtId]: '' }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Doubts &amp; Announcements
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {role === 'professor'
              ? 'Broadcast course updates and resolve student questions.'
              : 'Stay updated on instructor announcements and ask questions on lectures or labs.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {role === 'professor' ? (
            <button
              type="button"
              onClick={() => {
                setAnnCourseId(
                  selectedCourseFilter !== 'all' ? selectedCourseFilter : state.courses[0]?.id ?? 'cs301'
                );
                setAnnModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Post Announcement</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDoubtCourseId(
                  selectedCourseFilter !== 'all' ? selectedCourseFilter : state.courses[0]?.id ?? 'cs301'
                );
                setDoubtModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Ask a Doubt</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1">
        {(
          [
            { id: 'all', label: 'All Activity' },
            { id: 'announcements', label: `Announcements (${visibleAnnouncements.length})` },
            { id: 'doubts', label: `Q&A Forum (${visibleDoubts.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Announcements Column */}
        {(activeTab === 'all' || activeTab === 'announcements') && (
          <section
            className={`space-y-4 ${activeTab === 'all' ? 'lg:col-span-5' : 'lg:col-span-12'}`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Megaphone className="h-4 w-4 text-blue-700" />
              <h2>Course Announcements</h2>
            </div>

            {visibleAnnouncements.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                No announcements posted for this filter.
              </div>
            ) : (
              visibleAnnouncements.map((ann) => (
                <article
                  key={ann.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-blue-700">
                      {courseById[ann.courseId]?.code}
                    </span>
                    <span>{formatRelativeTime(ann.createdAt)}</span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{ann.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                    {ann.message}
                  </p>
                  <p className="pt-1 text-xs text-slate-400">Posted by {ann.authorName}</p>
                </article>
              ))
            )}
          </section>
        )}

        {/* Q&A Doubts Column */}
        {(activeTab === 'all' || activeTab === 'doubts') && (
          <section
            className={`space-y-4 ${activeTab === 'all' ? 'lg:col-span-7' : 'lg:col-span-12'}`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MessageSquare className="h-4 w-4 text-blue-700" />
              <h2>Student Doubt Forum</h2>
            </div>

            {visibleDoubts.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                No questions posted yet.
              </div>
            ) : (
              visibleDoubts.map((doubt) => {
                const isAnswered = doubt.replies.some((r) => r.authorRole === 'professor');
                return (
                  <article
                    key={doubt.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2 text-slate-500">
                          <span className="font-mono font-semibold text-slate-700">
                            {courseById[doubt.courseId]?.code}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{doubt.studentName}</span>
                          {doubt.referenceLabel && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-600">{doubt.referenceLabel}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>{formatRelativeTime(doubt.createdAt)}</span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            isAnswered ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {isAnswered && <CheckCircle2 className="h-3.5 w-3.5" />}
                          {isAnswered ? 'Answered' : 'Awaiting Reply'}
                        </span>
                      </div>

                      <h3 className="text-base font-semibold text-slate-900">{doubt.title}</h3>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                        {doubt.question}
                      </p>
                    </div>

                    {/* Replies */}
                    {doubt.replies.length > 0 && (
                      <div className="space-y-2.5 border-t border-slate-100 pt-3">
                        {doubt.replies.map((reply) => (
                          <div
                            key={reply.id}
                            className={`rounded-lg p-3.5 text-sm ${
                              reply.authorRole === 'professor'
                                ? 'bg-blue-50/70 border border-blue-100'
                                : 'bg-slate-50 border border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs mb-1">
                              <span className="font-semibold text-slate-900">
                                {reply.authorName}
                                {reply.authorRole === 'professor' ? ' · Instructor' : ''}
                              </span>
                              <span className="text-slate-400">
                                {formatRelativeTime(reply.createdAt)}
                              </span>
                            </div>
                            <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                              {reply.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Input */}
                    <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                      <input
                        type="text"
                        value={replyDrafts[doubt.id] ?? ''}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({ ...prev, [doubt.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendReply(doubt.id);
                          }
                        }}
                        placeholder={
                          role === 'professor'
                            ? 'Write an instructor reply...'
                            : 'Add a follow-up comment...'
                        }
                        className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSendReply(doubt.id)}
                        disabled={!replyDrafts[doubt.id]?.trim()}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-40"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Reply</span>
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        )}
      </div>

      {/* Professor Post Announcement Modal */}
      <Modal
        open={annModalOpen}
        onClose={() => setAnnModalOpen(false)}
        title="Post Course Announcement"
        subtitle="Students receive an immediate notification upon publishing"
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleCreateAnnouncement} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Course</label>
            <select
              value={annCourseId}
              onChange={(e) => setAnnCourseId(e.target.value)}
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Announcement Title
            </label>
            <input
              type="text"
              required
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="e.g., Lab 3 Starter Code & Walkthrough"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Message</label>
            <textarea
              rows={4}
              required
              value={annMessage}
              onChange={(e) => setAnnMessage(e.target.value)}
              placeholder="Write your announcement details..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setAnnModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Publish Announcement
            </button>
          </div>
        </form>
      </Modal>

      {/* Student Ask a Doubt Modal */}
      <Modal
        open={doubtModalOpen}
        onClose={() => setDoubtModalOpen(false)}
        title="Ask a Course Doubt"
        subtitle="Your question appears on the Professor's Q&A board right away"
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleCreateDoubt} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Course</label>
              <select
                value={doubtCourseId}
                onChange={(e) => {
                  setDoubtCourseId(e.target.value);
                  setDoubtRef('');
                }}
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Related Lecture / Lab (optional)
              </label>
              <select
                value={doubtRef}
                onChange={(e) => setDoubtRef(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="">General course question</option>
                {referenceOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Question Summary
            </label>
            <input
              type="text"
              required
              value={doubtTitle}
              onChange={(e) => setDoubtTitle(e.target.value)}
              placeholder="e.g., Why does MVCC still need SSI for write skew?"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Details</label>
            <textarea
              rows={4}
              required
              value={doubtQuestion}
              onChange={(e) => setDoubtQuestion(e.target.value)}
              placeholder="Explain what you tried or where you got stuck..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setDoubtModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Post Question
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
