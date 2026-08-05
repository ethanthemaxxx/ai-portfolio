import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from '../catalog.ts';
import { loadExemplars } from '../brand/exemplars.ts';
import { extractStyleGuide } from '../brand/voice-extract.ts';
import { buildFactLedger } from '../ledger/fact-ledger.ts';
import {
  AnthropicGeneratorError,
  createAnthropicGenerator,
  type MessageLike,
  type MessagesClient,
} from './anthropic.ts';
import { buildRequest, buildSystemPrompt, MODEL, type MessageRequest } from './prompt.ts';
import type { GenerationRequest } from './types.ts';

const product = loadCatalog().find((p) => p.handle === 'huila-reserve')!;
const styleGuide = extractStyleGuide(loadExemplars(), { locale: 'en' });
const request: GenerationRequest = {
  product,
  ledger: buildFactLedger(product),
  styleGuide,
  locale: 'en',
  anchorDate: '2026-08-04',
};

function fakeClient(reply: MessageLike | (() => MessageLike)) {
  const calls: MessageRequest[] = [];
  const client: MessagesClient = {
    messages: {
      async create(params) {
        calls.push(params);
        return typeof reply === 'function' ? reply() : reply;
      },
    },
  };
  return { client, calls };
}

const goodJson = JSON.stringify({
  bodyHtml: '<p>Huila Reserve tastes like ripe plum.</p>',
  metaTitle: 'Huila Reserve',
  metaDescription: 'x'.repeat(150),
  imageAlt: 'Cerro Alto Huila Reserve coffee bag, 250g, whole bean',
  claims: [
    { text: 'tastes like ripe plum', factId: 'huila-reserve:attributes.tasting_notes[0]' },
    { text: 'tastes like ripe plum', factId: 'huila-reserve:attributes.tasting_notes[0]' },
  ],
});

test('T19: the request never carries a parameter this model rejects', () => {
  const params = buildRequest(request) as unknown as Record<string, unknown>;
  assert.equal(params.model, MODEL);
  assert.equal(params.model, 'claude-opus-5');
  for (const forbidden of ['temperature', 'top_p', 'top_k']) {
    assert.ok(!(forbidden in params), `${forbidden} is a 400 on this model`);
  }
  assert.deepEqual(params.thinking, { type: 'adaptive' }, 'thinking must not be disabled');
});

test('T19: the prompt carries the ledger and no fact outside it', () => {
  const message = buildRequest(request).messages[0].content;
  assert.ok(message.includes('1750'), 'the altitude fact must be in the prompt');
  assert.ok(message.includes('attributes.altitude_masl'), 'with its source path');
  assert.ok(message.includes('huila-reserve:attributes.origin'));
  assert.ok(!/2,?100/.test(message), 'no figure that is not in the ledger');
});

test('T19: the system prompt teaches with counterexamples', () => {
  const system = buildSystemPrompt('en', styleGuide);
  assert.ok(system.includes('violation: invented fact'));
  assert.ok(system.includes('violation: implied certification'));
  assert.ok(system.includes(`${styleGuide.constraints.maxSentenceWords} words`));
  assert.ok(system.includes('not Fair Trade'));
});

test('T19: structured output is requested, not hoped for', () => {
  const params = buildRequest(request);
  assert.equal(params.output_config.format.type, 'json_schema');
  const schema = params.output_config.format.schema as { required: string[] };
  assert.deepEqual(schema.required.sort(), [
    'bodyHtml',
    'claims',
    'imageAlt',
    'metaDescription',
    'metaTitle',
  ]);
});

test('T20: a well-formed reply becomes copy, with the model’s claims recorded', async () => {
  const { client, calls } = fakeClient({ content: [{ type: 'text', text: goodJson }] });
  const result = await createAnthropicGenerator(client).generate(request);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.copy.generator, 'anthropic-claude-opus-5');
  assert.deepEqual(result.copy.usedFactIds, ['huila-reserve:attributes.tasting_notes[0]']);
  assert.equal(result.copy.modelClaims?.length, 2);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, 'claude-opus-5');
});

test('T20: malformed JSON throws a typed error rather than shipping garbage', async () => {
  const { client } = fakeClient({ content: [{ type: 'text', text: 'Sure! Here is the copy:' }] });
  await assert.rejects(
    () => createAnthropicGenerator(client).generate(request),
    AnthropicGeneratorError,
  );
});

test('T20: a missing field throws', async () => {
  const { client } = fakeClient({
    content: [{ type: 'text', text: JSON.stringify({ bodyHtml: '<p>x</p>' }) }],
  });
  await assert.rejects(
    () => createAnthropicGenerator(client).generate(request),
    /missing "metaTitle"/,
  );
});

test('T20: a refusal is reported, not retried blindly', async () => {
  const { client } = fakeClient({ content: [], stop_reason: 'refusal' });
  const result = await createAnthropicGenerator(client).generate(request);
  assert.equal(result.ok, false);
});

test('T20: a repair call carries the violations and the rejected attempt', async () => {
  const { client, calls } = fakeClient({ content: [{ type: 'text', text: goodJson }] });
  await createAnthropicGenerator(client).generate({
    ...request,
    previousViolations: [
      {
        ruleId: 'AC-01',
        field: 'bodyHtml',
        message: 'banned brand word "artisanal"',
        evidence: 'an artisanal cup',
        offset: 3,
      },
    ],
    previousCopy: {
      handle: 'huila-reserve',
      locale: 'en',
      bodyHtml: '<p>an artisanal cup</p>',
      metaTitle: '',
      metaDescription: '',
      imageAlt: '',
      generator: 'anthropic-claude-opus-5',
      usedFactIds: [],
    },
  });
  const content = calls[0].messages[0].content;
  assert.ok(content.includes('<violations>'));
  assert.ok(content.includes('banned brand word'));
  assert.ok(content.includes('Fix exactly these violations'));
});

test('T20: the module loads with no SDK installed and no key set', () => {
  assert.equal(typeof createAnthropicGenerator, 'function');
  assert.equal(createAnthropicGenerator({ messages: { create: async () => ({ content: [] }) } }).canRepair, true);
});
