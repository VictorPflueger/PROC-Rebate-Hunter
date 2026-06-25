# ==============================================================================
# PROC Rebate Hunter — v6.2 "Agentic Single-Flow, KISS Edition"
# ------------------------------------------------------------------------------
# Single-File Streamlit-Prototyp. Geführter Single-Screen-Flow: EIN Button löst
# eine Agentenkette aus. Ein Vorgangs-Token (dict) wird sequenziell durch die
# Agenten gereicht und pro Stufe um Ergebnis + Evidenz angereichert. Genau EINE
# Human-in-the-Loop-Freigabe (Pflicht-Grund). Ehrliche LIVE/SIMULIERT-Trennung.
# Alle Anwender-Texte in einfacher Sprache (KISS), Erklärung pro Schritt.
#
# Stack (requirements.txt unverändert): streamlit, pandas, plotly + stdlib.
#
# Mobile/Laptop: responsive layer in inject_css() (CSS-only, @media queries) —
# Pipeline-Pills umbrechen, st.columns stapeln auf dem Handy, Schriftgrößen
# passen sich an. Keine Änderung an der Python-Layout-Logik nötig.
# ==============================================================================

import json
import time
import random
from datetime import datetime
from difflib import SequenceMatcher

import pandas as pd
import streamlit as st
import plotly.graph_objects as go

# Simulierte KI-Bearbeitungszeit pro Schritt (nur Optik; ehrlich gekennzeichnet).
SIM_DELAY = 0.7

st.set_page_config(
    page_title="PROC Rebate Hunter | GlobalCorp SE",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="collapsed",
)


# ==============================================================================
# 0. CSS (Apple Cupertino Dark Mode + Pipeline-Pills + Responsive Layer)
# ==============================================================================
def inject_css():
    st.markdown("""
    <style>
    .stApp {
        background-color: #0A0A0C !important; color: #F5F5F7 !important;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif;
    }
    .frosted-glass {
        background: rgba(28, 28, 30, 0.65) !important; backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important; border: 1px solid rgba(255,255,255,0.08) !important;
        border-radius: 16px !important; padding: 24px !important; box-shadow: 0 12px 40px 0 rgba(0,0,0,0.45) !important;
    }
    div.stButton > button:first-child {
        background-color: #007AFF !important; color: #FFFFFF !important; border-radius: 12px !important;
        font-weight: 600 !important; letter-spacing: 0.3px !important; border: none !important;
        padding: 12px 24px !important; transition: all 0.2s ease-in-out;
    }
    div.stButton > button:first-child:hover {
        background-color: #0062CC !important; transform: scale(1.01); box-shadow: 0 0 20px rgba(0,122,255,0.4);
    }
    .pipeline-track {
        display: flex; justify-content: space-between; align-items: stretch; background: rgba(18,18,20,0.8);
        padding: 14px 16px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06);
        margin-bottom: 8px; gap: 8px;
    }
    .agent-pill {
        flex: 1; text-align: center; padding: 12px 6px; border-radius: 10px; font-size: 12.5px;
        font-weight: 600; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.04); transition: all 0.4s cubic-bezier(0.16,1,0.3,1);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .agent-pill.active {
        color:#FFFFFF; background:rgba(0,122,255,0.18); border-color:#007AFF;
        box-shadow:0 0 18px rgba(0,122,255,0.35); transform:translateY(-2px);
    }
    .agent-pill.done { color:#30D158; background:rgba(48,209,88,0.12); border-color:#30D158; }
    .agent-pill.human { border-style: dashed; }
    .agent-pill.human.active {
        color:#FFD60A; background:rgba(255,214,10,0.16); border-color:#FFD60A; box-shadow:0 0 18px rgba(255,214,10,0.30);
    }
    .agent-pill.human.done { color:#FFD60A; background:rgba(255,214,10,0.10); border-color:#FFD60A; }
    .pill-sub { display:block; font-size:10px; font-weight:500; opacity:0.7; margin-top:2px; }
    .tag { font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:6px; letter-spacing:0.4px; vertical-align:middle; }
    .tag-live { color:#30D158; background:rgba(48,209,88,0.12); border:1px solid #30D158; }
    .tag-stub { color:#FF9F0A; background:rgba(255,159,10,0.12); border:1px solid #FF9F0A; }
    .explain {
        background:rgba(0,122,255,0.06); border:1px solid rgba(0,122,255,0.25); border-radius:10px;
        padding:12px 14px; margin-bottom:14px; font-size:13.5px; line-height:1.55;
    }
    .apple-mail-box {
        background-color:#161618; border:1px solid #2C2C30; border-radius:14px; padding:22px;
        font-family:-apple-system, BlinkMacSystemFont,"SF Pro Text",sans-serif; box-shadow:0 8px 30px rgba(0,0,0,0.5);
    }
    .mail-row { margin-bottom:6px; font-size:13px; color:#8E8E93; }
    .mail-row span.val { color:#FFFFFF; font-weight:500; }
    .mail-divider { border-top:1px solid #2C2C30; margin:14px 0; }
    div[data-testid="stMetricValue"] { font-size:28px !important; font-weight:700 !important; letter-spacing:-0.5px !important; }

    /* ======================================================================
       RESPONSIVE LAYER — mobile + small-laptop view (CSS-only)
       ====================================================================== */

    /* Long currency strings in metrics never overflow their column */
    div[data-testid="stMetricValue"] { white-space: normal !important; overflow-wrap: anywhere; }

    /* Tablet / small laptop: let the 6-pill pipeline wrap instead of
       truncating labels with an ellipsis */
    @media (max-width: 860px) {
        .pipeline-track { flex-wrap: wrap; gap: 6px; padding: 10px 10px; }
        .agent-pill {
            flex: 1 1 30%;            /* ~3 pills per row */
            min-width: 92px;
            white-space: normal;      /* allow the label to wrap, no cut-off */
            font-size: 12px;
            padding: 10px 4px;
        }
        .pill-sub { font-size: 9.5px; }
    }

    /* Phones / narrow windows: stack Streamlit columns vertically.
       By default st.columns stays horizontal and squishes; this forces each
       column to a full-width row so metrics/buttons read cleanly. */
    @media (max-width: 640px) {
        div[data-testid="stHorizontalBlock"] { flex-wrap: wrap; }
        div[data-testid="stHorizontalBlock"] [data-testid="stColumn"],
        div[data-testid="stHorizontalBlock"] [data-testid="column"] {
            flex: 1 1 100% !important;
            width: 100% !important;
            min-width: 100% !important;
        }
        .frosted-glass { padding: 16px !important; border-radius: 14px !important; }
        .stApp h1 { font-size: 22px !important; line-height: 1.2 !important; }
        div[data-testid="stMetricValue"] { font-size: 20px !important; }
        .explain { font-size: 13px; padding: 10px 12px; }
        .apple-mail-box { padding: 16px; }
        .block-container,
        div[data-testid="stMainBlockContainer"] {
            padding-left: 0.8rem !important; padding-right: 0.8rem !important;
        }
    }

    /* Very small phones: 2 pills per row, smaller metric values */
    @media (max-width: 430px) {
        .agent-pill { flex: 1 1 45%; }
        div[data-testid="stMetricValue"] { font-size: 18px !important; }
    }
    </style>
    """, unsafe_allow_html=True)


