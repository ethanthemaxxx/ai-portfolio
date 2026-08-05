#!/usr/bin/env python3
"""
Generate the Cerro Alto Coffee demo catalog and test orders.

Deterministic by design: no randomness, no clock reads. Running this twice produces
byte-identical output, so the RAG index and the eval suite stay reproducible.

Outputs (relative to 00-brand-demo/):
    data/products.json   Shopify-shaped product + variant records
    data/orders.json     Test orders covering every fulfilment state the agent must handle
    data/summary.md      Human-readable counts, for the case study

Usage:
    python3 scripts/generate_catalog.py
"""

import json
import os
from datetime import date, timedelta

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data")

# Anchor date for the whole demo. Everything is relative to this so the fixtures
# never drift and the eval expectations stay valid.
TODAY = date(2026, 8, 4)  # a Tuesday


def d(offset_days: int) -> str:
    return (TODAY + timedelta(days=offset_days)).isoformat()


# --------------------------------------------------------------------------------
# Coffee
# --------------------------------------------------------------------------------

GRINDS = ["Whole Bean", "Filter", "Espresso", "French Press"]
SIZES = [("250g", 19.00), ("500g", 34.00), ("1kg", 62.00)]

COFFEES = [
    {
        "handle": "huila-reserve",
        "title": "Huila Reserve",
        "roast": "Medium",
        "origin": "Huila, Colombia",
        "process": "Washed",
        "altitude_masl": 1750,
        "notes": ["ripe plum", "brown sugar", "orange"],
        "green_price_per_kg_usd": 6.40,
        "blurb": "The one we hand people who say they don't like black coffee.",
        "subscription": True,
    },
    {
        "handle": "narino-microlot",
        "title": "Nariño Microlot",
        "roast": "Light",
        "origin": "Nariño, Colombia",
        "process": "Natural",
        "altitude_masl": 2100,
        "notes": ["raspberry", "hibiscus", "cane sugar"],
        "green_price_per_kg_usd": 9.10,
        "blurb": "Loud, fruity, and unforgiving. Best in a pour-over.",
        "subscription": False,  # microlot: sells out, not offered on subscription
    },
    {
        "handle": "volcan-dark",
        "title": "Volcán Dark",
        "roast": "Dark",
        "origin": "Tolima, Colombia",
        "process": "Washed",
        "altitude_masl": 1600,
        "notes": ["dark chocolate", "molasses", "toasted walnut"],
        "green_price_per_kg_usd": 5.80,
        "blurb": "Built to cut through milk without turning bitter.",
        "subscription": True,
    },
    {
        "handle": "casa-blend",
        "title": "Casa Blend",
        "roast": "Medium",
        "origin": "Huila + Tolima, Colombia",
        "process": "Washed",
        "altitude_masl": 1680,
        "notes": ["milk chocolate", "almond", "red apple"],
        "green_price_per_kg_usd": 5.50,
        "blurb": "The everyday bag. Works in anything, hard to ruin.",
        "subscription": True,
    },
    {
        "handle": "sereno-decaf",
        "title": "Sereno Decaf",
        "roast": "Medium",
        "origin": "Huila, Colombia",
        "process": "Sugarcane EA decaf",
        "altitude_masl": 1700,
        "notes": ["caramel", "baked pear", "cocoa"],
        "green_price_per_kg_usd": 7.20,
        "blurb": "Decaf that tastes like coffee. Sugarcane process, no methylene chloride.",
        "subscription": True,
    },
]

EQUIPMENT = [
    {
        "handle": "v60-dripper",
        "title": "Cerro Alto V60 Dripper",
        "type": "Equipment",
        "price": 24.00,
        "options": [("Color", ["White", "Black"])],
        "blurb": "Ceramic, size 02. Holds heat better than plastic.",
    },
    {
        "handle": "paper-filters-100",
        "title": "V60 Paper Filters (100 ct)",
        "type": "Equipment",
        "price": 9.00,
        "options": [],
        "blurb": "Bleached, size 02. Rinse before brewing.",
    },
    {
        "handle": "gooseneck-kettle",
        "title": "Gooseneck Kettle 1L",
        "type": "Equipment",
        "price": 69.00,
        "options": [("Finish", ["Matte Black", "Brushed Steel"])],
        "blurb": "Variable temperature, 60-100 C. Manufacturer warranty: 2 years.",
    },
    {
        "handle": "digital-scale",
        "title": "Digital Brew Scale",
        "type": "Equipment",
        "price": 39.00,
        "options": [],
        "blurb": "0.1 g resolution with a built-in timer. The cheapest upgrade in coffee.",
    },
    {
        "handle": "ceramic-mug",
        "title": "Cerro Alto Mug 10 oz",
        "type": "Equipment",
        "price": 18.00,
        "options": [("Glaze", ["Clay", "Cream"])],
        "blurb": "Thick walled, dishwasher safe.",
    },
]

