/**
 * Dependency assembly — the single reconciliation point between the four modules.
 *
 * Retrieval, tools and escalation were built independently against the contracts
 * in `specs/`, which is what let them be built in parallel. Their interfaces don't
 * line up perfectly, and that's fine: adapting them belongs in one file, not
 * smeared across the agent loop. If a signature changes, this is the only place
 * that has to know.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

import { HelpCenterIndex } from '../src/retrieval/search.ts';
import { TOOL_DEFINITIONS, createLookupOrder, createDefaultOrderSource } from '../src/tools/index.ts';
import { createSearchHelpCenter } from '../src/tools/search-help-center.ts';
import { runEscalation } from '../src/escalation/index.ts';
import type { RetrievedChunk, IndexFile } from '../src/types.ts';
import type { OrderEnvelope } from '../src/tools/types.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..');

export async function loadIndex(): Promise<IndexFile> {
  const raw = await readFile(path.join(ROOT, 'data', 'index.json'), 'utf8');
  return JSON.parse(raw) as IndexFile;
}

export interface Wired {
  client: Anthropic;
  tools: Anthropic.Tool[];
  retrieve: (query: string) => Promise<{ chunks: RetrievedChunk[]; belowFloor: boolean }>;
  /** Doc ids actually placed in context — the grader needs this to catch fabricated citations. */
  lastRetrievedDocIds: () => string[];
  executeTool: (name: string, input: unknown) => Promise<unknown>;
  evaluateEscalation: (ctx: {
    question: string;
    answer: string;
    toolResults: { name: string; result: unknown }[];
    belowFloor: boolean;
  }) => { escalate: boolean; reason: string | null; ticketId: string; tellCustomer: string } | null;
}

export async function wire(todayISO: string): Promise<Wired> {
  const index = new HelpCenterIndex(await loadIndex());

  let lastDocIds: string[] = [];

  const retrieve = async (query: string) => {
    const result = await index.search(query);
    lastDocIds = [...new Set(result.chunks.map((c) => c.docId))];
    return { chunks: result.chunks, belowFloor: result.belowFloor };
  };

  const lookupOrder = createLookupOrder({ source: createDefaultOrderSource(process.env) });
  const searchHelpCenter = createSearchHelpCenter(async (query: string) => {
    const r = await index.search(query, { topK: 4 });
    return r.chunks;
  });

  // Captured so the escalation evaluator can see the order without re-fetching it.
  let lastOrder: OrderEnvelope | null = null;
  let lastModelEscalation: { category: string; summary: string } | null = null;

  const executeTool = async (name: string, input: unknown): Promise<unknown> => {
    switch (name) {
      case 'lookup_order': {
        const r = await lookupOrder(input as never);
        if (r.found) lastOrder = r as unknown as OrderEnvelope;
        return r;
      }
      case 'search_help_center': {
        const r = await searchHelpCenter(input as never);
        for (const c of (r as { results?: { doc_id: string }[] }).results ?? []) {
          if (!lastDocIds.includes(c.doc_id)) lastDocIds.push(c.doc_id);
        }
        return r;
      }
      case 'escalate_to_human': {
        // Recorded, not executed here. The deterministic evaluator below owns the
        // decision and issues the one real ticket — otherwise a turn where the
        // model escalates AND a rule fires would file two.
        lastModelEscalation = input as { category: string; summary: string };
        return { acknowledged: true };
      }
      default:
        throw new Error(`unknown tool: ${name}`);
    }
  };

  const evaluateEscalation: Wired['evaluateEscalation'] = ({ question, belowFloor }) => {
    const { decision, handoff } = runEscalation({
      message: question,
      retrievedChunks: lastDocIds.map((docId) => ({ docId })),
      belowRelevanceFloor: belowFloor,
      order: lastOrder,
      modelEscalation: lastModelEscalation as never,
      today: todayISO,
    });

    if (!decision.escalate || !handoff) return null;

    return {
      escalate: true,
      reason: decision.reason ?? decision.category ?? 'escalated',
      ticketId: handoff.ticket_id,
      tellCustomer: handoff.tell_customer,
    };
  };

  return {
    client: new Anthropic(),
    tools: TOOL_DEFINITIONS as unknown as Anthropic.Tool[],
    retrieve,
    lastRetrievedDocIds: () => [...lastDocIds],
    executeTool,
    evaluateEscalation,
  };
}
