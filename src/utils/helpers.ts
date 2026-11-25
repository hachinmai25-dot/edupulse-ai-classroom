export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function isSafeHttpUrl(raw?: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function formatShortDate(isoOrDate: string): string {
  const date = isoOrDate.length === 10 ? new Date(`${isoOrDate}T12:00:00`) : new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return isoOrDate;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDate(iso);
}

export function getDueCountdown(dueDateStr: string): {
  label: string;
  urgency: 'overdue' | 'soon' | 'normal';
} {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const due = new Date(`${dueDateStr}T23:59:59`).getTime();
  if (Number.isNaN(due)) {
    return { label: dueDateStr, urgency: 'normal' };
  }
  const diffDays = Math.ceil((due - todayStart) / (1000 * 60 * 60 * 24)) - 1;
  if (diffDays < 0) {
    return { label: `${Math.abs(diffDays)}d overdue`, urgency: 'overdue' };
  }
  if (diffDays === 0) {
    return { label: 'Due today', urgency: 'soon' };
  }
  if (diffDays <= 3) {
    return { label: `Due in ${diffDays}d`, urgency: 'soon' };
  }
  return { label: `Due in ${diffDays}d`, urgency: 'normal' };
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function downloadNoteAsMarkdown(params: {
  title: string;
  courseLabel: string;
  moduleTag: string;
  content: string;
  attachmentName?: string;
}): void {
  const slug =
    params.attachmentName?.trim() ||
    `${params.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')}.md`;

  const body = `---
Title: ${params.title}
Course: ${params.courseLabel}
Module: ${params.moduleTag}
Exported from EduPulse
---

${params.content}
`;

  const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = slug.endsWith('.md') || slug.endsWith('.txt') ? slug : `${slug}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
