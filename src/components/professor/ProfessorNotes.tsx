import React, { useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, Plus, Trash2, Upload } from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import { LectureNote } from '../../types';
import {
  downloadNoteAsMarkdown,
  formatShortDate,
  isSafeHttpUrl,
} from '../../utils/helpers';
import { MarkdownView } from '../MarkdownView';
import { Modal } from '../Modal';

export function ProfessorNotes() {
  const { state, selectedCourseFilter, searchQuery, createNote, deleteNote } = useLMS();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewNote, setPreviewNote] = useState<LectureNote | null>(null);

  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState(state.courses[0]?.id ?? 'cs301');
  const [moduleTag, setModuleTag] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [content, setContent] = useState('');

  const courseById = useMemo(
    () => Object.fromEntries(state.courses.map((c) => [c.id, c])),
    [state.courses]
  );

  const visibleNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.notes.filter((n) => {
      if (selectedCourseFilter !== 'all' && n.courseId !== selectedCourseFilter) return false;
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
  }, [state.notes, selectedCourseFilter, searchQuery]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentName(file.name);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.(md|txt|pdf)$/i, '').replace(/[_-]+/g, ' '));
    }
    if (file.type.startsWith('text/') || /\.(md|txt)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setContent(reader.result);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !moduleTag.trim() || !content.trim()) return;

    createNote({
      courseId,
      title: title.trim(),
      moduleTag: moduleTag.trim(),
      attachmentName: attachmentName.trim() || undefined,
      resourceUrl: isSafeHttpUrl(resourceUrl) ? resourceUrl.trim() : undefined,
      content: content.trim(),
    });

    setTitle('');
    setModuleTag('');
    setAttachmentName('');
    setResourceUrl('');
    setContent('');
    setUploadOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Lecture Notes &amp; Resource Uploader
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Publish Markdown lecture guides and study resources directly to the Student Study Hub.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCourseId(
              selectedCourseFilter !== 'all' ? selectedCourseFilter : state.courses[0]?.id ?? 'cs301'
            );
            setUploadOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Upload Study Note</span>
        </button>
      </div>

      {visibleNotes.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-base font-semibold text-slate-900">No lecture notes found</p>
          <p className="mt-1 text-sm text-slate-500">
            Upload a new note or adjust your course filter.
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
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-slate-700">
                      {course?.code} · {note.moduleTag}
                    </span>
                    <span>{formatShortDate(note.updatedAt)}</span>
                  </div>
                  <h2 className="text-base font-semibold text-slate-900 line-clamp-2">
                    {note.title}
                  </h2>
                  <p className="text-xs text-slate-500 line-clamp-3">
                    {note.content.replace(/[#`*]/g, '').slice(0, 140)}…
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewNote(note)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Preview</span>
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
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteNote(note.id)}
                    aria-label={`Delete ${note.title}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Note Modal */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload Lecture Note &amp; Resources"
        subtitle="Students can preview, bookmark, download, and study this note with AI"
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleCreateNote} className="space-y-4">
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-slate-200 text-blue-700">
                  <Upload className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {attachmentName ? `Attached: ${attachmentName}` : 'Attach .md or .txt lecture file (optional)'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Text/Markdown files auto-populate the note editor below
                  </p>
                </div>
              </div>
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shrink-0">
                Choose File
              </span>
              <input
                type="file"
                accept=".md,.txt,.pdf"
                onChange={handleFileUpload}
                className="sr-only"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Note Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Reinforcement Learning: Q-Learning & SARSA"
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Module Tag</label>
              <input
                type="text"
                required
                value={moduleTag}
                onChange={(e) => setModuleTag(e.target.value)}
                placeholder="e.g., Module 5: RL"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Optional External PDF / Slide Link
              </label>
              <input
                type="url"
                value={resourceUrl}
                onChange={(e) => setResourceUrl(e.target.value)}
                placeholder="https://example.edu/slides/lecture-5.pdf"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Markdown Lecture Content
            </label>
            <textarea
              rows={7}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Heading&#10;&#10;Write key concepts, equations, and code blocks..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs leading-relaxed text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setUploadOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Publish Note
            </button>
          </div>
        </form>
      </Modal>

      {/* Preview Note Modal */}
      <Modal
        open={Boolean(previewNote)}
        onClose={() => setPreviewNote(null)}
        title={previewNote?.title ?? 'Preview'}
        subtitle={
          previewNote
            ? `${courseById[previewNote.courseId]?.code} · ${previewNote.moduleTag}`
            : undefined
        }
        maxWidthClass="max-w-3xl"
      >
        {previewNote && (
          <div className="space-y-4">
            {isSafeHttpUrl(previewNote.resourceUrl) && (
              <a
                href={previewNote.resourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open External Resource Link</span>
              </a>
            )}
            <MarkdownView content={previewNote.content} />
          </div>
        )}
      </Modal>
    </div>
  );
}
