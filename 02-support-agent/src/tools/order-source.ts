/**
 * C4/C5 — one interface, two adapters.
 *
 * `lookup_order` doesn't know or care whether the order came from a JSON fixture
 * or from Shopify. Both adapters return the same normalised `RawOrder`, and the
 * envelope mapper is the only thing that ever shapes it — so the privacy
 * guarantee holds identically on both paths, and the demo runs with no keys
 * (plan.md §10).
 */

import type { RawOrder } from "./types.ts";

export type OrderQuery = {
  orderNumber?: string | undefined;
  email?: string | undefined;
};

export type OrderSource = {
  /** A name that shows up in traces, so "which backend answered this" is never a guess. */
  readonly name: string;
  /** Returns null for "no such order". Throws only for a genuine transport failure. */
  find(query: OrderQuery): Promise<RawOrder | null>;
};

/** Order numbers are `CA-` plus five digits (contracts/tools.md). */
export const ORDER_NUMBER_PATTERN = /^CA-\d{5}$/;

export function normaliseOrderNumber(value: string): string {
  return value.trim().toUpperCase().replace(/^#/, "");
}

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}
