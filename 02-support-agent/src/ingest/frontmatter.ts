/**
 * A1 — split a policy markdown file into frontmatter + body.
 *
 * The corpus uses a flat `key: value` block between `---` fences. That is a strict
 * subset of YAML, so we parse it directly rather than take a YAML dependency for
 * six files with five keys each. If the corpus ever grows nested values, replace
 * this file — not the callers.
 */

import type { Authority, PolicyDoc } from '../types.ts';

const FENCE = /^---[ \t]*$/;
const AUTHORITIES = new Set<string>(['canonical', 'informational']);

/** Parsed `key: value` pairs, unmapped. Keys keep their original names. */
export function parseFrontmatter(source: string): {
  fields: Record<string, string>;
  body: string;
} {
  const text = source.replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  if (lines[0] === undefined || !FENCE.test(lines[0])) {
    return { fields: {}, body: text.trim() };
  }

  const closing = lines.findIndex((line, i) => i > 0 && FENCE.test(line));
  if (closing === -1) {
    // An opening fence with no closing one is corrupt, not "a document with no
    // frontmatter" — say so instead of silently indexing the metadata as prose.
    throw new Error('Unterminated frontmatter block: opening --- has no closing ---');
  }

  const fields: Record<string, string> = {};
  for (const line of lines.slice(1, closing)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const colon = trimmed.indexOf(':');
    if (colon === -1) {
      throw new Error(`Malformed frontmatter line (no colon): ${trimmed}`);
    }
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    fields[key] = stripQuotes(value);
  }

  return { fields, body: lines.slice(closing + 1).join('\n').trim() };
}

function stripQuotes(value: string): string {
  const quoted =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));
  return quoted && value.length >= 2 ? value.slice(1, -1) : value;
}

/** The first `# H1` in a body, if there is one. Used as a title fallback. */
export function firstHeading(body: string): string | null {
  for (const line of body.split('\n')) {
    const match = /^#\s+(.+?)\s*$/.exec(line);
    if (match?.[1] !== undefined) return match[1];
  }
  return null;
}

/**
 * Turn a raw markdown file into a document.
 *
 * `sourcePath` doubles as the doc_id fallback: brand.md carries no frontmatter,
 * and defaulting it to `informational` is deliberate — it is voice guidance, not
 * policy, and must lose to a canonical page in a contradiction (spec.md Q2).
 */
export function parseDocument(source: string, sourcePath: string): PolicyDoc {
  const { fields, body } = parseFrontmatter(source);
  const filename = sourcePath.split('/').pop() ?? sourcePath;
  const fallbackId = filename.replace(/\.md$/, '');

  const authorityValue = fields['authority'] ?? 'informational';
  if (!AUTHORITIES.has(authorityValue)) {
    throw new Error(
      `${filename}: authority must be 'canonical' or 'informational', got '${authorityValue}'`,
    );
  }

  return {
    docId: fields['doc_id'] ?? fallbackId,
    title: fields['title'] ?? firstHeading(body) ?? fallbackId,
    category: fields['category'] ?? 'uncategorised',
    lastUpdated: fields['last_updated'] ?? null,
    authority: authorityValue as Authority,
    body,
    sourcePath,
  };
}
