import React from 'react';

function renderInlineFormatting(text: string): React.ReactNode[] {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code
          key={idx}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800 border border-slate-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

export function MarkdownView({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      elements.push(
        <div key={`code-${i}`} className="my-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
          {lang && (
            <div className="border-b border-slate-800 px-3.5 py-1.5 font-mono text-[11px] text-slate-400">
              {lang}
            </div>
          )}
          <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-slate-100">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      i += 1;
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="mt-5 mb-2 text-base font-semibold text-slate-900">
          {renderInlineFormatting(line.slice(4))}
        </h3>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="mt-6 mb-2.5 text-lg font-semibold text-slate-900 border-b border-slate-100 pb-1.5">
          {renderInlineFormatting(line.slice(3))}
        </h2>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="mb-3 text-xl font-bold text-slate-900">
          {renderInlineFormatting(line.slice(2))}
        </h1>
      );
      i += 1;
      continue;
    }

    // Bullet list
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))
      ) {
        items.push(lines[i].trim().slice(2));
        i += 1;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-700">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineFormatting(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-3 list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-700">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineFormatting(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="my-2.5 text-[15px] leading-relaxed text-slate-700">
        {renderInlineFormatting(line)}
      </p>
    );
    i += 1;
  }

  return <div className="max-w-none">{elements}</div>;
}
