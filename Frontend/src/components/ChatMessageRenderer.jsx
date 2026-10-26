import React from 'react';
import { Sparkles, CheckCircle2, ChevronRight, ShieldCheck, ArrowRight } from 'lucide-react';

/**
 * Parses inline formatting like **bold**, *italic*, `code`, policy codes, and currency amounts.
 * Removes raw markdown asterisks and renders clean HTML elements.
 */
function renderInlineFormatted(text) {
  if (!text) return null;

  // Tokenize string by bold, italic, code, policy tags, and currencies
  const tokens = [];
  // Regex matches:
  // 1. **bold**
  // 2. `code`
  // 3. Currency e.g. £19, £2,000,000, £500
  // 4. Policy codes e.g. #INS020, POL-AUTO-5549, INS019
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|(£[\d,]+(?:\.\d+)?(?:\/(?:month|year|claim))?)|(#?[A-Z]{3,4}-[A-Z0-9-]+|#?INS\d{3}))/g;

  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.substring(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold text **...**
      tokens.push(
        <strong key={`b_${match.index}`} className="font-bold text-white tracking-tight">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // Inline code `...`
      tokens.push(
        <code key={`c_${match.index}`} className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 font-mono text-[11px]">
          {match[3]}
        </code>
      );
    } else if (match[4]) {
      // Currency amount e.g. £2,000,000
      tokens.push(
        <span key={`curr_${match.index}`} className="font-extrabold text-emerald-400">
          {match[4]}
        </span>
      );
    } else if (match[5]) {
      // Policy reference code e.g. POL-AUTO-5549 or INS020
      tokens.push(
        <span key={`pol_${match.index}`} className="font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.2 rounded text-[11px] inline-block mx-0.5">
          {match[5]}
        </span>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.substring(lastIndex));
  }

  return tokens;
}

/**
 * Enterprise Chat Message Renderer
 * Transforms raw markdown into a clean, modern UI with proper headings, glowing bullet indicators,
 * structured key-value highlights, and zero raw markdown stars.
 */
export default function ChatMessageRenderer({ content }) {
  if (!content) return null;

  // Split lines
  const lines = String(content).split('\n');
  const renderedElements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      renderedElements.push(
        <div key={`list_${renderedElements.length}`} className="my-2 space-y-1.5 pl-0.5">
          {currentList.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              <div className="flex-1">
                {item.key ? (
                  <>
                    <span className="font-bold text-sky-300 mr-1.5">{item.key}:</span>
                    {renderInlineFormatted(item.value)}
                  </>
                ) : (
                  renderInlineFormatted(item.raw)
                )}
              </div>
            </div>
          ))}
        </div>
      );
      currentList = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) {
      flushList();
      continue;
    }

    // 1. Detect Headings
    // Examples:
    // "### Heading", "## Heading", or standalone bold line "**How the plan works**", "**Key Requirements:**"
    const markdownHeadingMatch = rawLine.match(/^#{1,4}\s+(.+)$/);
    const boldHeadingMatch = rawLine.match(/^\*\*([^*:]+)\*\*[:]?$/);

    if (markdownHeadingMatch || boldHeadingMatch) {
      flushList();
      const headingText = (markdownHeadingMatch ? markdownHeadingMatch[1] : boldHeadingMatch[1]).trim();
      renderedElements.push(
        <div key={`h_${i}`} className="flex items-center gap-2 mt-4 mb-2 pt-2 border-t border-slate-800/80 first:border-t-0 first:pt-0 first:mt-1">
          <span className="w-1 h-3.5 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
          <h4 className="text-xs sm:text-[13px] font-black uppercase tracking-wider text-amber-300">
            {headingText}
          </h4>
        </div>
      );
      continue;
    }

    // 2. Detect Bullet or Numbered List Items
    // Examples:
    // "- **Coverage**: Protects you...", "• **Excess**: ...", "* Item...", "1. Item..."
    const bulletMatch = rawLine.match(/^[-*•]\s+(.+)$/) || rawLine.match(/^\d+\.\s+(.+)$/);
    if (bulletMatch) {
      const itemText = bulletMatch[1].trim();

      // Check if bullet starts with bold key e.g. "**Key**: Value" or "**Key** - Value"
      const keyValueMatch = itemText.match(/^\*\*([^*]+)\*\*[:\-]?\s*(.*)$/);
      if (keyValueMatch) {
        currentList.push({
          key: keyValueMatch[1].trim(),
          value: keyValueMatch[2].trim(),
          raw: itemText
        });
      } else {
        currentList.push({
          key: null,
          value: null,
          raw: itemText
        });
      }
      continue;
    }

    // 3. Normal Paragraph
    flushList();

    // Check if line is a clarifying question or call-to-action
    const isCallToAction = rawLine.startsWith('?') || rawLine.toLowerCase().includes('could you share') || rawLine.toLowerCase().includes('let me know if');

    renderedElements.push(
      <p
        key={`p_${i}`}
        className={`text-xs leading-relaxed my-1.5 ${
          isCallToAction
            ? 'text-amber-200/90 font-medium bg-amber-500/5 border-l-2 border-amber-500/40 pl-2.5 py-1 rounded-r-lg'
            : 'text-slate-200'
        }`}
      >
        {renderInlineFormatted(rawLine)}
      </p>
    );
  }

  flushList();

  return <div className="chat-rendered-content space-y-0.5">{renderedElements}</div>;
}
