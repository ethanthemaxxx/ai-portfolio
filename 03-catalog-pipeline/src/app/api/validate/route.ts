import { PRODUCTS, validateEdited } from '../../../web/engine.ts';
import type { Locale } from '../../../types.ts';

export const runtime = 'nodejs';

/** Cap the payload. A public endpoint should not accept a novel. */
const MAX_FIELD = 4000;

function field(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, MAX_FIELD) : '';
}

/**
 * Validate copy the visitor typed. The gate does not care who wrote the text —
 * that is the entire point of the demo.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const handle = field(body.handle);
  const locale: Locale = body.locale === 'es' ? 'es' : 'en';

  if (!PRODUCTS.some((p) => p.handle === handle)) {
    return Response.json({ error: 'unknown product handle' }, { status: 400 });
  }

  try {
    return Response.json(
      validateEdited({
        handle,
        locale,
        bodyHtml: field(body.bodyHtml),
        metaTitle: field(body.metaTitle),
        metaDescription: field(body.metaDescription),
        imageAlt: field(body.imageAlt),
      }),
    );
  } catch (err) {
    console.error('[validate] failed:', err);
    return Response.json({ error: 'validation failed' }, { status: 500 });
  }
}