inject_css()


def fmt_curr(val):
    return f"{val:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def fmt_mio(val):
    return f"{val/1_000_000:,.1f} Mio. €".replace(",", "X").replace(".", ",").replace("X", ".")


def explain(business, value):
    st.markdown(
        f'<div class="explain"><b>Worum geht\u2019s?</b> {business}<br>'
        f'<b>Was macht die KI hier?</b> {value}</div>',
        unsafe_allow_html=True)


# ==============================================================================
# 1. FACHLICHE KONSTANTEN
# ==============================================================================
THRESHOLD = 50_000_000.0  # Vertragsgrenze: ab dieser konsolidierten Summe gibt es eine Rückvergütung (Rebate)
RATE = 0.02               # Rückvergütungssatz (Rebate-Satz)

CISCO_IDS = ["10001", "10002", "10003", "10004", "10005"]
MSFT_IDS = ["20001", "20002"]

CORE_VENDORS = [
    {"LIFNR": "10001", "NAME1": "Cisco Systems Germany GmbH", "ORT01": "Bonn", "LAND1": "DE", "STCD1": "DE123456780", "SPEND_YTD": 18_200_000.0},
    {"LIFNR": "10002", "NAME1": "Cisco Technology Inc.", "ORT01": "San Jose", "LAND1": "US", "STCD1": "US987654321", "SPEND_YTD": 14_100_000.0},
    {"LIFNR": "10003", "NAME1": "Meraki Cloud Networks Ltd.", "ORT01": "London", "LAND1": "GB", "STCD1": "GB554433221", "SPEND_YTD": 9_500_000.0},
    {"LIFNR": "10004", "NAME1": "Acacia Communications Opto", "ORT01": "Maynard", "LAND1": "US", "STCD1": "US112233445", "SPEND_YTD": 6_200_000.0},
    {"LIFNR": "10005", "NAME1": "Splunk Software EMEA", "ORT01": "Munich", "LAND1": "DE", "STCD1": "DE887766554", "SPEND_YTD": 4_400_000.0},
    {"LIFNR": "20001", "NAME1": "Microsoft Deutschland GmbH", "ORT01": "Munich", "LAND1": "DE", "STCD1": "DE998877665", "SPEND_YTD": 41_000_000.0},
    {"LIFNR": "20002", "NAME1": "Activision Blizzard Germany", "ORT01": "Ismaning", "LAND1": "DE", "STCD1": "DE556677889", "SPEND_YTD": 6_000_000.0},
    # Bewusstes Lookalike-Paar: fast gleiche Namen, ABER verschiedene Eigentümer -> kein Merge.
    {"LIFNR": "40001", "NAME1": "Apex Robotics Solutions GmbH", "ORT01": "Stuttgart", "LAND1": "DE", "STCD1": "DE606060601", "SPEND_YTD": 2_300_000.0},
    {"LIFNR": "40002", "NAME1": "Apex Robotics Systems Ltd.", "ORT01": "Manchester", "LAND1": "GB", "STCD1": "GB707070702", "SPEND_YTD": 1_900_000.0},
]

# Geprüftes Firmen-Register (offizielle Quelle, hier SIMULIERT) = EINZIGE Merge-Autorität.
# Nur ein verifizierter gemeinsamer Eigentümer (LEI beginnt mit '529900') führt zur Zusammenlegung.
# Ähnliche Namen oder gleiche Stadt sind ausdrücklich KEIN Grund zum Zusammenlegen.
PARENT_KB = {
    "10001": ("Cisco Systems, Inc.", "529900CISCO0001", "Mutterkonzern (Sitz San Jose)"),
    "10002": ("Cisco Systems, Inc.", "529900CISCO0001", "US-Stammgesellschaft"),
    "10003": ("Cisco Systems, Inc.", "529900CISCO0001", "Meraki – 2012 von Cisco gekauft"),
    "10004": ("Cisco Systems, Inc.", "529900CISCO0001", "Acacia – 2021 von Cisco gekauft"),
    "10005": ("Cisco Systems, Inc.", "529900CISCO0001", "Splunk – 2024 von Cisco gekauft"),
    "20001": ("Microsoft Corporation", "529900MSFT00001", "Mutterkonzern (Sitz Redmond)"),
    "20002": ("Microsoft Corporation", "529900MSFT00001", "Activision Blizzard – 2023 von Microsoft gekauft"),
    "40001": ("Apex Robotics Holding AG", "UNVERIFIZIERT-DE", "Register: eigenständiger DE-Konzern"),
    "40002": ("Apex Industrial Group plc", "UNVERIFIZIERT-GB", "Register: anderer GB-Konzern (kein Bezug zu 40001)"),
}

VERTRAGSREGEL = ("Ab 50 Mio. € Einkauf pro Jahr (alle zugehörigen Firmen zusammengerechnet) "
                 "gibt es 2 % Rückvergütung (Rebate).")

REASON_CODES = [
    "— bitte Grund wählen —",
    "Geprüft: Firmen-Zuordnung stimmt",
    "Geprüft: Grenze klar überschritten",
    "Geprüft: Stichprobe der Rechnungen ist plausibel",
    "Ablehnung: Belege reichen nicht aus",
    "Ablehnung: Grenze nicht erreicht – keine Buchung",
]

