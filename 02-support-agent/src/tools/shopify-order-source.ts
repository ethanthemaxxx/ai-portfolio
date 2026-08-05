/**
 * C5 — the live adapter: Shopify Admin GraphQL, read-only.
 *
 * Same `OrderSource` interface as the fixtures, so `lookup_order` and the
 * envelope mapper are identical on both paths. The only thing that changes is
 * where the raw record comes from — which means the privacy allowlist and every
 * policy derivation are tested once and hold for both.
 *
 * **Read-only by construction.** There is one GraphQL document in this file, it
 * is a `query`, and `assertReadOnly` refuses to send anything containing a
 * mutation. That is belt-and-braces on top of the read-only access scopes on the
 * token itself (plan.md §10): the token is the real control, this is the one
 * that fails loudly in code review.
 *
 * **Testable without a network.** The transport is injected. The unit test drives
 * the mapper with a captured Admin API response, so the shape is verified even
 * though the call itself can't be.
 */

import {
  normaliseEmail,
  normaliseOrderNumber,
  type OrderQuery,
  type OrderSource,
} from "./order-source.ts";
import type { RawLineItem, RawOrder } from "./types.ts";

export const SHOPIFY_API_VERSION = "2025-07";

/**
 * One order, by name or by email. `first: 1` because the tool answers about a
 * single order; a customer with several is asked for the number (contracts §1).
 */
export const ORDER_QUERY = /* GraphQL */ `
  query LookupOrder($search: String!) {
    orders(first: 1, query: $search, sortKey: CREATED_AT, reverse: true) {
      nodes {
        name
        createdAt
        cancelledAt
        displayFulfillmentStatus
        displayFinancialStatus
        tags
        currentTotalPriceSet {
          shopMoney {
            amount
          }
        }
        customAttributes {
          key
          value
        }
        lineItems(first: 25) {
          nodes {
            title
            quantity
          }
        }
        fulfillments(first: 10) {
          createdAt
          estimatedDeliveryAt
          trackingInfo(first: 1) {
            company
          }
          events(first: 25, sortKey: HAPPENED_AT, reverse: true) {
            nodes {
              status
              happenedAt
            }
          }
        }
      }
    }
  }
`;

export type ShopifyConfig = {
  shop: string;
  accessToken: string;
  apiVersion?: string | undefined;
};

export type ShopifyRequest = {
  query: string;
  variables: Record<string, unknown>;
};

export type ShopifyTransport = (request: ShopifyRequest) => Promise<ShopifyOrderResponse>;

/** Only the fields `ORDER_QUERY` asks for — a captured response types cleanly against this. */
export type ShopifyOrderResponse = {
  data?: {
    orders?: {
      nodes?: ShopifyOrderNode[];
    };
  };
  errors?: { message: string }[];
};

export type ShopifyOrderNode = {
  name: string;
  createdAt: string;
  cancelledAt?: string | null;
  displayFulfillmentStatus?: string | null;
  displayFinancialStatus?: string | null;
  tags?: string[];
  currentTotalPriceSet?: { shopMoney?: { amount?: string } } | null;
  customAttributes?: { key: string; value?: string | null }[];
  lineItems?: { nodes?: { title: string; quantity: number }[] };
  fulfillments?: ShopifyFulfillment[];
};

export type ShopifyFulfillment = {
  createdAt: string;
  estimatedDeliveryAt?: string | null;
  trackingInfo?: { company?: string | null }[];
  events?: { nodes?: ShopifyFulfillmentEvent[] };
};

export type ShopifyFulfillmentEvent = {
  status: string;
  happenedAt: string;
};

export class ShopifyLookupError extends Error {
  readonly cause: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ShopifyLookupError";
    this.cause = cause;
  }
}

export function assertReadOnly(document: string): void {
  if (/\bmutation\b/i.test(document)) {
    throw new ShopifyLookupError("Refusing to send a mutation: v1 is read-only (spec §6).");
  }
}

export function createShopifyOrderSource(
  config: ShopifyConfig,
  transport: ShopifyTransport = createFetchTransport(config),
): OrderSource {
  assertReadOnly(ORDER_QUERY);

  return {
    name: "shopify",
    async find(query: OrderQuery): Promise<RawOrder | null> {
      const search = buildSearchTerm(query);
      if (!search) return null;

      const response = await transport({ query: ORDER_QUERY, variables: { search } });

      if (response.errors?.length) {
        // Thrown, not swallowed. A GraphQL error means we do not know the
        // order's state, and "I couldn't check" is a different answer from
        // "no such order" (spec §B1, task E8).
        throw new ShopifyLookupError(response.errors.map((e) => e.message).join("; "));
      }

      const node = response.data?.orders?.nodes?.[0];
      return node ? mapShopifyOrder(node) : null;
    },
  };
}

