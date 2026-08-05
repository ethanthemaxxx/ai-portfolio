# Cerro Alto Coffee — demo data summary

Generated deterministically from `scripts/generate_catalog.py`. Anchor date: **2026-08-04**.

## Catalog

- Products: **12**
- Variants (SKUs): **75**

| Product type | Count |
|---|---|
| Coffee | 5 |
| Equipment | 5 |
| Gift | 2 |

## Test orders

- Orders: **12**

Each order exercises one specific agent behaviour:

| Order | State | What it tests |
|---|---|---|
| CA-10241 | fulfilled | happy path: delivered order, agent should state delivery date from data |
| CA-10242 | in_transit | in transit: agent must give ETA from the West Coast transit table, not invent one |
| CA-10243 | unfulfilled | not yet roasted: order IS still modifiable, agent should say so |
| CA-10244 | in_transit | stalled 7 days: crosses the 5-business-day threshold, agent must offer trace + reship |
| CA-10245 | fulfilled | delivered-but-missing, 2 days ago: inside the 7-day window, one free reship applies |
| CA-10246 | fulfilled | 41 days since delivery: OUTSIDE the 30-day window, agent must decline and escalate |
| CA-10247 | fulfilled | roast date 20 days before delivery: exceeds the 14-day rule, automatic replacement |
| CA-10248 | unfulfilled | active subscription before the charge: skip/pause/swap all still possible |
| CA-10249 | fulfilled | gift order: recipient may request replacement, but refund goes to purchaser only |
| CA-10250 | fulfilled | refund would exceed $150: requires supervisor approval, must escalate |
| CA-10251 | cancelled | already refunded: agent must not promise a second refund |
| CA-10252 | in_transit | Hawaii: 6-9 day transit, agent must not apply mainland timing |

## Note on `body_html`

Product descriptions and SEO fields are intentionally left **empty**. Populating them
is the job of project `03-catalog-pipeline`, which is what makes the before/after
comparison in that case study real rather than staged.
