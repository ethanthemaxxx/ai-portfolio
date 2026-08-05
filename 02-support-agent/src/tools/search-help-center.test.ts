import { test } from "node:test";
import assert from "node:assert/strict";

import { createSearchHelpCenter, MAX_HELP_CENTER_RESULTS } from "./search-help-center.ts";
import type { Chunk } from "./types.ts";

function chunk(n: number, overrides: Partial<Chunk> = {}): Chunk {
  return {
    id: `returns-refunds#${n}`,
    docId: "returns-refunds",
    title: "Returns & Refunds",
    heading: "If something is wrong with the coffee",
    authority: "canonical",
    text: "We refund or replace, no return needed.",
    ...overrides,
  };
}

test("C6: results carry doc_id and heading, and nothing the model can't cite", async () => {
  const search = createSearchHelpCenter(async () => [chunk(0)]);
  const { results, below_relevance_floor } = await search({ query: "my bag arrived split" });

  assert.equal(below_relevance_floor, false);
  assert.equal(results.length, 1);
  assert.deepEqual(Object.keys(results[0]!).sort(), ["authority", "doc_id", "heading", "text"]);
  assert.equal(results[0]?.doc_id, "returns-refunds");
  assert.equal(results[0]?.heading, "If something is wrong with the coffee");
});

test("C6: results are capped at 4 however many the retriever returns", async () => {
  const many = Array.from({ length: 12 }, (_, i) => chunk(i));
  const search = createSearchHelpCenter(async () => many);

  const { results } = await search({ query: "refund" });
  assert.equal(results.length, MAX_HELP_CENTER_RESULTS);
  assert.equal(MAX_HELP_CENTER_RESULTS, 4);
  // The cap keeps rank order — the retriever decided relevance, not this tool.
  assert.deepEqual(
    results.map((r) => r.text),
    many.slice(0, 4).map((c) => c.text),
  );
});

test("C6: nothing above the floor is reported as below_relevance_floor, not as an empty answer", async () => {
  // contracts/tools.md: this is the signal to escalate, not to answer from
  // pretrained knowledge about coffee or consumer law.
  const search = createSearchHelpCenter(async () => []);
  assert.deepEqual(await search({ query: "what's your wholesale pricing" }), {
    results: [],
    below_relevance_floor: true,
  });
});

test("C6: an empty query never reaches the retriever", async () => {
  let calls = 0;
  const search = createSearchHelpCenter(async () => {
    calls++;
    return [chunk(0)];
  });

  assert.deepEqual(await search({ query: "   " }), { results: [], below_relevance_floor: true });
  assert.equal(calls, 0);
});

test("C6: a broken index degrades to the escalate-safe signal instead of throwing", async () => {
  const search = createSearchHelpCenter(async () => {
    throw new Error("index.json is missing");
  });

  const result = await search({ query: "how long do refunds take" });
  assert.deepEqual(result, { results: [], below_relevance_floor: true });
});

test("C6: the retriever is handed the query verbatim, trimmed", async () => {
  const seen: string[] = [];
  const search = createSearchHelpCenter(async (q) => {
    seen.push(q);
    return [];
  });

  await search({ query: "  can I still change my grind?  " });
  assert.deepEqual(seen, ["can I still change my grind?"]);
});

test("C6: informational chunks keep their authority, so contradictions stay visible", async () => {
  const search = createSearchHelpCenter(async () => [
    chunk(0, { authority: "canonical" }),
    chunk(1, { docId: "faq", authority: "informational" }),
  ]);

  const { results } = await search({ query: "refund window" });
  assert.deepEqual(
    results.map((r) => [r.doc_id, r.authority]),
    [
      ["returns-refunds", "canonical"],
      ["faq", "informational"],
    ],
  );
});
