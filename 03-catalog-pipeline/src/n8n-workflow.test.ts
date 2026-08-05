import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * T28 — structural validation of `n8n-workflow.json`.
 *
 * ⚠️ What this proves: the file is valid JSON, every node carries the fields n8n
 * requires, and every connection points at a node that exists. What it does NOT
 * prove: that the workflow runs. No n8n instance is available in this
 * environment, so "imports and runs" is asserted only as far as "is a
 * well-formed importable document". That limit is stated in the README too.
 */

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(resolve(here, '../n8n-workflow.json'), 'utf8');

interface Node {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
}
interface Connection {
  node: string;
  type: string;
  index: number;
}
interface Workflow {
  name: string;
  nodes: Node[];
  connections: Record<string, { main: Connection[][] }>;
  settings: Record<string, unknown>;
}

const workflow = JSON.parse(raw) as Workflow;
const nodeNames = new Set(workflow.nodes.map((n) => n.name));

test('T28: the file is valid JSON with the top-level shape n8n expects', () => {
  assert.equal(typeof workflow.name, 'string');
  assert.ok(Array.isArray(workflow.nodes) && workflow.nodes.length > 0);
  assert.equal(typeof workflow.connections, 'object');
  assert.equal(workflow.settings.executionOrder, 'v1');
});

test('T28: every node has id, name, type, typeVersion, position and parameters', () => {
  for (const node of workflow.nodes) {
    assert.equal(typeof node.id, 'string', `${node.name}: id`);
    assert.ok(node.id.length > 0, `${node.name}: empty id`);
    assert.equal(typeof node.name, 'string');
    assert.match(node.type, /^n8n-nodes-base\./, `${node.name}: only core nodes, so it imports on a stock instance`);
    assert.equal(typeof node.typeVersion, 'number', `${node.name}: typeVersion must be a number`);
    assert.ok(Array.isArray(node.position) && node.position.length === 2, `${node.name}: position`);
    assert.ok(node.position.every((n) => typeof n === 'number'), `${node.name}: position must be numbers`);
    assert.equal(typeof node.parameters, 'object', `${node.name}: parameters`);
  }
});

test('T28: node ids and names are unique', () => {
  const ids = workflow.nodes.map((n) => n.id);
  const names = workflow.nodes.map((n) => n.name);
  assert.equal(new Set(ids).size, ids.length, 'duplicate node id');
  assert.equal(new Set(names).size, names.length, 'duplicate node name');
});

test('T28: every connection endpoint names a node that exists', () => {
  for (const [source, outputs] of Object.entries(workflow.connections)) {
    assert.ok(nodeNames.has(source), `connection from unknown node "${source}"`);
    for (const branch of outputs.main) {
      for (const connection of branch) {
        assert.ok(nodeNames.has(connection.node), `connection to unknown node "${connection.node}"`);
        assert.equal(connection.type, 'main');
        assert.equal(typeof connection.index, 'number');
      }
    }
  }
});

test('T28: no orphan nodes — everything except the trigger is reachable', () => {
  const targets = new Set<string>();
  for (const outputs of Object.values(workflow.connections)) {
    for (const branch of outputs.main) for (const c of branch) targets.add(c.node);
  }
  const orphans = workflow.nodes
    .filter((n) => !targets.has(n.name))
    .map((n) => n.name)
    .filter((name) => name !== 'Manual trigger');
  assert.deepEqual(orphans, []);
});

test('T28: the branching nodes have both branches wired', () => {
  const loop = workflow.connections['Loop over products'];
  assert.equal(loop.main.length, 2, 'splitInBatches needs a done branch and a loop branch');
  const ifNode = workflow.connections['Passed every rule?'];
  assert.equal(ifNode.main.length, 2, 'the gate needs a true branch and a false branch');
  assert.equal(ifNode.main[1][0].node, 'Quarantine', 'the false branch must quarantine, not publish');
});

test('T28: the human review gate sits between validation and Shopify', () => {
  assert.equal(workflow.connections['Passed every rule?'].main[0][0].node, 'Human review gate');
  assert.equal(workflow.connections['Human review gate'].main[0][0].node, 'Shopify productUpdate');
  const gate = workflow.nodes.find((n) => n.name === 'Human review gate');
  assert.equal(gate?.type, 'n8n-nodes-base.wait');
  assert.equal(gate?.parameters.resume, 'webhook');
});

test('T28: the model call carries no parameter this model rejects', () => {
  const http = workflow.nodes.find((n) => n.name === 'Anthropic Messages API');
  assert.ok(http);
  const serialized = JSON.stringify(workflow);
  assert.ok(serialized.includes('claude-opus-5'));
  assert.ok(!/"temperature"|"top_p"|"top_k"/.test(serialized), 'those are a 400 on claude-opus-5');
  assert.ok(!/thinking[^}]*disabled/.test(serialized), 'thinking must not be disabled');
});

test('T28: no credential value is committed in the workflow', () => {
  assert.ok(!/sk-ant-|shpat_|shppa_/.test(raw), 'no API key or token may appear in the file');
});

test('T28: the gate is present in the workflow, not just in the TypeScript', () => {
  const validate = workflow.nodes.find((n) => n.name === 'Validate hard rules');
  const code = String(validate?.parameters.jsCode ?? '');
  for (const marker of ['AC-01', 'AC-02', 'AC-06a', 'AC-06b', 'artisanal', 'fair trade', 'ledgerNumbers']) {
    assert.ok(code.includes(marker), `the n8n validator is missing ${marker}`);
  }
});