CFO_NAME = "Dr. Henrik von Bohlen (Finanzchef)"

# (icon, Kurz-Label, Unter-Label, Art)
PIPELINE = [
    ("📥", "1 Daten holen", "Lieferanten laden", "stub"),
    ("🧩", "2 Firmen erkennen", "wer gehört zusammen", "live"),
    ("📄", "3 Vertrag lesen", "die Regel finden", "stub"),
    ("🧮", "4 Summe prüfen", "Rebate fällig?", "live"),
    ("🧑\u200d⚖️", "5 Mensch entscheidet", "Freigabe", "human"),
    ("✅", "6 Buchen & E-Mail", "Beleg + Entwurf", "stub"),
]


# ==============================================================================
# 2. DETERMINISTISCHER IN-MEMORY-DATENGENERATOR (150 Lieferanten)
# ==============================================================================
@st.cache_data
def generate_enterprise_sap_data():
    random.seed(1337)
    stems = ["Logistics", "Facility", "Consulting", "MRO", "Packaging",
             "IT-Services", "Robotics", "Chemicals", "Security", "Fleet"]
    cities = ["Frankfurt", "Stuttgart", "Hamburg", "Berlin", "Düsseldorf",
              "Paris", "Zurich", "Vienna", "Milan", "Madrid", "Amsterdam"]
    prefixes = ["Global", "Nova", "Sino", "Euro", "Chroma", "Stellar", "Vanguard", "Omni", "Inno"]

    fillers = []
    for i in range(8, 149):  # 141 Filler -> 9 Kern + 141 = 150
        spend = round(random.uniform(15000.0, 3_800_000.0), 2)
        fillers.append({
            "LIFNR": f"{30000 + i}",
            "NAME1": f"{random.choice(prefixes)} {random.choice(stems)} {random.choice(['GmbH', 'AG', 'S.A.', 'Ltd'])}",
            "ORT01": random.choice(cities),
            "LAND1": random.choice(["DE", "FR", "CH", "AT", "IT", "ES", "NL"]),
            "STCD1": f"EU{random.randint(100000000, 999999999)}",
            "SPEND_YTD": spend,
        })

    all_vendors = CORE_VENDORS + fillers
    df_lfa1 = pd.DataFrame(all_vendors)

    po_counts = {"10001": 30, "10002": 25, "10003": 20, "10004": 15, "10005": 10,
                 "20001": 35, "20002": 15, "40001": 9, "40002": 8}
    for idx, v in enumerate(fillers):
        po_counts[v["LIFNR"]] = 8 if idx < 49 else 7

    ekko_rows = []
    ebeln_base = 4500000001
    for v in all_vendors:
        lifnr = v["LIFNR"]
        n_pos = po_counts[lifnr]
        target_cents = int(v["SPEND_YTD"] * 100)
        cutpoints = sorted([random.randint(1, target_cents - 1) for _ in range(n_pos - 1)])
        cutpoints = [0] + cutpoints + [target_cents]
        for k in range(len(cutpoints) - 1):
            netwr = (cutpoints[k + 1] - cutpoints[k]) / 100.0
            ekko_rows.append({
                "EBELN": str(ebeln_base), "LIFNR": lifnr, "BUKRS": "1000",
                "AEDAT": f"2026-{random.randint(1, 5):02d}-{random.randint(1, 28):02d}",
                "NETWR": netwr, "WAERS": "EUR",
            })
            ebeln_base += 1

    df_ekko = pd.DataFrame(ekko_rows).sample(frac=1, random_state=42).reset_index(drop=True)
    return df_lfa1, df_ekko


df_lfa1, df_ekko = generate_enterprise_sap_data()


# ==============================================================================
# 3. LIVE-KERN: DETERMINISTISCHE, ERKLÄRBARE ZUSAMMENLEGUNG + GÜTE-MESSUNG
# ==============================================================================
def resolve_entities(df):
    """Legt Einträge NUR über einen geprüften gemeinsamen Eigentümer zusammen.
    Rückgabe: dict cluster_key -> {parent, lei, verified, members[], evidence[]}."""
    clusters = {}
    for _, r in df.iterrows():
        lifnr = r["LIFNR"]
        if lifnr in PARENT_KB:
            parent, lei, note = PARENT_KB[lifnr]
            verified = lei.startswith("529900")
            key = parent if verified else f"SINGLE::{lifnr}"
        else:
            parent, lei, note, verified = ("(kein Register-Eintrag)", "—", "Einzelfirma: kein geprüfter Eigentümer", False)
            key = f"SINGLE::{lifnr}"
        c = clusters.setdefault(key, {"parent": parent, "lei": lei, "verified": verified, "members": [], "evidence": []})
        c["members"].append(lifnr)
        c["evidence"].append({"Eintrag-Nr.": lifnr, "Name im System": r["NAME1"], "Stadt": r["ORT01"],
                              "Land": r["LAND1"], "Begründung der Zuordnung": note, "Quelle": "Firmen-Register (simuliert)"})
    return clusters


def ground_truth_labels(df):
    gt = {}
    for lifnr in df["LIFNR"]:
        if lifnr in CISCO_IDS:
            gt[lifnr] = "GT_CISCO"
        elif lifnr in MSFT_IDS:
            gt[lifnr] = "GT_MSFT"
        else:
            gt[lifnr] = f"GT_{lifnr}"  # Apex 40001/40002 getrennt; Filler je einzeln
    return gt


def pred_labels(clusters):
    lab = {}
    for key, c in clusters.items():
        for m in c["members"]:
            lab[m] = key
    return lab


def pairwise_metrics(pred, gt):
    ids = list(gt.keys())
    tp = fp = fn = 0
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            a, b = ids[i], ids[j]
            same_pred = pred[a] == pred[b]
            same_true = gt[a] == gt[b]
            if same_pred and same_true:
                tp += 1
            elif same_pred and not same_true:
                fp += 1
            elif (not same_pred) and same_true:
                fn += 1
    precision = tp / (tp + fp) if (tp + fp) else 1.0
    recall = tp / (tp + fn) if (tp + fn) else 1.0
    return {"precision": precision, "recall": recall, "false_merges": fp, "tp": tp, "fn": fn}


def name_similarity(a, b):
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


