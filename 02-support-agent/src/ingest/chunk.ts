/**
 * A2 — heading-aware chunking.
 *
 * The policies are written as "situation → rule", usually with the rule in a table.
 * Two constraints follow from that, and both are in plan.md §3:
 *
 *   1. Every chunk carries its `##` heading, because "before the roast-day cut-off"
 *      is meaningless without "Address changes" above it.
 *   2. A table row is atomic. Splitting `| AK, HI | 6–9 business days |` in half
 *      produces a chunk that will be retrieved and will be wrong.
 */

import type { Authority, ChunkDraft } from '../types.ts';

export const MAX_CHUNK_CHARS = 1200;

type Section = { heading: string; headingLine: string; body: string };

type Block =
  | { kind: 'table'; lines: string[] }
  | { kind: 'text'; lines: string[] };

export type ChunkDocumentInput = {
  docId: string;
  title: string;
  authority: Authority;
  body: string;
};

export function chunkDocument(
  doc: ChunkDocumentInput,
  maxChars: number = MAX_CHUNK_CHARS,
): ChunkDraft[] {
  const drafts: ChunkDraft[] = [];
  let index = 0;

  for (const section of splitSections(doc.body, doc.title)) {
    for (const text of packSection(section, maxChars)) {
      drafts.push({
        id: `${doc.docId}#${index}`,
        docId: doc.docId,
        title: doc.title,
        heading: section.heading,
        authority: doc.authority,
        text,
      });
      index += 1;
    }
  }

  return drafts;
}

/**
 * Split on `##`. Anything before the first `##` becomes a preamble section headed by
 * the document's `#` title — brewing-grind-guide.md opens with two sentences that
 * would otherwise be dropped.
 */
export function splitSections(body: string, docTitle: string): Section[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const sections: Section[] = [];

  let h1: string | null = null;
  let current: Section | null = null;
  const preamble: string[] = [];

  for (const line of lines) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2?.[1] !== undefined) {
      if (current) sections.push(current);
      current = { heading: h2[1], headingLine: line.trim(), body: '' };
      continue;
    }

    const h1Match = /^#\s+(.+?)\s*$/.exec(line);
    if (h1Match?.[1] !== undefined && current === null && h1 === null) {
      h1 = h1Match[1];
      continue;
    }

    if (current) current.body += (current.body === '' ? '' : '\n') + line;
    else preamble.push(line);
  }
  if (current) sections.push(current);

  const preambleBody = preamble.join('\n').trim();
  if (preambleBody !== '') {
    const heading = h1 ?? docTitle;
    sections.unshift({ heading, headingLine: `# ${heading}`, body: preambleBody });
  }

  return sections.map((s) => ({ ...s, body: s.body.trim() }));
}

/** One section → one or more chunk texts, each prefixed with the heading line. */
function packSection(section: Section, maxChars: number): string[] {
  const prefix = `${section.headingLine}\n\n`;
  const whole = prefix + section.body;
  if (whole.length <= maxChars) return [whole];

  const budget = maxChars - prefix.length;
  const parts: string[] = [];
  let buffer: string[] = [];
  let bufferLength = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    parts.push(prefix + buffer.join('\n\n').trim());
    buffer = [];
    bufferLength = 0;
  };

  for (const block of splitBlocks(section.body)) {
    for (const piece of fitBlock(block, budget)) {
      const cost = piece.length + (buffer.length === 0 ? 0 : 2);
      if (bufferLength + cost > budget) flush();
      buffer.push(piece);
      bufferLength += piece.length + 2;
    }
  }
  flush();

  return parts;
}

/** Group lines into tables (runs of `|` lines) and everything else. */
export function splitBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const line of body.split('\n')) {
    if (line.trim() === '') {
      if (current) blocks.push(current);
      current = null;
      continue;
    }

    const kind: Block['kind'] = line.trimStart().startsWith('|') ? 'table' : 'text';
    if (current === null || current.kind !== kind) {
      if (current) blocks.push(current);
      current = { kind, lines: [line] };
    } else {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);

  return blocks;
}

/**
 * Cut an over-long block into pieces that fit. Tables split between rows and repeat
 * their header, because a table fragment without its header says nothing.
 */
function fitBlock(block: Block, budget: number): string[] {
  const text = block.lines.join('\n');
  if (text.length <= budget) return [text];

  return block.kind === 'table'
    ? splitTable(block.lines, budget)
    : splitProse(text, budget);
}

function splitTable(lines: string[], budget: number): string[] {
  // A markdown table is a header row, a `|---|` separator, then data rows.
  const hasSeparator = lines[1] !== undefined && /^\s*\|[\s:|-]+\|\s*$/.test(lines[1]);
  const header = hasSeparator ? lines.slice(0, 2) : [];
  const rows = lines.slice(header.length);
  const headerText = header.length > 0 ? header.join('\n') + '\n' : '';

  const parts: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    parts.push(headerText + buffer.join('\n'));
    buffer = [];
  };

  for (const row of rows) {
    const projected = headerText.length + buffer.join('\n').length + row.length + 1;
    if (buffer.length > 0 && projected > budget) flush();
    buffer.push(row);
  }
  flush();

  return parts;
}

function splitProse(text: string, budget: number): string[] {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z*"'`(“])/);
  const parts: string[] = [];
  let buffer = '';

  for (const sentence of sentences) {
    if (buffer !== '' && buffer.length + 1 + sentence.length > budget) {
      parts.push(buffer);
      buffer = '';
    }
    buffer = buffer === '' ? sentence : `${buffer} ${sentence}`;

    // A single sentence longer than the budget is pathological but has to go
    // somewhere; hard-cut it rather than emit an over-cap chunk.
    while (buffer.length > budget) {
      parts.push(buffer.slice(0, budget));
      buffer = buffer.slice(budget);
    }
  }
  if (buffer !== '') parts.push(buffer);

  return parts;
}
