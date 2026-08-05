import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { firstHeading, parseDocument, parseFrontmatter } from './frontmatter.ts';
import { CORPUS_DIR, policyPath } from './corpus-paths.ts';

// A1 — "Given shipping.md, returns doc_id: 'shipping', authority: 'canonical'"
test('A1: parses shipping.md into frontmatter and body', async () => {
  const path = policyPath('shipping.md');
  const doc = parseDocument(await readFile(path, 'utf8'), path);

  assert.equal(doc.docId, 'shipping');
  assert.equal(doc.authority, 'canonical');
  assert.equal(doc.title, 'Shipping & Delivery');
  assert.equal(doc.category, 'policy');
  assert.equal(doc.lastUpdated, '2026-07-15');

  assert.ok(doc.body.startsWith('# Shipping & Delivery'), 'body starts after the frontmatter');
  assert.ok(!doc.body.includes('doc_id:'), 'frontmatter keys are not left in the body');
});

test('A1: every policy file declares a doc_id and a valid authority', async () => {
  for (const name of [
    'brewing-grind-guide.md',
    'faq.md',
    'freshness-storage.md',
    'returns-refunds.md',
    'shipping.md',
    'subscriptions.md',
  ]) {
    const path = policyPath(name);
    const doc = parseDocument(await readFile(path, 'utf8'), path);
    assert.equal(doc.docId, name.replace('.md', ''), `${name} doc_id`);
    assert.equal(doc.authority, 'canonical', `${name} authority`);
    assert.notEqual(doc.lastUpdated, null, `${name} last_updated`);
  }
});

test('A1: brand.md has no frontmatter, so it falls back to informational', async () => {
  const path = `${CORPUS_DIR}/brand.md`;
  const doc = parseDocument(await readFile(path, 'utf8'), path);

  assert.equal(doc.docId, 'brand');
  assert.equal(doc.title, 'Cerro Alto Coffee — Brand Brief');
  assert.equal(doc.authority, 'informational');
  assert.equal(doc.lastUpdated, null);
});

test('A1: values may contain colons and quotes', () => {
  const { fields, body } = parseFrontmatter(
    ['---', 'title: "Shipping: the whole story"', 'doc_id: shipping', '---', '', 'Body.'].join('\n'),
  );
  assert.equal(fields['title'], 'Shipping: the whole story');
  assert.equal(fields['doc_id'], 'shipping');
  assert.equal(body, 'Body.');
});

test('A1: a corrupt frontmatter block fails loudly instead of becoming prose', () => {
  assert.throws(
    () => parseFrontmatter('---\ndoc_id: shipping\n\nBody without a closing fence.'),
    /Unterminated frontmatter/,
  );
  assert.throws(
    () => parseFrontmatter('---\ndoc_id shipping\n---\nBody.'),
    /Malformed frontmatter line/,
  );
});

test('A1: an unknown authority value is rejected', () => {
  assert.throws(
    () => parseDocument('---\ndoc_id: x\nauthority: probably\n---\nBody.', 'x.md'),
    /authority must be/,
  );
});

test('A1: firstHeading finds the H1 and ignores deeper headings', () => {
  assert.equal(firstHeading('## Section\n\n# Title\n\ntext'), 'Title');
  assert.equal(firstHeading('no headings here'), null);
});
