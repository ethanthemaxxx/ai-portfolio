import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from '../catalog.ts';
import { loadExemplars } from '../brand/exemplars.ts';
import { extractStyleGuide } from '../brand/voice-extract.ts';
import { offlineGenerator } from '../generate/offline.ts';
import { runPipeline } from '../pipeline.ts';
import { ShopifyClient, ShopifyError, type Transport, type TransportRequest } from './client.ts';
import { assertPushConfigured, pushApproved } from './push.ts';
import {
  approvedHandles,
  buildReviewQueue,
  loadReviewQueue,
  renderReviewQueueMarkdown,
} from './review-queue.ts';
import type { RunReport } from '../types.ts';

const products = loadCatalog();
const styleGuide = extractStyleGuide(loadExemplars(), { locale: 'en' });

let cached: RunReport | null = null;
async function report(): Promise<RunReport> {
  if (cached === null) {
    cached = await runPipeline({
      products,
      generator: offlineGenerator,
      styleGuide,
      locale: 'en',
      anchorDate: '2026-08-04',
    });
  }
  return cached;
}

function recordingTransport(status = 200, json: unknown = { data: { productUpdate: { userErrors: [] }, fileUpdate: { userErrors: [] } } }) {
  const calls: Array<{ url: string; init: TransportRequest }> = [];
  const transport: Transport = async (url, init) => {
    calls.push({ url, init });
    return { status, json };
  };
  return { transport, calls };
}

/* ------------------------------------------------------------- review queue */

test('T24: a freshly built queue approves nothing', async () => {
  const queue = buildReviewQueue(await report());
  assert.equal(queue.entries.length, 12);
  assert.deepEqual(approvedHandles(queue), []);
  for (const entry of queue.entries) {
    assert.equal(entry.approved, false);
    assert.equal(entry.approvedBy, null);
  }
});

test('T24: unknown handles in an edited queue are reported, not ignored', async () => {
  const queue = buildReviewQueue(await report());
  queue.entries.push({
    handle: 'not-a-product',
    title: 'Ghost',
    approved: true,
    approvedBy: 'someone',
    status: 'publishable',
    note: '',
  });
  const loaded = loadReviewQueue(JSON.stringify(queue), products.map((p) => p.handle));
  assert.deepEqual(loaded.unknownHandles, ['not-a-product']);
});

test('T24: the markdown queue is readable and states the re-validation rule', async () => {
  const run = await report();
  const markdown = renderReviewQueueMarkdown(buildReviewQueue(run), run);
  assert.ok(markdown.includes('Huila Reserve'));
  assert.ok(markdown.includes('re-runs the full validation'));
});

/* ----------------------------------------------------------------- client */

