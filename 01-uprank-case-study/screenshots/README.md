# Screenshots

Five captures of UpRank running locally. Nothing here is a mockup, a
reconstruction, or a retouched image — each file is a direct PNG capture of the
application in a production build.

| File | Screen | What it shows |
|---|---|---|
| `01-dashboard.png` | `/` | Overview: 4 jobs analysed, 2 rated *apply now*, average score 57, profile health 91 |
| `02-job-ranking.png` | `/trabajos` | The core screen. Four posts scored 92 / 92 / 42 / 0, with the five-component breakdown expanded on the top result and seven red flags on the scam post |
| `03-proposal-draft.png` | `/propuestas` | A 154-word proposal draft produced in template mode, with the AI button labelled `(sin key)` because no API key is configured |
| `04-profile-audit.png` | `/perfil` | The six-category rubric scoring a profile at 91, with the weakest category (market competitiveness, 65) surfaced as "fix this first" |
| `05-compliance.png` | `/integracion` | The allowed-vs-forbidden page: the Upwork ToS boundary written into the product |

Captured at a 1440×900 CSS viewport, `deviceScaleFactor: 2`, full page height,
then downscaled to 1920 px wide.

---

## The data is synthetic

**Every job post and profile in these screenshots was written by me to exercise
the engine.** No real client data, no real job posts copied from Upwork, and no
personal profile information appear anywhere.

The four job posts were designed to hit different parts of the scoring range:

| Post | Score | Verdict | Designed to test |
|---|---:|---|---|
| RAG support agent, $55–80/h, UK, $150K spent, 92% hire rate | 92 | apply now | A strong post — high pay, verified client, deep niche keyword overlap |
| n8n Shopify→HubSpot sync, $2,500 fixed, US, 85% hire rate | 92 | apply now | Fixed-price scoring path and long-term signals |
| "Need someone to help with AI stuff", $18–25/h, 20–50 proposals | 42 | skip | Vague scope, low pay, saturated — the ordinary bad post |
| "URGENT!! ... free test task ... pay in crypto ... WhatsApp" | 0 | skip | The scam path: 7 of 9 red-flag rules fire and floor the score |

The profile is a placeholder built from this portfolio's own projects. The rate,
location and language fields are plausible placeholders, not a live profile.

## The scores were computed by the app, not written by me

The synthetic input is mine. **Every number visible in the screenshots is the
application's own output.** The posts were submitted through the running app's
`POST /api/jobs` endpoint, which runs the real `parseJob()` → `scoreJob()` path
and persists the result. I did not write scores into the database.

## How they were produced

1. Copied the local `prisma/dev.db` to a scratch directory and emptied it, so the
   capture ran against an isolated database and the source repository's own data
   was never modified.
2. `npm run build` (clean, 22 routes) and `npm run start`, with `DATABASE_URL`
   pointed at the scratch database. Production build, so no dev-mode overlay or
   error badge appears in the captures.
3. Seeded the profile and the four job posts through the app's HTTP API.
4. Drove headless Chrome over the DevTools Protocol to navigate, expand the score
   breakdown, click *Borrador con plantilla*, and capture each page.

No API keys were set during capture. `ANTHROPIC_API_KEY` and the Upwork
credentials were both absent, which is why `03` shows the template path and `05`
shows *Credenciales: no configuradas*. That is the app's genuine zero-credential
state, not a staged one.

---

## Two things to read honestly

**The interface is in Spanish.** UpRank was built for my own daily use and never
localised. The text it *generates* — proposals, profile copy — is in English,
since that is what goes to clients.

**A visible bug, left in.** In `02-job-ranking.png` the top result reads
`cliente gastó $150.000` in the header and `$150,000+` in the breakdown two lines
below. That is a real hydration mismatch: `src/components/JobsClient.tsx:16` calls
`toLocaleString()` with no explicit locale, so the server and the browser format
the number differently. It is a one-line fix. I left it visible rather than patch
it just for the screenshot.

**The percentages on the dashboard** (`+329%`, `+178%`, `+34%`, `42%`) are
bundled reference content from the app's strategy research, shown with cited
sources inside the app. They are **not** measurements of this tool and are not
claimed as results anywhere in this case study.
