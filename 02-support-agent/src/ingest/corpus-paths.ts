/**
 * Where the corpus lives. It is owned by `00-brand-demo`, one directory up — this
 * project reads it, it does not vendor a copy, so the policies have exactly one home.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CORPUS_DIR = join(HERE, '..', '..', '..', '00-brand-demo');

export function policyPath(filename: string): string {
  return join(CORPUS_DIR, 'policies', filename);
}