test('T25: a successful update issues exactly one POST with the expected shape', async () => {
  const { transport, calls } = recordingTransport();
  const client = new ShopifyClient(
    { shop: 'cerro-alto.myshopify.com', accessToken: 'shpat_test' },
    transport,
  );
  await client.productUpdate({
    id: 'gid://shopify/Product/1',
    descriptionHtml: '<p>x</p>',
    seo: { title: 't', description: 'd' },
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /cerro-alto\.myshopify\.com\/admin\/api\/\d{4}-\d{2}\/graphql\.json/);
  assert.equal(calls[0].init.headers['X-Shopify-Access-Token'], 'shpat_test');
  const body = JSON.parse(calls[0].init.body) as { query: string; variables: Record<string, unknown> };
  assert.match(body.query, /mutation productUpdate/);
  assert.deepEqual((body.variables.input as { id: string }).id, 'gid://shopify/Product/1');
});

test('T25: userErrors and non-200 both throw', async () => {
  const client = (json: unknown, status = 200) =>
    new ShopifyClient(
      { shop: 's.myshopify.com', accessToken: 't' },
      recordingTransport(status, json).transport,
    );
  await assert.rejects(
    () =>
      client({ data: { productUpdate: { userErrors: [{ field: ['seo'], message: 'too long' }] } } })
        .productUpdate({ id: 'x', descriptionHtml: '', seo: { title: '', description: '' } }),
    ShopifyError,
  );
  await assert.rejects(
    () => client({}, 401).productUpdate({ id: 'x', descriptionHtml: '', seo: { title: '', description: '' } }),
    /HTTP 401/,
  );
});

test('T25: constructing without credentials throws before any call', () => {
  const { transport, calls } = recordingTransport();
  assert.throws(() => new ShopifyClient({ shop: '', accessToken: 't' }, transport), ShopifyError);
  assert.throws(() => new ShopifyClient({ shop: 's', accessToken: '' }, transport), ShopifyError);
  assert.equal(calls.length, 0);
});

/* ------------------------------------------------------------- push gate */

test('AC-11: an unapproved product produces ZERO transport calls', async () => {
  const run = await report();
  const { transport, calls } = recordingTransport();
  const outcomes = await pushApproved({
    report: run,
    queue: buildReviewQueue(run),
    products,
    styleGuide,
    locale: 'en',
    client: new ShopifyClient({ shop: 's.myshopify.com', accessToken: 't' }, transport),
    productIds: Object.fromEntries(products.map((p) => [p.handle, `gid://shopify/Product/${p.handle}`])),
  });
  assert.equal(calls.length, 0);
  assert.equal(outcomes.filter((o) => o.pushed).length, 0);
  assert.ok(outcomes.every((o) => o.reason === 'not approved by a human'));
});

test('AC-11: an approved product whose copy now fails a rule produces ZERO calls', async () => {
  const run = structuredClone(await report());
  // Simulate a rule change (or a hand-edit) that invalidates already-approved copy.
  const target = run.products.find((p) => p.handle === 'huila-reserve')!;
  target.copy!.metaTitle = 'An artisanal, curated Huila Reserve';

  const queue = buildReviewQueue(run);
  queue.entries.find((e) => e.handle === 'huila-reserve')!.approved = true;

  const { transport, calls } = recordingTransport();
  const outcomes = await pushApproved({
    report: run,
    queue,
    products,
    styleGuide,
    locale: 'en',
    client: new ShopifyClient({ shop: 's.myshopify.com', accessToken: 't' }, transport),
    productIds: { 'huila-reserve': 'gid://shopify/Product/1' },
  });
  assert.equal(calls.length, 0, 'approval is not a bypass');
  const outcome = outcomes.find((o) => o.handle === 'huila-reserve')!;
  assert.equal(outcome.pushed, false);
  assert.match(outcome.reason ?? '', /fails validation now: AC-01/);
});

test('AC-11: an approved, valid product pushes exactly the expected calls', async () => {
  const run = await report();
  const queue = buildReviewQueue(run);
  queue.entries.find((e) => e.handle === 'huila-reserve')!.approved = true;

  const { transport, calls } = recordingTransport();
  const outcomes = await pushApproved({
    report: run,
    queue,
    products,
    styleGuide,
    locale: 'en',
    client: new ShopifyClient({ shop: 's.myshopify.com', accessToken: 't' }, transport),
    productIds: { 'huila-reserve': 'gid://shopify/Product/1' },
    imageIds: { 'huila-reserve': 'gid://shopify/MediaImage/9' },
  });
  assert.equal(calls.length, 2, 'one productUpdate, one fileUpdate');
  assert.match(JSON.parse(calls[0].init.body).query, /productUpdate/);
  assert.match(JSON.parse(calls[1].init.body).query, /fileUpdate/);
  assert.equal(outcomes.find((o) => o.handle === 'huila-reserve')?.pushed, true);
});

test('AC-11: an approved product with no Shopify id mapped is skipped, not guessed at', async () => {
  const run = await report();
  const queue = buildReviewQueue(run);
  queue.entries.find((e) => e.handle === 'casa-blend')!.approved = true;
  const { transport, calls } = recordingTransport();
  const outcomes = await pushApproved({
    report: run,
    queue,
    products,
    styleGuide,
    locale: 'en',
    client: new ShopifyClient({ shop: 's.myshopify.com', accessToken: 't' }, transport),
    productIds: {},
  });
  assert.equal(calls.length, 0);
  assert.match(outcomes.find((o) => o.handle === 'casa-blend')?.reason ?? '', /no Shopify product id/);
});

test('AC-11: with no credentials configured, the run refuses before any transport exists', () => {
  assert.throws(() => assertPushConfigured({}), /must both be set to push/);
  assert.throws(() => assertPushConfigured({ SHOPIFY_SHOP: 's' }), /Nothing was sent/);
  assert.deepEqual(
    assertPushConfigured({ SHOPIFY_SHOP: 's', SHOPIFY_ACCESS_TOKEN: 't' }),
    { shop: 's', accessToken: 't' },
  );
});
