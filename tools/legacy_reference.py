"""Reference fingerprint of the Streamlit version's synthetic SAP data (app.py v6.2).

The Streamlit app built 150 vendor accounts and their purchase orders in memory with Python's
random module, seed 1337 (generate_enterprise_sap_data). This script repeats exactly those
random calls, in the same order, with the standard library only (the app's final pandas shuffle
only reorders the orders and is left out), and prints a fingerprint of the result.

tools/legacy_seed.mjs regenerates the same data in JavaScript for tools/build_world.mjs;
tests/engine.mjs checks it against the values this script prints, which are copied into that
test. Run it from the repository root:

    python3 tools/legacy_reference.py
"""

import hashlib
import json
import random

CORE = [
    ("10001", "Cisco Systems Germany GmbH", "Bonn", "DE", "DE123456780", 18_200_000.0),
    ("10002", "Cisco Technology Inc.", "San Jose", "US", "US987654321", 14_100_000.0),
    ("10003", "Meraki Cloud Networks Ltd.", "London", "GB", "GB554433221", 9_500_000.0),
    ("10004", "Acacia Communications Opto", "Maynard", "US", "US112233445", 6_200_000.0),
    ("10005", "Splunk Software EMEA", "Munich", "DE", "DE887766554", 4_400_000.0),
    ("20001", "Microsoft Deutschland GmbH", "Munich", "DE", "DE998877665", 41_000_000.0),
    ("20002", "Activision Blizzard Germany", "Ismaning", "DE", "DE556677889", 6_000_000.0),
    ("40001", "Apex Robotics Solutions GmbH", "Stuttgart", "DE", "DE606060601", 2_300_000.0),
    ("40002", "Apex Robotics Systems Ltd.", "Manchester", "GB", "GB707070702", 1_900_000.0),
]


def generate():
    random.seed(1337)
    stems = ["Logistics", "Facility", "Consulting", "MRO", "Packaging",
             "IT-Services", "Robotics", "Chemicals", "Security", "Fleet"]
    cities = ["Frankfurt", "Stuttgart", "Hamburg", "Berlin", "Düsseldorf",
              "Paris", "Zurich", "Vienna", "Milan", "Madrid", "Amsterdam"]
    prefixes = ["Global", "Nova", "Sino", "Euro", "Chroma", "Stellar", "Vanguard", "Omni", "Inno"]

    fillers = []
    for i in range(8, 149):
        spend = round(random.uniform(15000.0, 3_800_000.0), 2)
        fillers.append((
            f"{30000 + i}",
            f"{random.choice(prefixes)} {random.choice(stems)} {random.choice(['GmbH', 'AG', 'S.A.', 'Ltd'])}",
            random.choice(cities),
            random.choice(["DE", "FR", "CH", "AT", "IT", "ES", "NL"]),
            f"EU{random.randint(100000000, 999999999)}",
            spend,
        ))

    vendors = CORE + fillers
    po_counts = {"10001": 30, "10002": 25, "10003": 20, "10004": 15, "10005": 10,
                 "20001": 35, "20002": 15, "40001": 9, "40002": 8}
    for idx, v in enumerate(fillers):
        po_counts[v[0]] = 8 if idx < 49 else 7

    orders = []
    ebeln = 4500000001
    for v in vendors:
        n_pos = po_counts[v[0]]
        target_cents = int(v[5] * 100)
        cuts = sorted([random.randint(1, target_cents - 1) for _ in range(n_pos - 1)])
        cuts = [0] + cuts + [target_cents]
        for k in range(len(cuts) - 1):
            cents = cuts[k + 1] - cuts[k]
            aedat = f"2026-{random.randint(1, 5):02d}-{random.randint(1, 28):02d}"
            orders.append((str(ebeln), v[0], aedat, cents))
            ebeln += 1
    return vendors, orders


def fingerprint(vendors, orders):
    lines = [f"V|{v[0]}|{v[1]}|{v[2]}|{v[3]}|{v[4]}|{v[5]:.2f}" for v in vendors]
    lines += [f"O|{o[0]}|{o[1]}|{o[2]}|{o[3]}" for o in orders]
    return {
        "vendors": len(vendors),
        "orders": len(orders),
        "spend_cents": sum(round(v[5] * 100) for v in vendors),
        "order_cents": sum(o[3] for o in orders),
        "first_filler": f"{vendors[9][0]} {vendors[9][1]} ({vendors[9][2]}) {vendors[9][5]:.2f}",
        "last_order": "|".join(str(x) for x in orders[-1]),
        "sha256": hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest(),
    }


if __name__ == "__main__":
    print(json.dumps(fingerprint(*generate()), indent=2, ensure_ascii=False))