@st.cache_data
def compute_quality():
    clusters = resolve_entities(df_lfa1)
    gt = ground_truth_labels(df_lfa1)
    metrics = pairwise_metrics(pred_labels(clusters), gt)
    nm = {r["LIFNR"]: r["NAME1"] for _, r in df_lfa1.iterrows()}
    apex_sim = name_similarity(nm["40001"], nm["40002"])
    cisco_meraki_sim = name_similarity(nm["10001"], nm["10003"])
    return clusters, metrics, apex_sim, cisco_meraki_sim


CLUSTERS, METRICS, APEX_SIM, CISCO_MERAKI_SIM = compute_quality()


# ==============================================================================
# 4. STATE-HELPER
# ==============================================================================
def init_state():
    st.session_state.setdefault("token", None)
    st.session_state.setdefault("audit_log", [])  # append-only
    st.session_state.setdefault("target", "CISCO")


def log_audit(token, actor, stage, action, detail):
    st.session_state["audit_log"].append({
        "Zeitstempel": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "Vorgang": token.get("vorgang_id", "—"),
        "Wer": actor,
        "Schritt": stage,
        "Aktion": action,
        "Detail": detail,
    })


def claim_ids_for_target(target):
    return {"CISCO": CISCO_IDS, "MICROSOFT": MSFT_IDS, "APEX": ["40001"]}[target]


# ==============================================================================
# 5. AGENTEN — agent(token) -> token
# ==============================================================================
def agent_ingestion(token):
    ekko_focus = int(df_ekko[df_ekko["LIFNR"].isin(token["claim_ids"])].shape[0])
    token["ingestion"] = {
        "modus": "SIMULIERT",
        "quelle": "Lieferanten- und Rechnungsdaten aus dem Firmen-System (für die Demo nachgestellt)",
        "lieferanten_gesamt": int(df_lfa1.shape[0]),
        "rechnungen_gesamt": int(df_ekko.shape[0]),
        "fokus_eintraege": token["claim_ids"],
        "fokus_rechnungen": ekko_focus,
    }
    token["stage_idx"] = 0
    log_audit(token, "Agent 1 (Daten holen)", "Daten holen", "Daten geladen (simuliert)",
              f"{df_lfa1.shape[0]} Lieferanten / {df_ekko.shape[0]} Rechnungen; Fokus {len(token['claim_ids'])} Einträge")
    return token


def agent_resolution(token):
    primary = token["claim_ids"][0]
    cluster = CLUSTERS[pred_labels(CLUSTERS)[primary]]
    token["resolution"] = {
        "modus": "LIVE",
        "regel": "Zusammengelegt wird nur bei geprüftem gemeinsamen Eigentümer – nicht bei ähnlichen Namen oder gleicher Stadt.",
        "firma": cluster["parent"],
        "register_id": cluster["lei"],
        "zusammengehoerende_eintraege": cluster["members"],
        "anzahl_eintraege": len(cluster["members"]),
        "evidenz": cluster["evidence"],
        "guete": {
            "genauigkeit_pct": round(METRICS["precision"] * 100, 1),    # keine falschen Zusammenlegungen
            "vollstaendigkeit_pct": round(METRICS["recall"] * 100, 1),  # nichts übersehen
            "falsch_zusammengelegt": METRICS["false_merges"],
        },
        "vorsicht_beispiel": {
            "paar": "Apex Robotics Solutions GmbH (40001) ↔ Apex Robotics Systems Ltd. (40002)",
            "entscheidung": "bewusst NICHT zusammengelegt – verschiedene Eigentümer",
            "namensaehnlichkeit_pct": round(APEX_SIM * 100, 1),
        },
    }
    token["stage_idx"] = 1
    log_audit(token, "Agent 2 (Firmen erkennen)", "Firmen erkennen", "Einträge zu einer Firma zusammengelegt (LIVE)",
              f"{len(cluster['members'])} Einträge → 1 Firma '{cluster['parent']}'; "
              f"0 falsche Zusammenlegungen")
    return token


def agent_contract(token):
    token["contract"] = {
        "modus": "SIMULIERT",
        "quelle": "Vertragsdokument (für die Demo hinterlegt, keine echte automatische Texterkennung)",
        "grenze_eur": THRESHOLD,
        "satz": RATE,
        "regel": VERTRAGSREGEL,
    }
    token["stage_idx"] = 2
    log_audit(token, "Agent 3 (Vertrag lesen)", "Vertrag lesen", "Vertragsregel gefunden (simuliert)",
              f"Grenze {fmt_mio(THRESHOLD)} / {RATE*100:.0f} % Rückvergütung")
    return token


def agent_finance(token):
    members = token["resolution"]["zusammengehoerende_eintraege"]
    dff = df_lfa1[df_lfa1["LIFNR"].isin(members)]
    consolidated = float(dff["SPEND_YTD"].sum())
    silo_max = float(dff["SPEND_YTD"].max())
    qualified = consolidated >= THRESHOLD
    cashback = round(consolidated * RATE, 2) if qualified else 0.0
    token["finance"] = {
        "modus": "LIVE",
        "groesster_einzeleintrag": silo_max,
        "echte_gesamtsumme": consolidated,
        "zusatz_durch_ki": consolidated - silo_max,
        "grenze": THRESHOLD,
        "anspruch": qualified,
        "rueckverguetung": cashback,
        "ergebnis": ("ANSPRUCH" if qualified else "KEIN ANSPRUCH"),
    }
    token["stage_idx"] = 3
    token["status"] = "AWAITING_APPROVAL"
    log_audit(token, "Agent 4 (Summe prüfen)", "Summe prüfen", "Summe gebildet & mit Grenze verglichen (LIVE)",
              f"{fmt_curr(consolidated)} vs. {fmt_mio(THRESHOLD)} → {token['finance']['ergebnis']}; "
              f"Rückvergütung {fmt_curr(cashback)}")
    return token


