/**
 * C4/C5 — the `lookup_order` tool.
 *
 * Thin on purpose. It resolves an identifier, asks an `OrderSource` for the raw
 * record, and hands it to the envelope mapper. Everything interesting — the
 * privacy allowlist, the tracking derivation, the policy arithmetic — happens in
 * `order-envelope.ts`, once, for both adapters.
 *
 * **It never throws.** A tool that throws leaves the model with no way to
 * recover and ask the customer for a corrected number (contracts/tools.md §1),
 * so every failure comes back as a shaped result the model can read.
 */

import { toOrderEnvelope, toWire, type OrderEnvelopeWire } from "./order-envelope.ts";
import { createFixtureOrderSource } from "./fixture-order-source.ts";
import { createShopifyOrderSource } from "./shopify-order-source.ts";
import type { OrderSource } from "./order-source.ts";

export type LookupOrderInput = {
  order_number?: string | undefined;
  email?: string | undefined;
};

export type LookupOrderNotFound = {
  found: false;
  /**
   * - `no_match` — the identifier is well-formed, no such order. The documented case.
   * - `missing_identifier` — called with neither field; the model should ask.
   * - `lookup_failed` — the store could not be reached. Distinct from `no_match`
   *   on purpose: "I couldn't check" and "that order doesn't exist" are different
   *   sentences, and telling a customer the second when the first is true is the
   *   kind of confident wrongness spec §B1 exists to prevent.
   */
  reason: "no_match" | "missing_identifier" | "lookup_failed";
};

export type LookupOrderResult = OrderEnvelopeWire | LookupOrderNotFound;

export type LookupOrderDeps = {
  source: OrderSource;
  today?: string | undefined;
  holidays?: ReadonlySet<string> | undefined;
};

export function createLookupOrder(
  deps: LookupOrderDeps,
): (input: LookupOrderInput) => Promise<LookupOrderResult> {
  return async function lookupOrder(input: LookupOrderInput): Promise<LookupOrderResult> {
    const orderNumber = input.order_number?.trim();
    const email = input.email?.trim();

    if (!orderNumber && !email) {
      return { found: false, reason: "missing_identifier" };
    }

    let raw;
    try {
      raw = await deps.source.find({ orderNumber, email });
    } catch {
      return { found: false, reason: "lookup_failed" };
    }

    if (!raw) return { found: false, reason: "no_match" };

    return toWire(toOrderEnvelope(raw, { today: deps.today, holidays: deps.holidays }));
  };
}

export class OrderSourceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderSourceConfigError";
  }
}

/**
 * Adapter selection: `SHOPIFY_ADMIN_TOKEN` set means live, absent means fixtures.
 * One env var is the whole switch (plan.md §10).
 *
 * A token with no shop domain is a configuration error, not a reason to quietly
 * serve fixtures — demoing synthetic orders while believing they're real is a
 * worse failure than not starting.
 */
export function createDefaultOrderSource(
  env: Record<string, string | undefined> = process.env,
): OrderSource {
  const accessToken = env["SHOPIFY_ADMIN_TOKEN"];
  if (!accessToken) return createFixtureOrderSource();

  const shop = env["SHOPIFY_SHOP_DOMAIN"] ?? env["SHOPIFY_SHOP"];
  if (!shop) {
    throw new OrderSourceConfigError(
      "SHOPIFY_ADMIN_TOKEN is set but SHOPIFY_SHOP_DOMAIN is not. Set both to use live " +
        "orders, or unset the token to run on fixtures.",
    );
  }

  const config: { shop: string; accessToken: string; apiVersion?: string } = { shop, accessToken };
  const apiVersion = env["SHOPIFY_API_VERSION"];
  if (apiVersion) config.apiVersion = apiVersion;

  return createShopifyOrderSource(config);
}
