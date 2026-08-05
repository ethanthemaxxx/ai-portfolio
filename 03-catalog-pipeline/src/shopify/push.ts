import type { Locale, Product, RunReport, StyleGuide } from '../types.ts';
import { buildFactLedger } from '../ledger/fact-ledger.ts';
import { validateCopy } from '../validate/rules.ts';
import type { ShopifyClient } from './client.ts';
import { approvedHandles, type ReviewQueue } from './review-queue.ts';

/**
 * The push gate (spec.md AC-11).
 *
 * Two conditions, both required, checked in this order: a human approved it, and
 * the copy passes every rule *right now*. Re-validating at push time means the
 * gate holds even when the queue file is stale or was hand-edited.
 */

export interface PushOptions {
  report: RunReport;
  queue: ReviewQueue;
  products: Product[];
  styleGuide: StyleGuide;
  locale: Locale;
  client: ShopifyClient;
  /** Shopify gid per handle. Absent for a product the merchant has not mapped. */
  productIds: Record<string, string>;
  imageIds?: Record<string, string>;
}

export interface PushOutcome {
  handle: string;
  pushed: boolean;
  reason?: string;
  calls: number;
}

export async function pushApproved(options: PushOptions): Promise<PushOutcome[]> {
  const { report, queue, products, styleGuide, locale, client, productIds, imageIds = {} } = options;
  const approved = new Set(approvedHandles(queue));
  const productByHandle = new Map(products.map((p) => [p.handle, p]));
  const outcomes: PushOutcome[] = [];

  for (const result of report.products) {
    if (!approved.has(result.handle)) {
      outcomes.push({ handle: result.handle, pushed: false, reason: 'not approved by a human', calls: 0 });
      continue;
    }
    if (result.status !== 'publishable' || result.copy === null) {
      outcomes.push({
        handle: result.handle,
        pushed: false,
        reason: `approved, but quarantined by ${result.violations.map((v) => v.ruleId).join(', ')}`,
        calls: 0,
      });
      continue;
    }

    // Re-validate. An approval is not a bypass.
    const product = productByHandle.get(result.handle);
    if (!product) {
      outcomes.push({ handle: result.handle, pushed: false, reason: 'no such product in this catalog', calls: 0 });
      continue;
    }
    const violations = validateCopy(
      result.copy,
      buildFactLedger(product),
      styleGuide,
      locale,
      product.title,
    );
    if (violations.length > 0) {
      outcomes.push({
        handle: result.handle,
        pushed: false,
        reason: `approved, but fails validation now: ${violations.map((v) => v.ruleId).join(', ')}`,
        calls: 0,
      });
      continue;
    }

    const productId = productIds[result.handle];
    if (!productId) {
      outcomes.push({ handle: result.handle, pushed: false, reason: 'no Shopify product id mapped', calls: 0 });
      continue;
    }

    let calls = 0;
    await client.productUpdate({
      id: productId,
      descriptionHtml: result.copy.bodyHtml,
      seo: { title: result.copy.metaTitle, description: result.copy.metaDescription },
    });
    calls += 1;

    const imageId = imageIds[result.handle];
    if (imageId) {
      await client.fileUpdate([{ id: imageId, alt: result.copy.imageAlt }]);
      calls += 1;
    }
    outcomes.push({ handle: result.handle, pushed: true, calls });
  }

  return outcomes;
}

/** Refuse early and loudly when the run was not configured for a real push. */
export function assertPushConfigured(env: Record<string, string | undefined>): {
  shop: string;
  accessToken: string;
} {
  const shop = env.SHOPIFY_SHOP;
  const accessToken = env.SHOPIFY_ACCESS_TOKEN;
  if (!shop || !accessToken) {
    throw new Error(
      'SHOPIFY_SHOP and SHOPIFY_ACCESS_TOKEN must both be set to push. Nothing was sent.',
    );
  }
  return { shop, accessToken };
}