GIFT = [
    {
        "handle": "origin-sampler",
        "title": "Origin Sampler (4 x 100g)",
        "type": "Gift",
        "price": 32.00,
        "options": [("Grind", GRINDS)],
        "blurb": "Huila, Narino, Volcan and Casa in 100 g bags. The easiest gift we sell.",
    },
    {
        "handle": "gift-card",
        "title": "Gift Card",
        "type": "Gift",
        "price": None,
        "options": [("Value", ["$25", "$50", "$100"])],
        "blurb": "Digital, delivered by email, never expires.",
    },
]


def build_products():
    products = []

    for c in COFFEES:
        variants = []
        for grind in GRINDS:
            for size, price in SIZES:
                sku = f"CA-{c['handle'][:4].upper()}-{grind.split()[0][:2].upper()}-{size}"
                variants.append(
                    {
                        "sku": sku,
                        "option1_grind": grind,
                        "option2_size": size,
                        "price": round(price, 2),
                        "subscription_price": round(price * 0.90, 2) if c["subscription"] else None,
                        "inventory_quantity": 40 if size == "250g" else 25 if size == "500g" else 12,
                        "weight_g": {"250g": 250, "500g": 500, "1kg": 1000}[size],
                    }
                )
        products.append(
            {
                "handle": c["handle"],
                "title": c["title"],
                "product_type": "Coffee",
                "vendor": "Cerro Alto Coffee",
                "tags": [c["roast"].lower(), "single-origin" if "+" not in c["origin"] else "blend", "colombia"],
                "available_on_subscription": c["subscription"],
                "attributes": {
                    "roast_level": c["roast"],
                    "origin": c["origin"],
                    "process": c["process"],
                    "altitude_masl": c["altitude_masl"],
                    "tasting_notes": c["notes"],
                    "green_price_per_kg_usd": c["green_price_per_kg_usd"],
                    "last_roast_date": d(-1),
                },
                "short_blurb": c["blurb"],
                # Deliberately thin: project 03 (catalog pipeline) generates the real copy.
                "body_html": "",
                "seo": {"title": "", "description": ""},
                "variants": variants,
            }
        )

    for group in (EQUIPMENT, GIFT):
        for item in group:
            opts = item["options"]
            if not opts:
                variants = [
                    {
                        "sku": f"CA-{item['handle'][:6].upper()}",
                        "option1": None,
                        "price": item["price"],
                        "inventory_quantity": 60,
                    }
                ]
            else:
                name, values = opts[0]
                variants = []
                for v in values:
                    price = item["price"]
                    if item["handle"] == "gift-card":
                        price = float(v.replace("$", ""))
                    variants.append(
                        {
                            "sku": f"CA-{item['handle'][:6].upper()}-{v.split()[0][:3].upper()}",
                            "option1": v,
                            "option1_name": name,
                            "price": price,
                            "inventory_quantity": 0 if item["handle"] == "gift-card" else 30,
                        }
                    )
            products.append(
                {
                    "handle": item["handle"],
                    "title": item["title"],
                    "product_type": item["type"],
                    "vendor": "Cerro Alto Coffee",
                    "tags": [item["type"].lower()],
                    "available_on_subscription": False,
                    "attributes": {},
                    "short_blurb": item["blurb"],
                    "body_html": "",
                    "seo": {"title": "", "description": ""},
                    "variants": variants,
                }
            )

    return products


# --------------------------------------------------------------------------------
# Orders
#
# Every order here exists to exercise one specific agent behaviour. The `_tests`
# field is the link between the fixture and the eval suite; it is stripped before
# the data is served to the agent.
# --------------------------------------------------------------------------------

