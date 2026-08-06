import { generateOne, PRODUCTS } from '../../../web/engine.ts';
import type { Locale } from '../../../types.ts';

export const runtime = 'nodejs';

/** The catalog, for the picker. Handles and titles only — the demo is read-only. */
export async function GET() {
  return Response.json({
    anchorDate: '2026-08-04',
    products: PRODUCTS.map((p) => ({
      handle: p.handle,
      title: p.title,
      kind: Object.keys(p.attributes ?? {}).length > 0 ? 'coffee' : 'equipment',
      variants: p.variants?.length ?? 0,
    })),
  });
}

export async function POST(req: Request) {
  let body: { handle?: string; locale?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const handle = typeof body.handle === 'string' ? body.handle : '';
  const locale: Locale = body.locale === 'es' ? 'es' : 'en';

  if (!PRODUCTS.some((p) => p.handle === handle)) {
    return Response.json({ error: 'unknown product handle' }, { status: 400 });
  }

  try {
    return Response.json(await generateOne(handle, locale));
  } catch (err) {
    // Never leak a stack trace to a public demo.
    console.error('[run] generation failed:', err);
    return Response.json({ error: 'generation failed' }, { status: 500 });
  }
}