def agent_booking(token):
    fin = token["finance"]
    members = token["resolution"]["zusammengehoerende_eintraege"]
    dff = df_lfa1[df_lfa1["LIFNR"].isin(members)]
    vendor_lines = "".join(
        f"• {r['LIFNR']}: {r['NAME1']} ({r['ORT01']}) — {fmt_curr(r['SPEND_YTD'])}<br>"
        for _, r in dff.iterrows()
    )
    beleg_id = "4900" + datetime.now().strftime("%H%M%S")
    token["booking"] = {
        "modus": "SIMULIERT",
        "buchung": "Buchung im Firmen-System (für die Demo nachgestellt, keine echte Buchung)",
        "beleg_id": beleg_id,
        "buchungstext": f"Rückvergütung gutgeschrieben: {fmt_curr(fin['rueckverguetung'])}",
        "mail_draft": {
            "status": "NUR ENTWURF – wird nicht automatisch verschickt",
            "an": CFO_NAME,
            "betreff": f"Rückvergütung gesichert: +{fmt_curr(fin['rueckverguetung'])} bei {token['parent']}",
            "vendor_lines": vendor_lines,
        },
    }
    token["stage_idx"] = 5
    token["status"] = "BOOKED"
    log_audit(token, "Agent 6 (Buchen)", "Buchen", "Beleg angelegt (simuliert) & E-Mail-Entwurf erstellt",
              f"Beleg #{beleg_id}; {fmt_curr(fin['rueckverguetung'])}; E-Mail = nur Entwurf")
    return token


# ==============================================================================
# 6. PIPELINE-RENDERING
# ==============================================================================
def pipeline_html(done_until, active_idx=None, awaiting=False, rejected=False):
    html = '<div class="pipeline-track">'
    for i, (icon, label, sub, kind) in enumerate(PIPELINE):
        cls = "agent-pill" + (" human" if kind == "human" else "")
        if i <= done_until:
            status = "done"
        elif active_idx is not None and i == active_idx:
            status = "active"
        elif awaiting and i == 4:
            status = "active"
        else:
            status = ""
        if rejected and i == 5:
            sub = "übersprungen"
        html += f'<div class="{cls} {status}">{icon} {label}<span class="pill-sub">{sub}</span></div>'
    return html + "</div>"


def render_pipeline(token):
    if not token:
        return pipeline_html(done_until=-1)
    cur = token.get("stage_idx", -1)
    status = token.get("status", "")
    return pipeline_html(done_until=cur,
                         awaiting=(status == "AWAITING_APPROVAL"),
                         rejected=(status == "REJECTED"))


# ==============================================================================
# 7. APP
# ==============================================================================
init_state()

st.markdown("""
<div class="frosted-glass" style="margin-bottom: 14px;">
    <h1 style="margin:0; font-size: 30px; font-weight: 800; letter-spacing:-1px;">
        PROC Rebate Hunter <span style="color:#007AFF; font-size:18px;">v6.2 · einfach erklärt</span>
    </h1>
    <p style="margin:10px 0 0 0; font-size:14.5px; line-height:1.6; color:#E5E5EA;">
        <b>Das Problem in einem Satz:</b> Ein großer Konzern kauft bei einem Lieferanten so viel ein, dass er
        laut Vertrag eine Rückvergütung (englisch: Rebate) bekommt – merkt es aber nicht, weil derselbe Lieferant im Computer-System
        unter vielen verschiedenen Namen gespeichert ist.<br><br>
        <b>Ein Beispiel:</b> Mit „Cisco“ gibt es die Abmachung: Wer pro Jahr mehr als <b>50 Mio. €</b> einkauft,
        bekommt <b>2 %</b> Rückvergütung. Im System steht Cisco aber als <b>5 getrennte Firmen</b> (verschiedene Länder,
        leicht andere Namen). Jede einzelne liegt unter 50 Mio. €, also meldet das normale System: „Keine Rückvergütung.“
        Zusammengerechnet sind es aber <b>52,4 Mio. €</b> – dem Konzern stehen also <b>1.048.000 €</b> zu.<br><br>
        <b>Was dieses Programm macht:</b> Sechs kleine KI-Programme („Agenten“) arbeiten wie ein Team nacheinander:
        Daten holen → erkennen, welche Einträge dieselbe Firma sind → die Vertragsregel lesen → die Summe rechnen →
        <b>einen Menschen einmal final entscheiden lassen</b> → die Rückvergütung buchen. Der Nutzen: Rückvergütungen, die sonst unbemerkt
        liegen bleiben, werden sichtbar und sicher zurückgeholt – und jeder Schritt ist nachvollziehbar.
    </p>
</div>
""", unsafe_allow_html=True)

# Platzhalter für die Fortschrittsleiste (oben, wird ggf. animiert befüllt)
ph_pipe = st.empty()

st.markdown(
    '<div style="margin:0 2px 16px 2px; font-size:12px; color:#8E8E93;">'
    '<span class="tag tag-live">LIVE</span> dieser Teil rechnet wirklich &nbsp;·&nbsp; '
    '<span class="tag tag-stub">SIMULIERT</span> für die Demo nachgestellt (z. B. der Zugriff aufs echte SAP-System) '
    '&nbsp;·&nbsp; Zusammengelegt wird nur bei geprüftem gemeinsamen Eigentümer.'
    '</div>', unsafe_allow_html=True)

# ---- Steuerleiste ----
token = st.session_state["token"]
running = token is not None

c1, c2, c3 = st.columns([1.7, 1.0, 1.0])
with c1:
    options = ["CISCO", "MICROSOFT", "APEX"]
    target_label = st.selectbox(
        "Welches Beispiel?",
        options=options,
        index=options.index(st.session_state["target"]),
        format_func=lambda x: {
            "CISCO": "Cisco – Erfolg (Rückvergütung)",
            "MICROSOFT": "Microsoft – kein Anspruch (Summe zu klein)",
            "APEX": "Apex – Vorsicht (sieht gleich aus, ist es aber nicht)",
        }[x],
        disabled=running,
        help="Bei laufendem Vorgang zuerst „Zurücksetzen“.",
    )
    st.session_state["target"] = target_label
with c2:
    st.markdown("<div style='height:28px'></div>", unsafe_allow_html=True)
    start = st.button("🚀 Prozess starten", type="primary", disabled=running, use_container_width=True)
with c3:
    st.markdown("<div style='height:28px'></div>", unsafe_allow_html=True)
    reset = st.button("↩︎ Zurücksetzen", disabled=not running, use_container_width=True)

if reset:
    st.session_state["token"] = None
    st.rerun()

