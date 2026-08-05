/**
 * The tool schemas are a transcription of `specs/contracts/tools.md`. This test
 * parses that document and deep-equals every schema block against what the code
 * exports, so the contract and the implementation cannot drift without a red
 * test — which is the only version of "the spec is binding" that survives
 * contact with a deadline.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { TOOL_DEFINITIONS, type ToolDefinition } from "./definitions.ts";

const CONTRACT_PATH = fileURLToPath(new URL("../../specs/contracts/tools.md", import.meta.url));

/** Every fenced json block in the contract that declares a tool. */
function toolSchemasFromContract(): ToolDefinition[] {
  const markdown = readFileSync(CONTRACT_PATH, "utf8");
  const blocks = markdown.matchAll(/```json\n([\s\S]*?)```/g);

  const tools: ToolDefinition[] = [];
  for (const [, body] of blocks) {
    const parsed = JSON.parse(body!) as Record<string, unknown>;
    if (typeof parsed["name"] === "string" && parsed["input_schema"]) {
      tools.push(parsed as unknown as ToolDefinition);
    }
  }
  return tools;
}

test("the contract declares exactly three tools", () => {
  const fromContract = toolSchemasFromContract();
  assert.equal(fromContract.length, 3);
  assert.deepEqual(
    fromContract.map((t) => t.name),
    ["lookup_order", "search_help_center", "escalate_to_human"],
  );
});

test("every exported schema is byte-identical to the contract", () => {
  const fromContract = toolSchemasFromContract();

  for (const expected of fromContract) {
    const actual = TOOL_DEFINITIONS.find((t) => t.name === expected.name);
    assert.ok(actual, `${expected.name} is declared in the contract but not exported`);
    assert.deepEqual(actual, expected, `${expected.name} has drifted from contracts/tools.md`);
  }
});

test("the exported set adds nothing the contract doesn't declare", () => {
  // "Deliberately absent" in the contract is a design decision, not an
  // oversight: no issue_refund, no cancel_order, no send_email. v1 is read-only.
  const declared = new Set(toolSchemasFromContract().map((t) => t.name));
  for (const tool of TOOL_DEFINITIONS) {
    assert.ok(declared.has(tool.name), `${tool.name} is exported but not in the contract`);
  }
  assert.equal(TOOL_DEFINITIONS.length, declared.size);
});

test("every description says when to call the tool, not just what it does", () => {
  // Trigger conditions in the description are what move the should-call rate.
  for (const tool of TOOL_DEFINITIONS) {
    assert.match(
      tool.description,
      /\bcall (this|it)\b/i,
      `${tool.name} never tells the model when to call it`,
    );
    assert.ok(tool.description.length > 200, `${tool.name}'s description is too thin to steer on`);
  }
});

test("no schema accepts a field it didn't ask for", () => {
  for (const tool of TOOL_DEFINITIONS) {
    assert.equal(tool.input_schema.additionalProperties, false, tool.name);
    assert.equal(tool.input_schema.type, "object", tool.name);
  }
});

test("escalate_to_human's category enum matches the escalation machine's vocabulary", () => {
  const escalate = TOOL_DEFINITIONS.find((t) => t.name === "escalate_to_human");
  assert.deepEqual(escalate?.input_schema.properties["category"]?.enum, [
    "no_supporting_document",
    "money_commitment",
    "wholesale",
    "press_or_partnership",
    "legal_or_dispute",
    "medical",
    "customer_requested",
    "outside_policy_window",
    "other",
  ]);
  assert.deepEqual(escalate?.input_schema.required, ["category", "summary"]);
});

test("lookup_order requires neither field, so the model can search by either", () => {
  const lookup = TOOL_DEFINITIONS.find((t) => t.name === "lookup_order");
  assert.equal(lookup?.input_schema.required, undefined);
  assert.deepEqual(Object.keys(lookup?.input_schema.properties ?? {}), ["order_number", "email"]);
});

test("the render order is stable, because the cache prefix depends on it", () => {
  // plan.md §4: tools → system → messages, everything static before the
  // cache_control breakpoint. A reordered tool array is a silent cache miss.
  assert.deepEqual(
    TOOL_DEFINITIONS.map((t) => t.name),
    ["lookup_order", "search_help_center", "escalate_to_human"],
  );
  assert.equal(
    JSON.stringify(TOOL_DEFINITIONS),
    JSON.stringify(TOOL_DEFINITIONS),
    "serialisation must be stable",
  );
});
