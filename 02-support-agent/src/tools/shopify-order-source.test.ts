/**
 * C5 — the live adapter, exercised without a network.
 *
 * The call itself can't be tested here; the *shape* can. These tests drive the
 * mapper with a captured Admin API response for CA-10244 and assert that it
 * produces the same envelope, byte for byte, as the fixture adapter. That is the
 * "one interface, two adapters" claim made checkable.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { createFixtureOrderSource } from "./fixture-order-source.ts";
import { toOrderEnvelope, toWire } from "./order-envelope.ts";
import { ANCHOR_TODAY } from "./policy.ts";
import {
  assertReadOnly,
  buildSearchTerm,
  createShopifyOrderSource,
  mapShopifyOrder,
  ORDER_QUERY,
  ShopifyLookupError,
  type ShopifyOrderResponse,
  type ShopifyRequest,
} from "./shopify-order-source.ts";

/** Captured from `orders(first: 1, query: "name:#CA-10244")`, trimmed to the queried fields. */
const CAPTURED_CA_10244: ShopifyOrderResponse = {
  data: {
    orders: {
      nodes: [
        {
          name: "#CA-10244",
          createdAt: "2026-07-26T14:12:03Z",
          cancelledAt: null,
          displayFulfillmentStatus: "FULFILLED",
          displayFinancialStatus: "PAID",
          tags: [],
          currentTotalPriceSet: { shopMoney: { amount: "62.00" } },
          customAttributes: [],
          lineItems: {
            nodes: [{ title: "Volcan Dark / French Press / 1kg", quantity: 1 }],
          },
          fulfillments: [
            {
              createdAt: "2026-07-27T23:04:11Z",
              estimatedDeliveryAt: null,
              trackingInfo: [{ company: "USPS" }],
              events: {
                nodes: [
                  { status: "IN_TRANSIT", happenedAt: "2026-07-28T09:31:00Z" },
                  { status: "LABEL_PRINTED", happenedAt: "2026-07-27T23:04:11Z" },
                ],
              },
            },
          ],
        },
      ],
    },
  },
};

function transportReturning(response: ShopifyOrderResponse, seen?: ShopifyRequest[]) {
  return async (request: ShopifyRequest) => {
    seen?.push(request);
    return response;
  };
}

const CONFIG = { shop: "cerro-alto.myshopify.com", accessToken: "shpat_test" };

test("C5: the query document is read-only — v1 writes nothing to the store", () => {
  assert.doesNotThrow(() => assertReadOnly(ORDER_QUERY));
  assert.equal(/\bmutation\b/i.test(ORDER_QUERY), false);
  assert.throws(
    () => assertReadOnly("mutation orderUpdate($id: ID!) { orderUpdate(id: $id) { order { id } } }"),
    ShopifyLookupError,
  );
});

test("C5: the search term is built from the order number, then the email", () => {
  assert.equal(buildSearchTerm({ orderNumber: "ca-10244" }), "name:#CA-10244");
  assert.equal(buildSearchTerm({ email: "T.Okafor@Example.com" }), "email:t.okafor@example.com");
  assert.equal(buildSearchTerm({}), null);
});

test("C5: the same order produces the same envelope from both adapters", async () => {
  const shopify = createShopifyOrderSource(CONFIG, transportReturning(CAPTURED_CA_10244));
  const fixtures = createFixtureOrderSource();

  const fromShopify = await shopify.find({ orderNumber: "CA-10244" });
  const fromFixtures = await fixtures.find({ orderNumber: "CA-10244" });
  assert.ok(fromShopify && fromFixtures);

  assert.deepEqual(
    toWire(toOrderEnvelope(fromShopify, { today: ANCHOR_TODAY })),
    toWire(toOrderEnvelope(fromFixtures, { today: ANCHOR_TODAY })),
  );
});

test("C5: the privacy allowlist holds on the live path too", async () => {
  const shopify = createShopifyOrderSource(CONFIG, transportReturning(CAPTURED_CA_10244));
  const raw = await shopify.find({ orderNumber: "CA-10244" });
  assert.ok(raw);

  const wire = toWire(toOrderEnvelope(raw, { today: ANCHOR_TODAY })) as Record<string, unknown>;
  const serialised = JSON.stringify(wire);
  assert.equal(serialised.includes("USPS"), false, "carrier leaked");
  assert.equal(serialised.includes("62.00"), false, "order total leaked");
  for (const forbidden of ["total", "tracking_number", "tracking_company", "email"]) {
    assert.equal(Object.hasOwn(wire, forbidden), false, `"${forbidden}" leaked`);
  }
});