# ---- Start: autonome Kette mit simulierter KI-Bearbeitungszeit ----
if start:
    target = st.session_state["target"]
    primary = claim_ids_for_target(target)[0]
    parent = PARENT_KB.get(primary, ("(unbekannt)", "", ""))[0]
    new_token = {
        "vorgang_id": "VG-" + datetime.now().strftime("%Y%m%d-%H%M%S"),
        "erstellt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "beispiel": target,
        "parent": parent,
        "claim_ids": claim_ids_for_target(target),
        "status": "STARTED",
        "stage_idx": -1,
    }
    log_audit(new_token, "Start", "Start", "Vorgang angelegt", f"Beispiel = {target}")

    steps = [
        (0, agent_ingestion, "Ich sammle alle Lieferanten und ihre Rechnungen aus dem System …",
         lambda t: f"{t['ingestion']['lieferanten_gesamt']} Lieferanten geladen."),
        (1, agent_resolution, "Ich prüfe, welche Einträge in Wirklichkeit dieselbe Firma sind …",
         lambda t: f"{t['resolution']['anzahl_eintraege']} Einträge gehören zu „{t['resolution']['firma']}“."),
        (2, agent_contract, "Ich suche die passende Regel im Vertrag …",
         lambda t: f"Regel gefunden: ab {fmt_mio(THRESHOLD)} gibt es {int(RATE*100)} % Rückvergütung."),
        (3, agent_finance, "Ich addiere alle Einkäufe und vergleiche mit der Vertragsgrenze …",
         lambda t: (f"Echte Summe {fmt_curr(t['finance']['echte_gesamtsumme'])} → "
                    f"{'Anspruch auf ' + fmt_curr(t['finance']['rueckverguetung']) if t['finance']['anspruch'] else 'kein Anspruch'}.")),
    ]

    with st.status("🤖 Die KI-Agenten arbeiten … (simulierte Bearbeitungszeit)", expanded=True) as status_box:
        for idx, fn, working_msg, result_fn in steps:
            ph_pipe.markdown(pipeline_html(done_until=idx - 1, active_idx=idx), unsafe_allow_html=True)
            st.write(f"**{PIPELINE[idx][1]}** — {working_msg}")
            time.sleep(SIM_DELAY)
            new_token = fn(new_token)
            st.write(f"✓ {result_fn(new_token)}")
            time.sleep(SIM_DELAY * 0.4)
        ph_pipe.markdown(pipeline_html(done_until=3, awaiting=True), unsafe_allow_html=True)
        status_box.update(label="✅ Vorbereitung fertig – jetzt entscheidet der Mensch", state="complete")

    st.session_state["token"] = new_token
    time.sleep(0.3)
    st.rerun()

# ---- Normale Fortschrittsleiste (kein laufender Start) ----
token = st.session_state["token"]
ph_pipe.markdown(render_pipeline(token), unsafe_allow_html=True)

# ---- Token-State (wächst pro Stufe) ----
with st.expander("🧾 Der „Vorgang“ – wächst mit jedem Schritt (für Technik-Interessierte)", expanded=False):
    if token:
        st.caption(f"Vorgang {token['vorgang_id']} · Status {token['status']}")
        st.code(json.dumps(token, indent=2, ensure_ascii=False, default=str), language="json")
    else:
        st.info("Noch kein Vorgang. Beispiel wählen und **Prozess starten**.")


