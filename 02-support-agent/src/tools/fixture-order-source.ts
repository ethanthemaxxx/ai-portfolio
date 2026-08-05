/**
 * C4 — the fixture adapter.
 *
 * Reads `00-brand-demo/data/orders.json`, the twelve synthetic orders each of
 * which exists to exercise one named behaviour (spec §8: all demo data is
 * synthetic, and none of it is real). This is the adapter that runs when no
 * `SHOPIFY_ADMIN_TOKEN` is set, which is how `npm test` works on a plane.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  normaliseEmail,
  normaliseOrderNumber,
  type OrderQuery,
  type OrderSource,
} from "./order-source.ts";
import type { RawOrder } from "./types.ts";

/**
 * `02-support-agent/src/tools/` → `00-brand-demo/data/orders.json`.
 *
 * Resolved lazily, and not through `new URL(..., import.meta.url)`.
 *
 * Under `tsx` that idiom is correct and this module loaded fine. Under webpack —
 * which is what compiles the Next route — `import.meta.url` is rewritten and the
 * `URL` instance it produces is not the one `fileURLToPath` expects, so the module
 * threw `ERR_INVALID_ARG_TYPE` at import time and took the whole API route with
 * it. The unit tests could not have caught this: they never run bundled.
 *
 * `process.cwd()` with a search upward is boring and works in both. The lookup is
 * memoised, so the cost is paid once.
 */
export function resolveFixturePath(): string {
  if (resolved) return resolved;

  const candidates = [
    // From the package root, which is cwd under both `npm test` and `next dev`.
    path.resolve(process.cwd(), "../00-brand-demo/data/orders.json"),
    // From the repo root, if someone runs from there.
    path.resolve(process.cwd(), "portfolio/00-brand-demo/data/orders.json"),
    path.resolve(process.cwd(), "00-brand-demo/data/orders.json"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      resolved = candidate;
      return candidate;
    }
  }

  throw new Error(
    `Could not locate 00-brand-demo/data/orders.json from ${process.cwd()}. ` +
      `Run from the package root, or pass an explicit path to loadFixtureOrders().`,
  );
}

let resolved: string | null = null;
let cached: RawOrder[] | null = null;

export function loadFixtureOrders(path?: string): RawOrder[] {
  const target = path ?? resolveFixturePath();
  if (target === resolved && cached) return cached;
  const parsed = JSON.parse(readFileSync(target, "utf8")) as RawOrder[];
  if (target === resolved) cached = parsed;
  return parsed;
}

export function createFixtureOrderSource(orders?: RawOrder[]): OrderSource {
  const records = orders ?? loadFixtureOrders();

  return {
    name: "fixtures",
    async find(query: OrderQuery): Promise<RawOrder | null> {
      const orderNumber = query.orderNumber ? normaliseOrderNumber(query.orderNumber) : null;
      if (orderNumber) {
        return records.find((o) => normaliseOrderNumber(o.order_number) === orderNumber) ?? null;
      }

      const email = query.email ? normaliseEmail(query.email) : null;
      if (email) {
        // Most recent order for that address. An email can match several; the
        // customer asking "where is my order" means the latest one, and the
        // agent can ask for a number if that guess is wrong.
        const matches = records
          .filter((o) => o.email && normaliseEmail(o.email) === email)
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        return matches[0] ?? null;
      }

      return null;
    },
  };
}