test("C5: the transport is handed the query and the search variable", async () => {
  const seen: ShopifyRequest[] = [];
  const shopify = createShopifyOrderSource(CONFIG, transportReturning(CAPTURED_CA_10244, seen));
  await shopify.find({ orderNumber: "CA-10244" });

  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.query, ORDER_QUERY);
  assert.deepEqual(seen[0]?.variables, { search: "name:#CA-10244" });
});

test("C5: an empty result set is null, not an error", async () => {
  const shopify = createShopifyOrderSource(
    CONFIG,
    transportReturning({ data: { orders: { nodes: [] } } }),
  );
  assert.equal(await shopify.find({ orderNumber: "CA-99999" }), null);
});

test("C5: a GraphQL error throws, so `lookup_order` can report it as lookup_failed", async () => {
  const shopify = createShopifyOrderSource(
    CONFIG,
    transportReturning({ errors: [{ message: "Throttled" }] }),
  );
  await assert.rejects(() => shopify.find({ orderNumber: "CA-10244" }), ShopifyLookupError);
});

test("C5: FULFILLED plus a delivery scan means delivered, not merely shipped", () => {
  const node = structuredClone(CAPTURED_CA_10244).data!.orders!.nodes![0]!;
  node.fulfillments![0]!.events!.nodes!.unshift({
    status: "DELIVERED",
    happenedAt: "2026-08-03T16:22:00Z",
  });

  const raw = mapShopifyOrder(node);
  assert.equal(raw.delivered_at, "2026-08-03");
  // Shopify's FULFILLED means "handed to the carrier"; the fixtures use
  // "fulfilled" to mean delivered. The adapter reconciles the two vocabularies.
  assert.equal(raw.fulfillment_status, "fulfilled");
  assert.equal(toOrderEnvelope(raw, { today: ANCHOR_TODAY }).trackingState, "delivered");
});

test("C5: label events are not movement — a printed label doesn't reset the stall clock", () => {
  const node = structuredClone(CAPTURED_CA_10244).data!.orders!.nodes![0]!;
  node.fulfillments![0]!.events!.nodes = [
    { status: "LABEL_PRINTED", happenedAt: "2026-07-27T23:04:11Z" },
  ];

  const raw = mapShopifyOrder(node);
  assert.equal(raw.last_tracking_movement, undefined);
  assert.equal(raw.shipped_at, "2026-07-27");
});

test("C5: an unfulfilled order maps to unfulfilled with no ship date", () => {
  const node = structuredClone(CAPTURED_CA_10244).data!.orders!.nodes![0]!;
  node.displayFulfillmentStatus = "UNFULFILLED";
  node.fulfillments = [];

  const raw = mapShopifyOrder(node);
  assert.equal(raw.fulfillment_status, "unfulfilled");
  assert.equal(raw.shipped_at, undefined);
  assert.equal(toOrderEnvelope(raw, { today: ANCHOR_TODAY }).trackingState, "none");
});

test("C5: a cancelled order maps to cancelled whatever the fulfillment status says", () => {
  const node = structuredClone(CAPTURED_CA_10244).data!.orders!.nodes![0]!;
  node.cancelledAt = "2026-07-28T08:00:00Z";
  node.displayFinancialStatus = "REFUNDED";
  node.currentTotalPriceSet = { shopMoney: { amount: "0.00" } };

  const envelope = toOrderEnvelope(mapShopifyOrder(node), { today: ANCHOR_TODAY });
  assert.equal(envelope.status, "cancelled");
  assert.equal(envelope.refundEligible, false);
});

test("C5: gift orders are read from the tag or the custom attribute", () => {
  const tagged = structuredClone(CAPTURED_CA_10244).data!.orders!.nodes![0]!;
  tagged.tags = ["Gift", "subscription"];
  assert.equal(mapShopifyOrder(tagged).is_gift, true);

  const attributed = structuredClone(CAPTURED_CA_10244).data!.orders!.nodes![0]!;
  attributed.customAttributes = [
    { key: "gift", value: "true" },
    { key: "subscription_id", value: "SUB-3391" },
  ];
  const raw = mapShopifyOrder(attributed);
  assert.equal(raw.is_gift, true);
  assert.equal(raw.subscription_id, "SUB-3391");
});