# ==============================================================================
# 8. PROGRESSIVE STUFEN-DARSTELLUNG (Single-Screen-Narrativ)
# ==============================================================================
if token:
    ing = token["ingestion"]
    res = token["resolution"]
    con = token["contract"]
    fin = token["finance"]

    # ---- Schritt 1: Daten holen ----
    with st.expander("📥 Schritt 1 · Daten holen", expanded=False):
        st.markdown('<span class="tag tag-stub">SIMULIERT</span>', unsafe_allow_html=True)
        explain(
            "Die Infos zu allen Lieferanten und Rechnungen liegen in einem riesigen Firmen-System. "
            "Von Hand schaut da niemand durch – es sind viel zu viele.",
            "Der erste Agent holt automatisch alle Lieferanten samt ihren Rechnungen ins Programm.")
        a, b, c = st.columns(3)
        a.metric("Lieferanten gesamt", ing["lieferanten_gesamt"])
        b.metric("Rechnungen gesamt", ing["rechnungen_gesamt"])
        c.metric("Davon zum Beispiel gehörig", len(ing["fokus_eintraege"]))
        dff = df_lfa1[df_lfa1["LIFNR"].isin(ing["fokus_eintraege"])]
        st.dataframe(dff.style.format({"SPEND_YTD": "{:,.2f} €"}), use_container_width=True, hide_index=True)

    # ---- Schritt 2: Firmen erkennen (Kern) ----
    with st.expander("🧩 Schritt 2 · Firmen erkennen — der wichtigste Schritt", expanded=True):
        st.markdown('<span class="tag tag-live">LIVE</span>', unsafe_allow_html=True)
        explain(
            "Ein Lieferant taucht im System oft mehrfach auf: anderer Name, anderes Land, andere Nummer. "
            "Dass es dieselbe Firma ist, sieht man nicht auf den ersten Blick.",
            "Dieser Agent erkennt, welche Einträge wirklich zur selben Firma gehören. Er rät dabei "
            "<b>nicht</b> anhand ähnlicher Namen (das wäre riskant), sondern stützt sich auf ein geprüftes, "
            "offizielles Firmen-Register. So werden hier mehrere Einträge zu <b>einer</b> Firma.")
        st.markdown(f"**Erkannte Firma:** {res['firma']} · Register-Kennung `{res['register_id']}`")
        st.caption(f"Hier gehören {res['anzahl_eintraege']} Eintrag/Einträge zu dieser einen Firma:")
        st.dataframe(pd.DataFrame(res["evidenz"]), use_container_width=True, hide_index=True)

        g = res["guete"]
        st.markdown("**Wie gut arbeitet die KI? (gemessen, damit man ihr vertrauen kann)**")
        q1, q2, q3 = st.columns(3)
        q1.metric("Genauigkeit", f"{g['genauigkeit_pct']:.0f} %", help="Keine falschen Zusammenlegungen (Fachbegriff: Precision).")
        q2.metric("Vollständigkeit", f"{g['vollstaendigkeit_pct']:.0f} %", help="Nichts übersehen (Fachbegriff: Recall).")
        q3.metric("Falsch zusammengelegt", g["falsch_zusammengelegt"])

        v = res["vorsicht_beispiel"]
        st.markdown(
            f'<div class="frosted-glass" style="border-color:#FFD60A !important; background:rgba(255,214,10,0.05) !important;">'
            f'<b>🟡 Vorsicht-Beispiel (bewusst NICHT zusammengelegt):</b><br>{v["paar"]}<br>'
            f'Die Namen sind sich zu <b>{v["namensaehnlichkeit_pct"]:.0f} %</b> ähnlich – trotzdem '
            f'{v["entscheidung"]}. Ähnliche Namen allein reichen eben nicht.'
            f'</div>', unsafe_allow_html=True)
        st.caption(
            f"Live berechnet, zur Veranschaulichung: Die beiden Apex-Namen sind sich zu {APEX_SIM*100:.0f} % ähnlich "
            f"(ein reiner Namensvergleich würde sie fälschlich zusammenwerfen). Cisco und das zugekaufte „Meraki“ "
            f"sind sich vom Namen her nur zu {CISCO_MERAKI_SIM*100:.0f} % ähnlich – ein reiner Namensvergleich würde "
            f"diese echte Zusammengehörigkeit also übersehen. Nur das geprüfte Register findet sie zuverlässig.")

    # ---- Schritt 3: Vertrag lesen ----
    with st.expander("📄 Schritt 3 · Vertrag lesen", expanded=False):
        st.markdown('<span class="tag tag-stub">SIMULIERT</span>', unsafe_allow_html=True)
        explain(
            "Ab wann es eine Rückvergütung gibt, steht im Vertrag – meist in langen Dokumenten.",
            "Dieser Agent zieht die entscheidende Regel heraus.")
        st.markdown(f"> {con['regel']}")

    # ---- Schritt 4: Summe prüfen (€-Mehrwert) ----
    with st.expander("🧮 Schritt 4 · Summe prüfen", expanded=True):
        st.markdown('<span class="tag tag-live">LIVE</span>', unsafe_allow_html=True)
        explain(
            "Jetzt zählt: Wie viel hat der Konzern bei dieser einen Firma insgesamt ausgegeben – "
            "und reicht das für die Rückvergütung?",
            "Der Agent addiert die Einkäufe aller zusammengehörenden Einträge und vergleicht mit der Vertragsgrenze.")
        k1, k2, k3, k4 = st.columns(4)
        k1.metric("Größter Einzel-Eintrag", fmt_curr(fin["groesster_einzeleintrag"]),
                  help="So viel sah das alte System – pro Eintrag einzeln.")
        k2.metric("Echte Gesamtsumme", fmt_curr(fin["echte_gesamtsumme"]),
                  f"+{fmt_curr(fin['zusatz_durch_ki'])} durch die KI")
        k3.metric("Vertragsgrenze", fmt_mio(fin["grenze"]),
                  "überschritten" if fin["anspruch"] else "nicht erreicht",
                  delta_color="normal" if fin["anspruch"] else "off")
        k4.metric("Rückvergütung (2 %)", fmt_curr(fin["rueckverguetung"]))

        bar_color = "#30D158" if fin["anspruch"] else "#FF453A"
        fig = go.Figure()
        fig.add_trace(go.Bar(name="Größter Einzel-Eintrag (altes System)", x=[token["parent"]],
                             y=[fin["groesster_einzeleintrag"]], marker_color="#3A3A3C",
                             text=[fmt_curr(fin["groesster_einzeleintrag"])], textposition="auto"))
        fig.add_trace(go.Bar(name="Echte Gesamtsumme (mit KI)", x=[token["parent"]],
                             y=[fin["echte_gesamtsumme"]], marker_color=bar_color,
                             text=[fmt_curr(fin["echte_gesamtsumme"])], textposition="outside"))
        fig.add_hline(y=THRESHOLD, line_dash="dash", line_color="#007AFF",
                      annotation_text="Vertragsgrenze (50 Mio. €)",
                      annotation_position="top left", annotation_font_color="#007AFF")
        fig.update_layout(barmode="group", plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
                          font=dict(color="#F5F5F7"), margin=dict(l=10, r=10, t=30, b=10), height=380,
                          legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1,
                                      font=dict(size=11)),  # kleinere Legende für schmale Screens
                          yaxis=dict(title="Einkauf pro Jahr in €", gridcolor="#1C1C1E",
                                     range=[0, max(fin["echte_gesamtsumme"] * 1.25, 55_000_000.0)]))
        st.plotly_chart(fig, use_container_width=True)

    # ==========================================================================
    # 9. HUMAN-IN-THE-LOOP — die EINZIGE menschliche Stufe
    # ==========================================================================
    st.markdown("---")

    if token["status"] == "AWAITING_APPROVAL":
        col = "#30D158" if fin["anspruch"] else "#FF453A"
        verdict = (f"<b style='color:#30D158;'>Anspruch:</b> Die echte Summe "
                   f"{fmt_curr(fin['echte_gesamtsumme'])} ist größer als die Grenze. "
                   f"Vorschlag: <b>{fmt_curr(fin['rueckverguetung'])}</b> Rückvergütung buchen."
                   if fin["anspruch"] else
                   f"<b style='color:#FF453A;'>Kein Anspruch:</b> Die echte Summe "
                   f"{fmt_curr(fin['echte_gesamtsumme'])} ist kleiner als die Grenze "
                   f"({fmt_mio(THRESHOLD)}). Es gibt keine Rückvergütung zu buchen.")
        st.markdown(
            f'<div class="frosted-glass" style="border-color:{col} !important;">'
            f'<h3 style="margin-top:0;">🧑\u200d⚖️ Schritt 5 · Jetzt entscheidet der Mensch</h3>'
            f'<div class="explain" style="margin-bottom:10px;">'
            f'<b>Worum geht\u2019s?</b> Geld zu buchen ist eine Entscheidung mit Verantwortung – '
            f'die trifft keine Maschine allein.<br>'
            f'<b>Was passiert hier?</b> Genau an dieser einen Stelle schaut ein Mensch drauf und gibt frei '
            f'oder lehnt ab. Mit kurzer Begründung, damit später jeder nachvollziehen kann, warum so '
            f'entschieden wurde. Vorher und nachher arbeitet die KI allein.</div>'
            f'<div style="background:rgba(0,0,0,0.3); padding:12px; border-radius:8px; font-size:14px;">{verdict}</div>'
            f'</div>', unsafe_allow_html=True)

        reason = st.selectbox("Pflichtfeld – Grund für die Entscheidung", REASON_CODES, index=0)
        comment = st.text_input("Kommentar (freiwillig)", value="")
        approver = st.text_input("Wer entscheidet?", value="P. Procurement (Einkauf)")

        ha, hr, _ = st.columns([1, 1, 2])
        approve = ha.button("✅ Freigeben", type="primary", use_container_width=True)
        rejectb = hr.button("⛔ Ablehnen", use_container_width=True)

        if approve or rejectb:
            if reason == REASON_CODES[0]:
                st.warning("Bitte zuerst einen Grund auswählen.")
            else:
                decision = "FREIGEGEBEN" if approve else "ABGELEHNT"
                token["hitl"] = {
                    "modus": "LIVE",
                    "entscheidung": decision,
                    "grund": reason,
                    "kommentar": comment,
                    "entscheider": approver,
                    "zeitpunkt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                }
                log_audit(token, f"Mensch · {approver}", "Mensch entscheidet",
                          f"Entscheidung: {decision}", reason + (f" — {comment}" if comment else ""))
                if approve:
                    token["status"] = "APPROVED"
                    ph_pipe.markdown(pipeline_html(done_until=4, active_idx=5), unsafe_allow_html=True)
                    with st.status("🤖 Buchung wird vorbereitet … (simuliert)", expanded=True) as sb:
                        st.write("**Buchen & E-Mail** — Ich lege den Beleg an und schreibe den E-Mail-Entwurf …")
                        time.sleep(SIM_DELAY)
                        token = agent_booking(token)
                        st.write(f"✓ Beleg #{token['booking']['beleg_id']} angelegt, Entwurf bereit.")
                        sb.update(label="✅ Fertig", state="complete")
                    time.sleep(0.3)
                else:
                    token["status"] = "REJECTED"
                    token["stage_idx"] = 4
                st.session_state["token"] = token
                st.rerun()

    elif token["status"] == "REJECTED":
        h = token["hitl"]
        st.markdown(
            f'<div class="frosted-glass" style="border-color:#FF453A !important; background:rgba(255,69,58,0.05) !important;">'
            f'<h3 style="margin-top:0;">⛔ Vorgang abgelehnt</h3>'
            f'<p>{h["grund"]}{(" — " + h["kommentar"]) if h["kommentar"] else ""}<br>'
            f'Entschieden von: {h["entscheider"]} · {h["zeitpunkt"]}</p>'
            f'<p style="color:#8E8E93;">Der Buchungs-Agent wurde nicht gestartet. Keine Buchung, keine E-Mail.</p>'
            f'</div>', unsafe_allow_html=True)

    # ==========================================================================
    # 10. SCHRITT 6: BUCHEN & E-MAIL (nur nach Freigabe)
    # ==========================================================================
    if token["status"] == "BOOKED":
        bk = token["booking"]
        st.markdown("---")
        st.markdown("### ✅ Schritt 6 · Buchen & E-Mail")
        st.markdown('<span class="tag tag-stub">SIMULIERT</span>', unsafe_allow_html=True)
        explain(
            "Nach dem „Ja“ muss das Geld verbucht und die Chefetage informiert werden.",
            "Der letzte Agent legt den Buchungsbeleg an und schreibt eine fertige E-Mail an den Finanzchef – "
            "die aber <b>nur als Entwurf</b> bereitliegt und nicht von selbst verschickt wird.")
        st.success(f"Beleg **#{bk['beleg_id']}** angelegt — {bk['buchungstext']}")
        st.markdown(
            f'<div class="apple-mail-box">'
            f'<div class="mail-row"><b>VON:</b> <span class="val">KI-Assistent@globalcorp.com</span></div>'
            f'<div class="mail-row"><b>AN:</b> <span class="val">{bk["mail_draft"]["an"]}</span></div>'
            f'<div class="mail-row" style="color:#007AFF;"><b>BETREFF: {bk["mail_draft"]["betreff"]}</b></div>'
            f'<div class="mail-row"><span class="tag tag-stub">{bk["mail_draft"]["status"]}</span></div>'
            f'<div class="mail-divider"></div>'
            f'<div style="font-size:13px; line-height:1.6; color:#D1D1D6;">'
            f'Sehr geehrter Herr {CFO_NAME.split("(")[0].strip()},<br><br>'
            f'unser KI-Assistent hat den Vorgang <b>{token["vorgang_id"]}</b> für <b>„{token["parent"]}“</b> '
            f'abgeschlossen. Diese im System getrennt geführten Einträge gehören zur selben Firma:<br><br>'
            f'{bk["mail_draft"]["vendor_lines"]}<br>'
            f'<b>Echte Gesamtsumme: {fmt_curr(fin["echte_gesamtsumme"])}</b> '
            f'(größter Einzel-Eintrag: nur {fmt_curr(fin["groesster_einzeleintrag"])}).<br>'
            f'Freigegeben von {token["hitl"]["entscheider"]} ({token["hitl"]["grund"]}).<br><br>'
            f'Mit besten Grüßen,<br><b>PROC Rebate Hunter</b>'
            f'</div></div>', unsafe_allow_html=True)
        st.caption("Der Entwurf wird nicht automatisch verschickt.")


# ==============================================================================
# 11. PROTOKOLL (append-only) + CSV-EXPORT
# ==============================================================================
st.markdown("---")
with st.expander(f"📋 Protokoll aller Schritte (revisionssicher · {len(st.session_state['audit_log'])} Einträge)", expanded=False):
    if st.session_state["audit_log"]:
        df_audit = pd.DataFrame(st.session_state["audit_log"])
        st.dataframe(df_audit, use_container_width=True, hide_index=True)
        st.download_button(
            "⬇︎ Protokoll als CSV speichern",
            data=df_audit.to_csv(index=False).encode("utf-8-sig"),
            file_name=f"protokoll_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv",
        )
    else:
        st.info("Noch keine Einträge. Sie entstehen automatisch, sobald ein Vorgang läuft.")
