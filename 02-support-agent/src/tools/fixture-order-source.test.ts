import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createFixtureOrderSource,
  resolveFixturePath,
  loadFixtureOrders,
} from "./fixture-order-source.ts";
import { ORDER_NUMBER_PATTERN } from "./order-source.ts";

const ORDERS = loadFixtureOrders();
const source = createFixtureOrderSource();

test("the fixture file resolves from 00-brand-demo and holds twelve orders", () => {
  assert.match(resolveFixturePath(), /00-brand-demo\/data\/orders\.json$/);
  assert.equal(ORDERS.length, 12);
});

test("every fixture order names the behaviour it exists to exercise", () => {
  // `_tests` is the fixture's contract with the suite. An order without one is
  // data nobody is asserting against, which is how fixtures rot.
  for (const order of ORDERS) {
    assert.equal(typeof order._tests, "string", `${order.order_number} has no _tests note`);
    assert.ok(order._tests!.length > 20, `${order.order_number}'s _tests note is too thin`);
  }
});

test("order numbers are unique and match the CA-XXXXX format in the contract", () => {
  const seen = new Set<string>();
  for (const order of ORDERS) {
    assert.match(order.order_number, ORDER_NUMBER_PATTERN);
    assert.equal(seen.has(order.order_number), false, `${order.order_number} appears twice`);
    seen.add(order.order_number);
  }
});

test("every fixture order carries the fields the mapper reads", () => {
  for (const order of ORDERS) {
    assert.match(order.created_at, /^\d{4}-\d{2}-\d{2}$/, order.order_number);
    assert.equal(typeof order.total, "number", order.order_number);
    assert.ok(Array.isArray(order.line_items) && order.line_items.length > 0, order.order_number);
  }
});

test("find: by order number", async () => {
  const order = await source.find({ orderNumber: "CA-10247" });
  assert.equal(order?.order_number, "CA-10247");
});

test("find: by email, most recent first", async () => {
  const order = await source.find({ email: "gift.buyer@example.com" });
  assert.equal(order?.order_number, "CA-10249");
});

test("find: the order number wins when both are given", async () => {
  const order = await source.find({
    orderNumber: "CA-10241",
    email: "gift.buyer@example.com",
  });
  assert.equal(order?.order_number, "CA-10241");
});

test("find: unknown identifiers and empty queries return null, never a throw", async () => {
  assert.equal(await source.find({ orderNumber: "CA-00000" }), null);
  assert.equal(await source.find({ email: "nobody@example.com" }), null);
  assert.equal(await source.find({}), null);
});

test("the source can be built over an injected array, with no disk access", async () => {
  const injected = createFixtureOrderSource([
    {
      order_number: "CA-20001",
      created_at: "2026-08-01",
      fulfillment_status: "unfulfilled",
      total: 19,
      line_items: [{ title: "Casa Blend / Filter / 250g", qty: 1 }],
    },
  ]);

  assert.equal(injected.name, "fixtures");
  assert.equal((await injected.find({ orderNumber: "ca-20001" }))?.total, 19);
  assert.equal(await injected.find({ orderNumber: "CA-10241" }), null);
});

test("repeated loads return equal data, so tests can't be order-dependent", () => {
  assert.deepEqual(loadFixtureOrders(), loadFixtureOrders());
});
