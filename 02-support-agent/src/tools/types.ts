/**
 * Local type declarations for the tool layer.
 *
 * These deliberately duplicate the shapes in `plan.md` §8 rather than importing
 * from `src/types.ts`: the tool layer and the retrieval layer are being built in
 * parallel, and a shared file would be a merge conflict waiting to happen. When
 * the two halves meet, these become re-exports.
 */

/** Fulfillment state, exactly the four values in plan.md §8. */
export type OrderStatus = "unfulfilled" | "in_transit" | "fulfilled" | "cancelled";

/** Where the package is, derived — never read straight off the carrier. */
export type TrackingState = "none" | "label_created" | "moving" | "stalled" | "delivered";

export type LineItem = {
  title: string;
  qty: number;
};

/**
 * What `lookup_order` returns. Note what is absent: no address, no email, no
 * tracking number, no payment method, no total. The agent never verifies
 * identity (spec §6), so it never discloses more than the minimum (spec §8).
 *
 * `requiresApproval` is the deliberate surrogate for the order total: the
 * escalation machine needs to know "is this over $150", and this is how it
 * finds out without the total ever entering the model's context.
 */
export type OrderEnvelope = {
  orderNumber: string;
  status: OrderStatus;
  placedAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  estimatedDelivery: string | null;
  trackingState: TrackingState;
  daysSinceLastMovement: number | null;
  lineItems: LineItem[];
  isGift: boolean;
  subscriptionId: string | null;
  refundEligible: boolean;
  requiresApproval: boolean;
  /** Policy-relevant facts derived in code, so the model doesn't derive them wrong. */
  notes: string[];
};

/**
 * The raw order as it exists in the store — fixtures and Shopify both normalise
 * to this before the mapper runs. It carries PII on purpose: this is the type
 * the allowlist exists to defend against.
 */
export type RawOrder = {
  order_number: string;
  created_at: string;
  fulfillment_status: string;
  total: number;
  line_items: RawLineItem[];

  email?: string | undefined;
  customer_name?: string | undefined;
  recipient_name?: string | undefined;
  financial_status?: string | undefined;
  shipped_at?: string | null | undefined;
  delivered_at?: string | null | undefined;
  cancelled_at?: string | null | undefined;
  estimated_delivery?: string | null | undefined;
  last_tracking_movement?: string | null | undefined;
  next_roast_date?: string | null | undefined;
  next_charge_at?: string | null | undefined;
  roast_date_on_bag?: string | null | undefined;
  tracking_company?: string | undefined;
  tracking_number?: string | undefined;
  shipping_state?: string | undefined;
  shipping_address?: string | undefined;
  is_gift?: boolean | undefined;
  subscription_id?: string | null | undefined;
  subscription_frequency_weeks?: number | undefined;
  customer_claim?: string | undefined;
  /** Fixture-only annotation naming the behaviour the record exists to exercise. */
  _tests?: string | undefined;
};

export type RawLineItem = {
  title: string;
  qty: number;
  sku?: string | undefined;
  price?: number | undefined;
};

/**
 * A retrieved corpus chunk. Narrowed to the fields `search_help_center` returns;
 * the retrieval layer's own Chunk type is a superset (it carries embeddings and
 * token counts the tool has no business forwarding to the model).
 */
export type Chunk = {
  docId: string;
  heading: string;
  text: string;
  authority: "canonical" | "informational";
  id?: string | undefined;
  title?: string | undefined;
  score?: number | undefined;
};

/**
 * The single seam between this layer and the retrieval layer (owned elsewhere).
 * An empty array means "nothing cleared the relevance floor" — the floor lives
 * in retrieval (task B4), so the tool reads emptiness as the signal rather than
 * re-deriving a threshold it doesn't own.
 */
export type SearchChunks = (query: string) => Promise<Chunk[]>;

/** Escalation categories, verbatim from the `escalate_to_human` enum. */
export type EscalationCategory =
  | "no_supporting_document"
  | "money_commitment"
  | "wholesale"
  | "press_or_partnership"
  | "legal_or_dispute"
  | "medical"
  | "customer_requested"
  | "outside_policy_window"
  | "other";
