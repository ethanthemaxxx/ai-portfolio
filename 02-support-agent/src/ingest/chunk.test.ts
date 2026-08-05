import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { chunkDocument, MAX_CHUNK_CHARS, splitBlocks, splitSections } from './chunk.ts';
import { policyPath } from './corpus-paths.ts';
import { parseDocument } from './frontmatter.ts';
import type { ChunkDraft } from '../types.ts';

async function chunksFor(filename: string, maxChars = MAX_CHUNK_CHARS): Promise<ChunkDraft[]> {
  const path = policyPath(filename);
  const doc = parseDocument(await readFile(path, 'utf8'), path);
  return chunkDocument(
    { docId: doc.docId, title: doc.title, authority: doc.authority, body: doc.body },
    maxChars,
  );
}

function tableRows(text: string): string[] {
  return text.split('\n').filter((line) => line.trimStart().startsWith('|'));
}

// A2 — "brewing-grind-guide.md → every chunk carries its ## heading; no chunk exceeds
// the cap; no table split mid-row"
test('A2: every chunk carries its heading', async () => {
  const chunks = await chunksFor('brewing-grind-guide.md');
  assert.ok(chunks.length > 1);

  for (const chunk of chunks) {
    assert.notEqual(chunk.heading, '', `${chunk.id} has a heading`);
    assert.ok(
      chunk.text.startsWith(`## ${chunk.heading}`) || chunk.text.startsWith(`# ${chunk.heading}`),
      `${chunk.id} text opens with its heading, got: ${chunk.text.slice(0, 40)}`,
    );
  }

  const headings = chunks.map((c) => c.heading);
  assert.ok(headings.includes('Pick your grind by your brewer'));
  assert.ok(headings.includes('Troubleshooting'));
  assert.ok(headings.includes('Caffeine'));
});

test('A2: no chunk in the corpus exceeds the cap', async () => {
  for (const name of [
    'brewing-grind-guide.md',
    'faq.md',
    'freshness-storage.md',
    'returns-refunds.md',
    'shipping.md',
    'subscriptions.md',
  ]) {
    for (const chunk of await chunksFor(name)) {
      assert.ok(
        chunk.text.length <= MAX_CHUNK_CHARS,
        `${chunk.id} is ${chunk.text.length} chars, cap is ${MAX_CHUNK_CHARS}`,
      );
    }
  }
});

test('A2: table rows survive chunking intact', async () => {
  const chunks = await chunksFor('brewing-grind-guide.md');
  const original = tableRows(
    parseDocument(await readFile(policyPath('brewing-grind-guide.md'), 'utf8'), 'x').body,
  );
  const chunked = chunks.flatMap((c) => tableRows(c.text));

  for (const row of original) {
    assert.ok(chunked.includes(row), `row survived verbatim: ${row}`);
  }
  for (const row of chunked) {
    assert.ok(row.trimEnd().endsWith('|'), `row is whole, not cut mid-row: ${row}`);
  }
});

test('A2: an over-cap table splits between rows and repeats its header', () => {
  const rows = Array.from({ length: 40 }, (_, i) => `| Destination ${i} | ${i}–${i + 2} business days |`);
  const body = ['# Doc', '', '## Transit times', '', '| Destination | Standard |', '|---|---|', ...rows].join('\n');

  const chunks = chunkDocument(
    { docId: 'synthetic', title: 'Doc', authority: 'canonical', body },
    400,
  );

  assert.ok(chunks.length > 1, 'the table was split');
  for (const chunk of chunks) {
    assert.equal(chunk.heading, 'Transit times');
    assert.ok(chunk.text.includes('| Destination | Standard |'), 'header repeated in every part');
    assert.ok(chunk.text.includes('|---|---|'), 'separator repeated in every part');
    for (const row of tableRows(chunk.text)) {
      assert.match(row, /^\|.*\|$/, `row is whole: ${row}`);
    }
  }

  const emitted = chunks.flatMap((c) => tableRows(c.text)).filter((r) => r.startsWith('| Destination '));
  assert.deepEqual(
    emitted.filter((r) => r !== '| Destination | Standard |'),
    rows,
    'every data row appears exactly once, in order',
  );
});

test('A2: an over-cap prose section splits on sentence boundaries', () => {
  const sentence = 'The roast day moves when a federal holiday lands on it. ';
  const body = `# Doc\n\n## Weather\n\n${sentence.repeat(30).trim()}`;

  const chunks = chunkDocument(
    { docId: 'synthetic', title: 'Doc', authority: 'canonical', body },
    500,
  );

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.text.length <= 500, `${chunk.id} is ${chunk.text.length} chars`);
    assert.ok(chunk.text.startsWith('## Weather'));
  }
});

test('A2: text before the first ## becomes a preamble chunk under the H1', () => {
  const sections = splitSections('# Choosing a Grind\n\nIntro sentence.\n\n## First\n\nBody.', 'Fallback');
  assert.equal(sections.length, 2);
  assert.equal(sections[0]?.heading, 'Choosing a Grind');
  assert.equal(sections[0]?.body, 'Intro sentence.');
  assert.equal(sections[1]?.heading, 'First');
});

test('A2: chunk ids are stable and sequential per document', async () => {
  const chunks = await chunksFor('shipping.md');
  assert.deepEqual(
    chunks.map((c) => c.id),
    chunks.map((_, i) => `shipping#${i}`),
  );
});

test('A2: blocks separate tables from prose', () => {
  const blocks = splitBlocks('Some prose.\n| a | b |\n| c | d |\n\nMore prose.');
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ['text', 'table', 'text'],
  );
});