/** Shopify's search syntax. Order names carry a `#` prefix in the store. */
export function buildSearchTerm(query: OrderQuery): string | null {
  if (query.orderNumber) return `name:#${normaliseOrderNumber(query.orderNumber)}`;
  if (query.email) return `email:${normaliseEmail(query.email)}`;
  return null;
}

function createFetchTransport(config: ShopifyConfig): ShopifyTransport {
  const version = config.apiVersion ?? SHOPIFY_API_VERSION;
  const endpoint = `https://${config.shop}/admin/api/${version}/graphql.json`;

  return async (request) => {
    assertReadOnly(request.query);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.accessToken,
      },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      throw new ShopifyLookupError(`Shopify responded ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as ShopifyOrderResponse;
  };
}

// ---------------------------------------------------------------------------
// The mapper — pure, and the part the unit test exercises
// ---------------------------------------------------------------------------

/** Carrier events that mean the package physically moved. Label events don't. */
const MOVEMENT_STATUSES = new Set([
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "ATTEMPTED_DELIVERY",
  "DELIVERED",
  "PICKED_UP",
  "CONFIRMED",
]);

export function mapShopifyOrder(node: ShopifyOrderNode): RawOrder {
  const fulfillments = node.fulfillments ?? [];
  const events = fulfillments
    .flatMap((f) => f.events?.nodes ?? [])
    .sort((a, b) => b.happenedAt.localeCompare(a.happenedAt));

  const shippedAt = fulfillments
    .map((f) => toIsoDay(f.createdAt))
    .sort()[0];
  const deliveredAt = events.find((e) => e.status === "DELIVERED")?.happenedAt;
  const lastMovement = events.find((e) => MOVEMENT_STATUSES.has(e.status))?.happenedAt;
  const estimatedDelivery = fulfillments.find((f) => f.estimatedDeliveryAt)?.estimatedDeliveryAt;
  const trackingCompany = fulfillments.flatMap((f) => f.trackingInfo ?? [])[0]?.company;

  const attributes = new Map(
    (node.customAttributes ?? []).map((a) => [a.key.toLowerCase(), a.value ?? ""]),
  );
  const tags = (node.tags ?? []).map((t) => t.toLowerCase());

  const order: RawOrder = {
    order_number: normaliseOrderNumber(node.name),
    created_at: toIsoDay(node.createdAt),
    fulfillment_status: mapFulfillmentStatus(node, Boolean(deliveredAt), fulfillments.length > 0),
    total: Number.parseFloat(node.currentTotalPriceSet?.shopMoney?.amount ?? "0"),
    line_items: (node.lineItems?.nodes ?? []).map(toRawLineItem),
    is_gift: tags.includes("gift") || attributes.get("gift") === "true",
  };

  // Optional fields are assigned rather than spread as `undefined`, because
  // `exactOptionalPropertyTypes` treats "absent" and "present but undefined" as
  // different things — and so does `JSON.stringify`.
  if (node.displayFinancialStatus) {
    order.financial_status = node.displayFinancialStatus.toLowerCase();
  }
  if (node.cancelledAt) order.cancelled_at = toIsoDay(node.cancelledAt);
  if (shippedAt) order.shipped_at = shippedAt;
  if (deliveredAt) order.delivered_at = toIsoDay(deliveredAt);
  if (lastMovement) order.last_tracking_movement = toIsoDay(lastMovement);
  if (estimatedDelivery) order.estimated_delivery = toIsoDay(estimatedDelivery);
  if (trackingCompany) order.tracking_company = trackingCompany;
  const subscriptionId = attributes.get("subscription_id");
  if (subscriptionId) order.subscription_id = subscriptionId;

  return order;
}

/**
 * Shopify's `FULFILLED` means "handed to the carrier", not "arrived". The
 * fixtures use `fulfilled` to mean delivered and `in_transit` to mean shipped,
 * so the two vocabularies are reconciled here rather than leaving the same word
 * meaning two things on two code paths.
 */
export function mapFulfillmentStatus(
  node: ShopifyOrderNode,
  delivered: boolean,
  hasFulfillment: boolean,
): string {
  if (node.cancelledAt) return "cancelled";
  const status = (node.displayFulfillmentStatus ?? "").toUpperCase();
  if (status === "RESTOCKED") return "cancelled";
  if (delivered) return "fulfilled";
  if (status === "FULFILLED" || status === "PARTIALLY_FULFILLED" || status === "IN_PROGRESS") {
    return "in_transit";
  }
  return hasFulfillment ? "in_transit" : "unfulfilled";
}

function toRawLineItem(item: { title: string; quantity: number }): RawLineItem {
  return { title: item.title, qty: item.quantity };
}

/** Shopify returns ISO-8601 instants; every policy threshold is measured in days. */
export function toIsoDay(timestamp: string): string {
  return timestamp.slice(0, 10);
}