ORDERS = [
    {
        "order_number": "CA-10241",
        "email": "dana.reyes@example.com",
        "customer_name": "Dana Reyes",
        "created_at": d(-6),
        "financial_status": "paid",
        "fulfillment_status": "fulfilled",
        "shipped_at": d(-4),
        "delivered_at": d(-1),
        "tracking_company": "USPS",
        "tracking_number": "9400100000000000000001",
        "shipping_state": "GA",
        "line_items": [{"sku": "CA-HUIL-FI-250g", "title": "Huila Reserve / Filter / 250g", "qty": 2, "price": 19.00}],
        "total": 38.00,
        "_tests": "happy path: delivered order, agent should state delivery date from data",
    },
    {
        "order_number": "CA-10242",
        "email": "marcus.hall@example.com",
        "customer_name": "Marcus Hall",
        "created_at": d(-2),
        "financial_status": "paid",
        "fulfillment_status": "in_transit",
        "shipped_at": d(-1),
        "delivered_at": None,
        "estimated_delivery": d(2),
        "tracking_company": "USPS",
        "tracking_number": "9400100000000000000002",
        "shipping_state": "CA",
        "line_items": [{"sku": "CA-NARI-WH-500g", "title": "Narino Microlot / Whole Bean / 500g", "qty": 1, "price": 34.00}],
        "total": 34.00,
        "_tests": "in transit: agent must give ETA from the West Coast transit table, not invent one",
    },
    {
        "order_number": "CA-10243",
        "email": "priya.n@example.com",
        "customer_name": "Priya Nair",
        "created_at": d(-1),
        "financial_status": "paid",
        "fulfillment_status": "unfulfilled",
        "shipped_at": None,
        "next_roast_date": d(1),
        "shipping_state": "NY",
        "line_items": [{"sku": "CA-CASA-ES-250g", "title": "Casa Blend / Espresso / 250g", "qty": 1, "price": 19.00}],
        "total": 25.50,
        "_tests": "not yet roasted: order IS still modifiable, agent should say so",
    },
    {
        "order_number": "CA-10244",
        "email": "t.okafor@example.com",
        "customer_name": "Tola Okafor",
        "created_at": d(-9),
        "financial_status": "paid",
        "fulfillment_status": "in_transit",
        "shipped_at": d(-8),
        "last_tracking_movement": d(-7),
        "delivered_at": None,
        "tracking_company": "USPS",
        "tracking_number": "9400100000000000000004",
        "shipping_state": "WA",
        "line_items": [{"sku": "CA-VOLC-FR-1kg", "title": "Volcan Dark / French Press / 1kg", "qty": 1, "price": 62.00}],
        "total": 62.00,
        "_tests": "stalled 7 days: crosses the 5-business-day threshold, agent must offer trace + reship",
    },
    {
        "order_number": "CA-10245",
        "email": "s.lindqvist@example.com",
        "customer_name": "Sara Lindqvist",
        "created_at": d(-4),
        "financial_status": "paid",
        "fulfillment_status": "fulfilled",
        "shipped_at": d(-3),
        "delivered_at": d(-2),
        "tracking_company": "USPS",
        "tracking_number": "9400100000000000000005",
        "shipping_state": "IL",
        "customer_claim": "marked delivered, not received",
        "line_items": [{"sku": "CA-HUIL-WH-500g", "title": "Huila Reserve / Whole Bean / 500g", "qty": 1, "price": 34.00}],
        "total": 34.00,
        "_tests": "delivered-but-missing, 2 days ago: inside the 7-day window, one free reship applies",
    },
    {
        "order_number": "CA-10246",
        "email": "j.whitfield@example.com",
        "customer_name": "James Whitfield",
        "created_at": d(-45),
        "financial_status": "paid",
        "fulfillment_status": "fulfilled",
        "shipped_at": d(-44),
        "delivered_at": d(-41),
        "shipping_state": "TX",
        "line_items": [{"sku": "CA-CASA-FI-1kg", "title": "Casa Blend / Filter / 1kg", "qty": 1, "price": 62.00}],
        "total": 62.00,
        "_tests": "41 days since delivery: OUTSIDE the 30-day window, agent must decline and escalate",
    },
    {
        "order_number": "CA-10247",
        "email": "aiko.tanaka@example.com",
        "customer_name": "Aiko Tanaka",
        "created_at": d(-3),
        "financial_status": "paid",
        "fulfillment_status": "fulfilled",
        "shipped_at": d(-2),
        "delivered_at": d(-1),
        "shipping_state": "OR",
        "roast_date_on_bag": d(-21),
        "line_items": [{"sku": "CA-SERE-FI-250g", "title": "Sereno Decaf / Filter / 250g", "qty": 1, "price": 19.00}],
        "total": 25.50,
        "_tests": "roast date 20 days before delivery: exceeds the 14-day rule, automatic replacement",
    },
    {
        "order_number": "CA-10248",
        "email": "r.mbeki@example.com",
        "customer_name": "Rudo Mbeki",
        "created_at": d(-1),
        "financial_status": "paid",
        "fulfillment_status": "unfulfilled",
        "subscription_id": "SUB-3391",
        "subscription_frequency_weeks": 2,
        "next_charge_at": d(2),
        "shipping_state": "MA",
        "line_items": [{"sku": "CA-HUIL-FI-500g", "title": "Huila Reserve / Filter / 500g", "qty": 1, "price": 30.60}],
        "total": 30.60,
        "_tests": "active subscription before the charge: skip/pause/swap all still possible",
    },
    {
        "order_number": "CA-10249",
        "email": "gift.buyer@example.com",
        "customer_name": "Elena Ruiz",
        "recipient_name": "Paul Ruiz",
        "created_at": d(-5),
        "financial_status": "paid",
        "fulfillment_status": "fulfilled",
        "shipped_at": d(-4),
        "delivered_at": d(-2),
        "is_gift": True,
        "shipping_state": "CO",
        "line_items": [{"sku": "CA-ORIGIN-WHO", "title": "Origin Sampler / Whole Bean", "qty": 1, "price": 32.00}],
        "total": 38.50,
        "_tests": "gift order: recipient may request replacement, but refund goes to purchaser only",
    },
    {
        "order_number": "CA-10250",
        "email": "big.spender@example.com",
        "customer_name": "Nathan Cole",
        "created_at": d(-3),
        "financial_status": "paid",
        "fulfillment_status": "fulfilled",
        "shipped_at": d(-2),
        "delivered_at": d(-1),
        "shipping_state": "NJ",
        "line_items": [
            {"sku": "CA-GOOSEN-MAT", "title": "Gooseneck Kettle / Matte Black", "qty": 1, "price": 69.00},
            {"sku": "CA-DIGITA", "title": "Digital Brew Scale", "qty": 1, "price": 39.00},
            {"sku": "CA-VOLC-WH-1kg", "title": "Volcan Dark / Whole Bean / 1kg", "qty": 1, "price": 62.00},
        ],
        "total": 170.00,
        "_tests": "refund would exceed $150: requires supervisor approval, must escalate",
    },
    {
        "order_number": "CA-10251",
        "email": "cancelled.cust@example.com",
        "customer_name": "Grace Odum",
        "created_at": d(-8),
        "financial_status": "refunded",
        "fulfillment_status": "cancelled",
        "cancelled_at": d(-7),
        "shipping_state": "AZ",
        "line_items": [{"sku": "CA-CASA-FI-250g", "title": "Casa Blend / Filter / 250g", "qty": 1, "price": 19.00}],
        "total": 0.00,
        "_tests": "already refunded: agent must not promise a second refund",
    },
    {
        "order_number": "CA-10252",
        "email": "hawaii.cust@example.com",
        "customer_name": "Keoni Alana",
        "created_at": d(-5),
        "financial_status": "paid",
        "fulfillment_status": "in_transit",
        "shipped_at": d(-4),
        "delivered_at": None,
        "shipping_state": "HI",
        "line_items": [{"sku": "CA-CASA-WH-500g", "title": "Casa Blend / Whole Bean / 500g", "qty": 1, "price": 34.00}],
        "total": 34.00,
        "_tests": "Hawaii: 6-9 day transit, agent must not apply mainland timing",
    },
]


