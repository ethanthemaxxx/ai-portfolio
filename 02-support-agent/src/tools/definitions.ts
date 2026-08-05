/**
 * The three tool definitions, as Anthropic tool-use JSON schemas.
 *
 * These are a transcription of `specs/contracts/tools.md`, and the test beside
 * this file parses that document and deep-equals every block against what's
 * exported here. The contract is the source of truth; this file is the copy that
 * cannot silently diverge from it.
 *
 * Descriptions are prescriptive about *when* to call, not just what the tool
 * does. Trigger conditions in the description are what move the should-call
 * rate; a description that only names the capability leaves the decision to
 * inference.
 *
 * Typed structurally rather than against `@anthropic-ai/sdk` so this module — and
 * its test — need no dependencies to run.
 */

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, JsonSchemaProperty>;
    required?: string[];
    additionalProperties: false;
  };
};

export type JsonSchemaProperty = {
  type: string;
  description?: string;
  enum?: string[];
};

export const LOOKUP_ORDER_TOOL: ToolDefinition = {
  name: "lookup_order",
  description:
    "Look up the current state of a single order. Call this whenever the customer asks where their order is, when it will arrive, whether it shipped, what was in it, or whether it can still be changed or returned — and any time you would otherwise have to guess at a date or a status. Never state an order's status without calling this first. Requires an order number (format CA-XXXXX) or the email the order was placed with; if you have neither, ask for one rather than calling with a guess.",
  input_schema: {
    type: "object",
    properties: {
      order_number: {
        type: "string",
        description: "Order number as printed in the confirmation email, e.g. CA-10241.",
      },
      email: {
        type: "string",
        description: "Email the order was placed with. Use only when no order number is available.",
      },
    },
    additionalProperties: false,
  },
};

export const SEARCH_HELP_CENTER_TOOL: ToolDefinition = {
  name: "search_help_center",
  description:
    "Search the store's help documents for a policy, product detail, or brewing instruction. Relevant documents are already provided to you for the customer's opening question — call this only when their follow-up moves to a different topic, or when the provided context does not contain the specific rule you need. Do not call it to re-read something you were already given.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "What you need to find, phrased as the customer would phrase it.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
};

export const ESCALATE_TO_HUMAN_TOOL: ToolDefinition = {
  name: "escalate_to_human",
  description:
    "Hand this conversation to a person. Call this when the documents don't support an answer, when the customer asks for a human, when money must be committed (a refund, credit, or reship you would otherwise be promising), or when the topic is wholesale, press, legal, or medical. Escalating is always safe; guessing is not. Do not apologise for escalating or ask the customer's permission first — call the tool and tell them it's been handed over.",
  input_schema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: [
          "no_supporting_document",
          "money_commitment",
          "wholesale",
          "press_or_partnership",
          "legal_or_dispute",
          "medical",
          "customer_requested",
          "outside_policy_window",
          "other",
        ],
      },
      summary: {
        type: "string",
        description: "One or two sentences a human can act on without reading the transcript.",
      },
      order_number: {
        type: "string",
        description: "Include when known — it saves the human a lookup.",
      },
    },
    required: ["category", "summary"],
    additionalProperties: false,
  },
};

/**
 * Render order matters for prompt caching: tools come first and must be byte-
 * stable across turns (plan.md §4). This array is that stable order.
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  LOOKUP_ORDER_TOOL,
  SEARCH_HELP_CENTER_TOOL,
  ESCALATE_TO_HUMAN_TOOL,
];
