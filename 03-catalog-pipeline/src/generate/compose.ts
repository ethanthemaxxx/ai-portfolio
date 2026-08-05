/**
 * A length-constrained assembler (plan.md D4).
 *
 * Meta descriptions have to land in a 20-character window. A fixed template
 * cannot do that across products whose fact density varies from 3 facts (a gift
 * card) to 15 (a coffee). Padding to length is exactly where fabrication gets
 * in, so instead of stretching a sentence we search for a combination of
 * fragments — each of which is already true and already short enough — that
 * lands in range.
 *
 * If no combination fits, this returns a failure. It never invents a clause and
 * never truncates mid-claim.
 */

export interface Fragment {
  text: string;
  /** Ledger entry ids this fragment draws on. */
  factIds: string[];
}

export type ComposeResult =
  | { ok: true; text: string; fragments: Fragment[]; factIds: string[] }
  | { ok: false; reason: string };

export interface ComposeOptions {
  min: number;
  max: number;
  joiner?: string;
  /** Extra constraint the assembled text must satisfy (e.g. second person). */
  accept?: (text: string) => boolean;
}

const MAX_FRAGMENTS = 16;

/**
 * Deterministic: subsets are enumerated in a fixed order and the winner is the
 * one whose fragment indices are lexicographically smallest, which means "keep
 * the highest-priority fragments". Same input, same output, every run.
 */
export function composeInRange(fragments: Fragment[], options: ComposeOptions): ComposeResult {
  const { min, max, joiner = ' ', accept } = options;
  const usable = fragments.filter((f) => f.text.trim().length > 0);
  if (usable.length > MAX_FRAGMENTS) {
    throw new Error(
      `composeInRange received ${usable.length} fragments; the cap is ${MAX_FRAGMENTS} (2^n search)`,
    );
  }

  let best: { indices: number[]; text: string } | null = null;

  for (let mask = 1; mask < 1 << usable.length; mask += 1) {
    const indices: number[] = [];
    for (let i = 0; i < usable.length; i += 1) {
      if (mask & (1 << i)) indices.push(i);
    }
    const text = indices.map((i) => usable[i].text).join(joiner);
    if (text.length < min || text.length > max) continue;
    if (accept && !accept(text)) continue;
    if (best === null || lexicographicallySmaller(indices, best.indices)) {
      best = { indices, text };
    }
  }

  if (best === null) {
    const total = usable.map((f) => f.text.length).reduce((a, b) => a + b, 0);
    return {
      ok: false,
      reason:
        `no combination of ${usable.length} true fragments lands in ${min}-${max} characters ` +
        `(total available: ${total})`,
    };
  }

  const chosen = best.indices.map((i) => usable[i]);
  return {
    ok: true,
    text: best.text,
    fragments: chosen,
    factIds: [...new Set(chosen.flatMap((f) => f.factIds))],
  };
}

function lexicographicallySmaller(a: number[], b: number[]): boolean {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return a.length < b.length;
}

/**
 * Greedy fit for a single-line surface (the meta title): join the parts, and if
 * that is too long, drop parts from the end until it fits. Returns the longest
 * prefix that fits, or the truncated first part as a last resort.
 */
export function fitParts(parts: string[], max: number, joiner = ' — '): string {
  const usable = parts.filter((p) => p.trim().length > 0);
  for (let count = usable.length; count > 0; count -= 1) {
    const candidate = usable.slice(0, count).join(joiner);
    if (candidate.length <= max) return candidate;
  }
  return (usable[0] ?? '').slice(0, max).trim();
}