def build_summary(products, orders):
    variant_count = sum(len(p["variants"]) for p in products)
    by_type = {}
    for p in products:
        by_type[p["product_type"]] = by_type.get(p["product_type"], 0) + 1
    lines = [
        "# Cerro Alto Coffee — demo data summary",
        "",
        f"Generated deterministically from `scripts/generate_catalog.py`. Anchor date: **{TODAY.isoformat()}**.",
        "",
        "## Catalog",
        "",
        f"- Products: **{len(products)}**",
        f"- Variants (SKUs): **{variant_count}**",
        "",
        "| Product type | Count |",
        "|---|---|",
    ]
    for k in sorted(by_type):
        lines.append(f"| {k} | {by_type[k]} |")
    lines += [
        "",
        "## Test orders",
        "",
        f"- Orders: **{len(orders)}**",
        "",
        "Each order exercises one specific agent behaviour:",
        "",
        "| Order | State | What it tests |",
        "|---|---|---|",
    ]
    for o in orders:
        lines.append(f"| {o['order_number']} | {o['fulfillment_status']} | {o['_tests']} |")
    lines += [
        "",
        "## Note on `body_html`",
        "",
        "Product descriptions and SEO fields are intentionally left **empty**. Populating them",
        "is the job of project `03-catalog-pipeline`, which is what makes the before/after",
        "comparison in that case study real rather than staged.",
        "",
    ]
    return "\n".join(lines)


def main():
    os.makedirs(OUT, exist_ok=True)
    products = build_products()

    with open(os.path.join(OUT, "products.json"), "w") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)
        f.write("\n")

    with open(os.path.join(OUT, "orders.json"), "w") as f:
        json.dump(ORDERS, f, indent=2, ensure_ascii=False)
        f.write("\n")

    with open(os.path.join(OUT, "summary.md"), "w") as f:
        f.write(build_summary(products, ORDERS))

    variants = sum(len(p["variants"]) for p in products)
    print(f"products.json  {len(products)} products / {variants} variants")
    print(f"orders.json    {len(ORDERS)} orders")
    print(f"summary.md     written")


if __name__ == "__main__":
    main()
