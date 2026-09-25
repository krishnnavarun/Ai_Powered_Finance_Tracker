import { Fragment } from 'react';

// **bold** inside a line → <strong>.
function inline(text) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}

// Shows an answer with the little formatting models use: paragraphs, "- " or "1. "
// lists and **bold**. Anything else is plain text (never HTML).
export function MessageText({ text }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="grid gap-2 text-sm leading-relaxed">
      {blocks.map((block, b) => {
        const lines = block.split('\n');
        const bullets = lines.every((line) => /^\s*([-*•]|\d+\.)\s+/.test(line));
        if (bullets) {
          const Tag = /^\s*\d+\./.test(lines[0]) ? 'ol' : 'ul';
          return (
            <Tag key={b} className={Tag === 'ol' ? 'list-decimal pl-5' : 'list-disc pl-5'}>
              {lines.map((line, i) => (
                <li key={i}>{inline(line.replace(/^\s*([-*•]|\d+\.)\s+/, ''))}</li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={b} className="whitespace-pre-wrap">
            {inline(block)}
          </p>
        );
      })}
    </div>
  );
}
