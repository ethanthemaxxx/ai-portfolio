import type { GeneratedCopy } from '../types.ts';
import { buildRequest, MODEL, type MessageRequest } from './prompt.ts';
import type { CopyGenerator, GenerationRequest, GenerationResult } from './types.ts';

/**
 * The `claude-opus-5` generator.
 *
 * ⚠️ This code path has never been executed against the live API. There is no
 * ANTHROPIC_API_KEY in this environment, so it is implemented and tested against
 * doubles only. That is stated in the README as well; see plan.md D3.
 *
 * The client is injected, and the SDK is an OPTIONAL dependency imported
 * dynamically at call time, so the whole test suite loads and passes on a
 * machine with no network and no `node_modules` (spec.md AC-12).
 */

/** The minimal slice of the Anthropic SDK surface this adapter uses. */
export interface MessagesClient {
  messages: {
    create(params: MessageRequest): Promise<MessageLike>;
  };
}

export interface MessageLike {
  content: Array<{ type: string; text?: string }>;
  stop_reason?: string;
}

export class AnthropicGeneratorError extends Error {}

export const ANTHROPIC_GENERATOR_ID = `anthropic-${MODEL}`;

function firstText(message: MessageLike): string {
  const block = message.content.find((b) => b.type === 'text' && typeof b.text === 'string');
  if (!block || typeof block.text !== 'string') {
    throw new AnthropicGeneratorError('response contained no text block');
  }
  return block.text;
}

interface ModelCopy {
  bodyHtml: string;
  metaTitle: string;
  metaDescription: string;
  imageAlt: string;
  claims?: Array<{ text: string; factId: string }>;
}

function parseCopy(raw: string): ModelCopy {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new AnthropicGeneratorError(
      `model returned text that is not JSON: ${(error as Error).message}`,
    );
  }
  const copy = parsed as Partial<ModelCopy>;
  for (const field of ['bodyHtml', 'metaTitle', 'metaDescription', 'imageAlt'] as const) {
    if (typeof copy[field] !== 'string') {
      throw new AnthropicGeneratorError(`model response is missing "${field}"`);
    }
  }
  return copy as ModelCopy;
}

export function createAnthropicGenerator(client: MessagesClient): CopyGenerator {
  return {
    id: ANTHROPIC_GENERATOR_ID,
    /** A model can act on "you used the word artisanal", so repair is worth a call. */
    canRepair: true,
    async generate(request: GenerationRequest): Promise<GenerationResult> {
      const params = buildRequest(request);
      const message = await client.messages.create(params);

      if (message.stop_reason === 'refusal') {
        return { ok: false, reason: 'the model declined this request' };
      }

      const parsed = parseCopy(firstText(message));
      const claims = parsed.claims ?? [];
      const copy: GeneratedCopy = {
        handle: request.product.handle,
        locale: request.locale,
        bodyHtml: parsed.bodyHtml,
        metaTitle: parsed.metaTitle,
        metaDescription: parsed.metaDescription,
        imageAlt: parsed.imageAlt,
        generator: ANTHROPIC_GENERATOR_ID,
        // The model's own claim→fact mapping is recorded, never trusted: the
        // provenance checker decides pass or fail independently (plan.md §4).
        usedFactIds: [...new Set(claims.map((c) => c.factId))].sort(),
        modelClaims: claims,
      };
      return { ok: true, copy };
    },
  };
}

/**
 * Load the real SDK. Dynamic and optional on purpose: a static import of an
 * uninstalled package would break module loading for the entire test suite.
 */
export async function loadAnthropicClient(): Promise<MessagesClient> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AnthropicGeneratorError(
      'ANTHROPIC_API_KEY is not set — run with --generator offline, or export a key',
    );
  }
  let module_: { default: new (options?: unknown) => unknown };
  try {
    // The specifier is held in a variable on purpose: `@anthropic-ai/sdk` is an
    // optional dependency, and a literal import specifier would make the type
    // checker require it to be installed for the whole project to compile.
    const specifier = '@anthropic-ai/sdk';
    module_ = (await import(specifier)) as never;
  } catch {
    throw new AnthropicGeneratorError(
      '@anthropic-ai/sdk is not installed — it is an optional dependency; run `npm install`',
    );
  }
  const Anthropic = module_.default;
  return new Anthropic() as MessagesClient;
}
