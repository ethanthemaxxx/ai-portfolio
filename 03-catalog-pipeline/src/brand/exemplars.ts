import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { VoiceExemplar } from '../types.ts';

const here = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_EXEMPLAR_PATH = resolve(here, '../../data/voice-exemplars.json');

export class ExemplarError extends Error {}

export function loadExemplars(path: string = DEFAULT_EXEMPLAR_PATH): VoiceExemplar[] {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { exemplars?: unknown };
  const list = parsed.exemplars;
  if (!Array.isArray(list) || list.length === 0) {
    throw new ExemplarError('voice-exemplars.json must contain a non-empty `exemplars` array');
  }
  for (const item of list) {
    const e = item as Partial<VoiceExemplar>;
    if (!e.id || !e.body || !e.kind) {
      throw new ExemplarError(`exemplar is missing id, kind or body: ${JSON.stringify(item)}`);
    }
  }
  return list as VoiceExemplar[];
}
