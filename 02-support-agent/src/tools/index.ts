/** Group C — the three tools, their schemas, and the order adapters behind them. */

export {
  ESCALATE_TO_HUMAN_TOOL,
  LOOKUP_ORDER_TOOL,
  SEARCH_HELP_CENTER_TOOL,
  TOOL_DEFINITIONS,
} from "./definitions.ts";
export type { JsonSchemaProperty, ToolDefinition } from "./definitions.ts";

export {
  createEscalateToHuman,
  createSequentialTicketIds,
  createTicketQueue,
  hashTicketId,
  TICKET_ID_PREFIX,
} from "./escalate-to-human.ts";
export type {
  EscalateDeps,
  EscalateInput,
  EscalateResult,
  EscalationContext,
  EscalationTicket,
  TranscriptTurn,
} from "./escalate-to-human.ts";

export { createFixtureOrderSource, resolveFixturePath, loadFixtureOrders } from "./fixture-order-source.ts";

export {
  createDefaultOrderSource,
  createLookupOrder,
  OrderSourceConfigError,
} from "./lookup-order.ts";
export type { LookupOrderDeps, LookupOrderInput, LookupOrderResult } from "./lookup-order.ts";

export {
  buildNotes,
  deriveRefundFlags,
  deriveStatus,
  deriveTrackingState,
  ENVELOPE_KEYS,
  NEVER_DISCLOSED_FIELDS,
  toOrderEnvelope,
  toWire,
} from "./order-envelope.ts";
export type { DeriveOptions, OrderEnvelopeWire } from "./order-envelope.ts";

export { normaliseEmail, normaliseOrderNumber, ORDER_NUMBER_PATTERN } from "./order-source.ts";
export type { OrderQuery, OrderSource } from "./order-source.ts";

export {
  createSearchHelpCenter,
  MAX_HELP_CENTER_RESULTS,
} from "./search-help-center.ts";
export type {
  HelpCenterResult,
  SearchHelpCenterInput,
  SearchHelpCenterResult,
} from "./search-help-center.ts";

export {
  assertReadOnly,
  createShopifyOrderSource,
  mapShopifyOrder,
  ORDER_QUERY,
  SHOPIFY_API_VERSION,
  ShopifyLookupError,
} from "./shopify-order-source.ts";
export type { ShopifyConfig, ShopifyOrderResponse, ShopifyTransport } from "./shopify-order-source.ts";

export * from "./policy.ts";
export type {
  Chunk,
  EscalationCategory,
  LineItem,
  OrderEnvelope,
  OrderStatus,
  RawOrder,
  SearchChunks,
  TrackingState,
} from "./types.ts";
