"""
================================================================================
ENTERPRISE SPEND INTELLIGENCE — "THE ULTIMATE PARENT KICKBACK HUNTER"
C-Level / Boardroom Demonstration Prototyp (Apple Cupertino Dark Theme)
================================================================================
"""

import time
import datetime
import numpy as np
import pandas as pd
import streamlit as st

# ==============================================================================
# 1. PAGE CONFIG & APPLE CUPERTINO CSS ENGINE
# ==============================================================================
st.set_page_config(
    page_title="Spend Intelligence | Kickback Hunter",
    page_icon="",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
    <style>
        /* 1. Global Canvas - Deep Apple Space Black */
        .stApp {
            background-color: #0A0A0C !important;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #F5F5F7;
        }

        /* 2. Reparatur der Sidebar (Das grelle Weiß eliminieren) */
        [data-testid="stSidebar"] {
            background-color: #141415 !important;
            border-right: 1px solid #222225 !important;
        }
        [data-testid="stSidebar"] * {
            color: #E8E8ED !important;
        }
        
        /* 3. Typografie & Headings im Apple-Style */
        h1, h2, h3, h4 {
            color: #FFFFFF !important;
            font-weight: 700 !important;
            letter-spacing: -0.025em !important;
        }
        
        /* 4. Apple Pill-Button (Primary Hero Action) */
        div.stButton > button[kind="primary"] {
            background: linear-gradient(180deg, #2E9AFF 0%, #0A84FF 100%) !important;
            color: #FFFFFF !important;
            border: 1px solid #409CFF !important;
            border-radius: 999px !important; /* Maximale Rundung */
            font-size: 15px !important;
            font-weight: 600 !important;
            padding: 12px 24px !important;
            box-shadow: 0 4px 24px rgba(10, 132, 255, 0.35) !important;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        div.stButton > button[kind="primary"]:hover {
            transform: scale(1.02);
            box-shadow: 0 8px 32px rgba(10, 132, 255, 0.55) !important;
        }

        /* 5. Frosted Glass Cards (Apple Surface Look) */
        .apple-card {
            background: rgba(24, 24, 27, 0.65);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 20px;
            padding: 24px;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
        }

        /* 6. Apple Wallet Style Metric Card */
        .wallet-card {
            background: linear-gradient(135deg, #1D1D20 0%, #151518 100%);
            border: 1px solid #2C2C30;
            border-left: 5px solid #0A84FF;
            border-radius: 18px;
            padding: 22px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .wallet-label { color: #8E8E93; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin:0; }
        .wallet-val { color: #FFFFFF; font-size: 38px; font-weight: 800; letter-spacing: -0.03em; margin: 4px 0; }
        .wallet-sub { color: #30D158; font-size: 13px; font-weight: 500; margin:0; }

        /* 7. macOS Terminal Window */
        .mac-window {
            background-color: #121214;
            border: 1px solid #262629;
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8);
        }
        .mac-header {
            background-color: #1E1E21;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            border-bottom: 1px solid #262629;
        }
        .mac-dot { height: 12px; width: 12px; border-radius: 50%; display: inline-block; margin-right: 8px; }
        .mac-title { color: #8E8E93; font-size: 12px; font-weight: 500; font-family: -apple-system, sans-serif; margin: 0 auto; }
        .mac-body {
            padding: 20px;
            font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
            font-size: 13px;
            line-height: 1.7;
            color: #E8E8ED;
            height: 380px;
            overflow-y: auto;
        }
        
        /* 8. Segmented Control Tabs */
        button[data-baseweb="tab"] {
            background-color: transparent !important;
            color: #8E8E93 !important;
            font-weight: 600 !important;
            border-radius: 8px !important;
            padding: 10px 18px !important;
        }
        button[data-baseweb="tab"][aria-selected="true"] {
            background-color: #242427 !important;
            color: #FFFFFF !important;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3) !important;
        }
        
        /* Dataframes abdunkeln */
        [data-testid="stDataFrame"] { background-color: #141416 !important; border-radius: 12px; border: 1px solid #222225; }
    </style>
""", unsafe_allow_html=True)


# ==============================================================================
# 2. IN-MEMORY SAP DATABASE (MOCK)
# ==============================================================================
@st.cache_data
def generate_enterprise_base():
    # LFA1 (Lieferantenstamm)
    lfa1_records = [
        {"LIFNR": "10001", "NAME1": "Cisco Systems GmbH", "ORT01": "Bonn", "LAND1": "DE", "STCD1": "DE123456789"},
        {"LIFNR": "10002", "NAME1": "CISCO SYSTEMS INC", "ORT01": "San Jose", "LAND1": "US", "STCD1": "US987654321"},
        {"LIFNR": "10003", "NAME1": "Cisco Meraki UK Ltd", "ORT01": "London", "LAND1": "GB", "STCD1": "GB555666777"},
        {"LIFNR": "10004", "NAME1": "Acacia Communications Ireland", "ORT01": "Cork", "LAND1": "IE", "STCD1": "IE112233445"},
        {"LIFNR": "10005", "NAME1": "Splunk Services Germany", "ORT01": "München", "LAND1": "DE", "STCD1": "DE998877665"},
        {"LIFNR": "10006", "NAME1": "Microsoft Global Inc.", "ORT01": "Redmond", "LAND1": "US", "STCD1": "US811111111"},
        {"LIFNR": "10007", "NAME1": "Amazon Web Services EMEA", "ORT01": "Luxemburg", "LAND1": "LU", "STCD1": "LU822222222"},
        {"LIFNR": "10008", "NAME1": "Salesforce.com Germany", "ORT01": "München", "LAND1": "DE", "STCD1": "DE833333333"},
        {"LIFNR": "10009", "NAME1": "SAP SE", "ORT01": "Walldorf", "LAND1": "DE", "STCD1": "DE844444444"},
        {"LIFNR": "10010", "NAME1": "Oracle Corporation", "ORT01": "Austin", "LAND1": "US", "STCD1": "US855555555"},
    ]
    for idx in range(10011, 10041):
        lfa1_records.append({"LIFNR": str(idx), "NAME1": f"Global Vendor Partner #{idx-10010}", "ORT01": "Frankfurt", "LAND1": "DE", "STCD1": f"DE{idx}99"})
    lfa1_df = pd.DataFrame(lfa1_records)

    # EKKO (Spend YTD) - Summe Cisco exakt 52.400.000 €
    ekko_records = [
        {"EBELN": "4500010001", "BUKRS": "1000", "LIFNR": "10001", "NETWR": 14000000.00},
        {"EBELN": "4500010002", "BUKRS": "1020", "LIFNR": "10001", "NETWR": 8000000.00},  # Summe Bonn: 22M
        {"EBELN": "4500010003", "BUKRS": "1000", "LIFNR": "10002", "NETWR": 4000000.00},  # San Jose: 4M
        {"EBELN": "4500010004", "BUKRS": "1040", "LIFNR": "10003", "NETWR": 10000000.00}, # Meraki: 10M
        {"EBELN": "4500010005", "BUKRS": "1020", "LIFNR": "10004", "NETWR": 9000000.00},  # Acacia: 9M
        {"EBELN": "4500010006", "BUKRS": "1000", "LIFNR": "10005", "NETWR": 7400000.00},  # Splunk: 7.4M
        {"EBELN": "4500010007", "BUKRS": "1000", "LIFNR": "10006", "NETWR": 26500000.00}, # Microsoft (~26.5M)
        {"EBELN": "4500010008", "BUKRS": "1000", "LIFNR": "10007", "NETWR": 24800000.00}, # AWS (~24.8M)
        {"EBELN": "4500010009", "BUKRS": "1020", "LIFNR": "10008", "NETWR": 23100000.00}, # Salesforce (~23.1M)
    ]
    np.random.seed(42)
    other_vendors = [v for v in lfa1_df['LIFNR'].tolist() if v not in ["10001", "10002", "10003", "10004", "10005", "10006", "10007", "10008"]]
    for po_id in range(10, 251):
        ekko_records.append({
            "EBELN": f"45000{po_id:05d}",
            "BUKRS": np.random.choice(["1000", "1020", "1040"], p=[0.7, 0.2, 0.1]),
            "LIFNR": np.random.choice(other_vendors),
            "NETWR": round(np.random.uniform(12000, 310000), 2)
        })
    ekko_df = pd.DataFrame(ekko_records)
    return lfa1_df, ekko_df

LFA1, EKKO = generate_enterprise_base()

if "scan_executed" not in st.session_state: st.session_state.scan_executed = False
if "booking_success" not in st.session_state: st.session_state.booking_success = False


# ==============================================================================
# 3. SIDEBAR (CUPERTINO NAVIGATION)
# ==============================================================================
with st.sidebar:
    st.markdown("<h3 style='margin-bottom:0;'> Spend Intelligence</h3>", unsafe_allow_html=True)
    st.caption("Autonomous Procurement Core v4.2")
    st.divider()
    
    st.radio("Neural Compute Engine:", ["Local Sandbox (Simulation)", "OpenAI GPT-4o Direct"], index=0)
    
    st.divider()
    st.markdown("<p style='font-size:13px; color:#8E8E93; margin-bottom:4px;'>AKTIVES AUDIT-PATTERN</p>", unsafe_allow_html=True)
    st.markdown("<div style='background:#1D1D20; padding:12px; border-radius:10px; border:1px solid #2C2C30; font-size:13px;'><strong>Multi-Hop M&A Resolution</strong><br><span style='color:#8E8E93;'>Target: Vendor Fragmentation YTD</span></div>", unsafe_allow_html=True)
    
    st.markdown("<br>", unsafe_allow_html=True)
    if st.button("⚡ Agentic Spend Scan starten", type="primary", use_container_width=True):
        st.session_state.scan_executed = True
        st.session_state.booking_success = False
        st.balloons()
        
    st.divider()
    st.caption("Status: Connected to SAP ECC (Production) via Secure RFC")


# ==============================================================================
# 4. MAIN STAGE
# ==============================================================================
st.markdown("<h1 style='margin-bottom:0;'>Agentic AI im Spend Management</h1>", unsafe_allow_html=True)
st.markdown("<p style='color:#8E8E93; font-size:18px; margin-top:4px;'>Automatisierte Identifikation fragmentierter Rahmenvertrags-Rückvergütungen</p>", unsafe_allow_html=True)
st.markdown("<br>", unsafe_allow_html=True)

tab1, tab2, tab3, tab4 = st.tabs([
    "📊 1. SAP Status Quo (Silo-Sicht)", 
    "🧠 2. Agentic Reasoning Console", 
    "💰 3. Financial Impact & Action", 
    "🛡️ 4. Revisions- & Compliance-Log"
])

# ------------------------------------------------------------------------------
# TAB 1: SILO VIEW
# ------------------------------------------------------------------------------
with tab1:
    spend_per_vendor = EKKO.groupby("LIFNR")['NETWR'].sum().reset_index()
    merged_silo = pd.merge(spend_per_vendor, LFA1, on="LIFNR")
    top_10 = merged_silo.sort_values(by="NETWR", ascending=False).head(10)
    
    col_chart, col_callout = st.columns([2.2, 1])
    with col_chart:
        chart_data = top_10.set_index("NAME1")["NETWR"]
        st.bar_chart(chart_data, color="#2E9AFF")
        
    with col_callout:
        st.markdown("""
        <div class="apple-card" style="border-left: 4px solid #FF9F0A;">
            <h4 style="color: #FF9F0A; margin-top:0;">⚠️ ERP-Systemhinweis (Standard SQL)</h4>
            <p style="color: #E8E8ED; font-size:14px; line-height:1.5;">
               Kein Einzellieferant erreicht die vertragliche Schwellenwert-Marke von <strong>50.000.000 €</strong>.<br><br>
               • Cisco Systems GmbH (Bonn): 22,0 Mio. €<br>
               • Rückvergütung YTD: <strong style="color:#FF9F0A;">0,00 €</strong>
            </p>
            <span style="color:#8E8E93; font-size:11px;">Die klassische Kreditorenkonten-Logik wertet Entitäten strikt getrennt nach LIFNR aus.</span>
        </div>
        """, unsafe_allow_html=True)

    st.divider()
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("#### Auszug `LFA1` (Lieferantenstamm)")
        st.dataframe(LFA1.head(8), use_container_width=True)
    with c2:
        st.markdown("#### Auszug `EKKO` (Bestellbelege YTD)")
        st.dataframe(EKKO.head(8), use_container_width=True)

# ------------------------------------------------------------------------------
# TAB 2: REASONING KERNEL (macOS Style)
# ------------------------------------------------------------------------------
with tab2:
    if not st.session_state.scan_executed:
        st.info("👈 Der Autonomous Core ist im Standby. Klicke auf 'Agentic Spend Scan starten' in der Sidebar.")
    else:
        # Live Typing Simulation im Mac-Fenster
        st.markdown("""
        <div class="mac-window">
            <div class="mac-header">
                <span class="mac-dot" style="background-color: #FF5F56;"></span>
                <span class="mac-dot" style="background-color: #FFBD2E;"></span>
                <span class="mac-dot" style="background-color: #27C93F;"></span>
                <span class="mac-title">Agentic Execution Core — zsh — 80x24</span>
            </div>
            <div class="mac-body" id="mac-text">
                <span style="color:#8E8E93;">[10:00:01]</span> <span style="color:#2E9AFF;">[INGESTION]</span> Lese SAP-Tabellen LFA1 (40 Kreditoren) und EKKO (250 Bestellungen)...<br>
                <span style="color:#8E8E93;">[10:00:02]</span> <span style="color:#2E9AFF;">[FUZZY MATCH]</span> Prüfe Steuernummern & Vektoren auf Entitäts-Dubletten...<br>
                &nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#30D158;">↳ Verknüpft: LIFNR 10001 ('Cisco Systems GmbH') ⟷ LIFNR 10002 ('CISCO SYSTEMS INC')</span><br>
                &nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#30D158;">↳ Verknüpft: LIFNR 10003 ('Cisco Meraki UK Ltd') via String-Distanz (0.88)</span><br>
                <span style="color:#8E8E93;">[10:00:03]</span> <span style="color:#BF5AF2;">[KNOWLEDGE GRAPH]</span> Initiiere Multi-Hop Abfrage (SEC Filings & Global M&A)...<br>
                &nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#FF9F0A;">⚠️ GRAPH HIT: 'Acacia Communications' (LIFNR 10004) wurde 03/2021 von Cisco akquiriert.</span><br>
                &nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#FF9F0A;">⚠️ GRAPH HIT: 'Splunk Services' (LIFNR 10005) wurde 03/2024 von Cisco akquiriert.</span><br>
                <span style="color:#8E8E93;">[10:00:04]</span> <span style="color:#30D158;">[ENTITY RESOLUTION]</span> Verklammerung der IDs [10001, 10002, 10003, 10004, 10005] zu 'Cisco Global'<br>
                <span style="color:#8E8E93;">[10:00:05]</span> <span style="color:#2E9AFF;">[VECTOR RAG]</span> Scanne Vertragsdatenbank Z_CONTRACTS nach Rahmenverträgen...<br>
                &nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#30D158;">↳ Treffer: Vertrag 'CTR-2024-CISC' (Klausel 8.2: 2.0% Kickback ab 50,0 Mio. € Konzernumsatz)</span><br>
                <span style="color:#8E8E93;">[10:00:06]</span> <span style="color:#BF5AF2;">[SYMPY MATH ENGINE]</span> Führe deterministische Überprüfung durch:<br>
                &nbsp;&nbsp;&nbsp;&nbsp;• Summe IST-Spend: (22.0M + 4.0M + 10.0M + 9.0M + 7.4M) = <strong style="color:#FFF;">52.400.000,00 €</strong><br>
                &nbsp;&nbsp;&nbsp;&nbsp;• Prüfe Schwellenwert: 52.400.000 € > 50.000.000 € ⟶ <strong style="color:#30D158;">TRUE</strong><br>
                &nbsp;&nbsp;&nbsp;&nbsp;• Berechne Anspruch: 52.400.000 € * 0.02 = <strong style="color:#0A84FF;">1.048.000,00 €</strong><br>
                <span style="color:#8E8E93;">[10:00:07]</span> <span style="color:#30D158;">[ACTION BAPI]</span> Kickback-Anspruch verifiziert. Generiere Anschreiben & SAP BAPI-Payload...
            </div>
        </div>
        """, unsafe_allow_html=True)
        st.caption("Orchestrated via LangGraph State Machine • Math Sandbox: SymPy • ERP Connector: pyrfc")

# ------------------------------------------------------------------------------
# TAB 3: FINANCIAL IMPACT
# ------------------------------------------------------------------------------
with tab3:
    if not st.session_state.scan_executed:
        st.info("Bitte Scan ausführen, um die monetären Ansprüche zu berechnen.")
    else:
        m1, m2, m3 = st.columns(3)
        with m1:
            st.markdown("""
                <div class="apple-card" style="padding:22px;">
                    <p class="wallet-label">Konsolidierter Gruppen-Spend</p>
                    <p class="wallet-val" style="font-size:32px;">52,40 Mio. €</p>
                    <p class="wallet-sub" style="color:#2E9AFF;">+30,40 Mio. € durch KI aufgedeckt</p>
                </div>
            """, unsafe_allow_html=True)
        with m2:
            st.markdown("""
                <div class="apple-card" style="padding:22px;">
                    <p class="wallet-label">Vertragliche Kickback-Schwelle</p>
                    <p class="wallet-val" style="font-size:32px;">50,00 Mio. €</p>
                    <p class="wallet-sub" style="color:#8E8E93;">Klausel 8.2 (CTR-2024-CISC)</p>
                </div>
            """, unsafe_allow_html=True)
        with m3:
            st.markdown("""
                <div class="wallet-card">
                    <p class="wallet-label" style="color:#2E9AFF;">Generierter Cash-Anspruch</p>
                    <p class="wallet-val">1.048.000 €</p>
                    <p class="wallet-sub">✓ Sofort fällig gem. § 15 AktG</p>
                </div>
            """, unsafe_allow_html=True)

        st.divider()
        st.markdown("### Automatisiert erstelltes CFO-Anschreiben")
        
        letter = """
        **GLOBAL CORP SE** — Group Procurement & Vendor Management  

        **An:** Cisco Systems GmbH / Konzernführung  
        **Datum:** 22. Juni 2026  
        **Betreff: Geltendmachung der Konzern-Rückvergütung YTD gem. Rahmenvertrag CTR-2024-CISC**

        Sehr geehrte Damen und Herren,

        im Zuge unseres KI-gestützten Spend-Audits der Global Corp Gruppe (inkl. verbundener Unternehmen gem. § 15 AktG) haben wir die kumulierten Einkaufsumsätze mit dem Cisco-Konzern auditiert.

        Gemäß **Klausel 8.2** unseres Rahmenvertrags *CTR-2024-CISC* gewährt Cisco eine gruppenweite Rückvergütung von **2,0 %** auf den Jahresumsatz, sobald das kumulierte Volumen 50,00 Mio. EUR übersteigt. Unsere forensische Entitätskonsolidierung weist YTD folgendes anrechenbares Netto-Volumen aus:

        1. Kreditor 10001 (Cisco Systems GmbH, Bonn) — BUKRS 1000/1020: 22.000.000,00 €
        2. Kreditor 10002 (CISCO SYSTEMS INC, San Jose) — BUKRS 1000: 4.000.000,00 €
        3. Kreditor 10003 (Cisco Meraki UK Ltd, London) — BUKRS 1040: 10.000.000,00 €
        4. Kreditor 10004 (Acacia Communications Ireland) — BUKRS 1020: 9.000.000,00 € [M&A Nachweis: SEC Filing Form 8-K]
        5. Kreditor 10005 (Splunk Services Germany) — BUKRS 1000: 7.400.000,00 € [M&A Nachweis: SEC Filing Form 10-Q]

        **Kumulierter Gruppenumsatz YTD: 52.400.000,00 EUR**

        Der vertragliche Schwellenwert wurde überschritten. Hieraus resultiert ein fälliger Zahlungsanspruch in Höhe von:

        ### 1.048.000,00 EUR

        Wir bitten um Überweisung bis zum 15. Juli 2026. Eine debitorische Belastungsanzeige (SAP Beleg-Nr. 4900081294) wurde in unserem FI-Modul vorerfasst.

        Mit freundlichen Grüßen  
        **Autonomous Spend Core** *(Machine-Verified)*
        """
        st.markdown(f"<div class='apple-card'>{letter}</div>", unsafe_allow_html=True)
        st.markdown("<br>", unsafe_allow_html=True)
        
        if st.button("⚡ SAP FI-NVE (Nachträgliche Vergütung) Beleg buchen", type="primary"):
            st.session_state.booking_success = True
            
        if st.session_state.booking_success:
            st.success("BAPI `BAPI_INCOMINGINVOICE_CREATE` erfolgreich im SAP FI vorerfasst. Belegnummer: 4900081294", icon="✓")

# ------------------------------------------------------------------------------
# TAB 4: COMPLIANCE LOG
# ------------------------------------------------------------------------------
with tab4:
    st.markdown("### Revisionssicheres Explainability-Log (XAI)")
    
    trail = [
        {"Schritt": "1. Fuzzy Match", "Entität": "LIFNR 10001 & 10002", "Begründung": "USt-IdNr. Match & Levenshtein-Distanz (0.89)", "Compliance": "KONFORM"},
        {"Schritt": "2. Graph Merge", "Entität": "Acacia (10004)", "Begründung": "SEC Filing Form 8-K vom 01.03.2021", "Compliance": "KONFORM"},
        {"Schritt": "3. Graph Merge", "Entität": "Splunk (10005)", "Begründung": "SEC Filing Form 10-Q vom 18.03.2024", "Compliance": "KONFORM"},
        {"Schritt": "4. Legal RAG", "Entität": "Klausel 8.2", "Begründung": "Vektorsuche in Z_CONTRACTS (Score: 0.94)", "Compliance": "KONFORM"},
        {"Schritt": "5. Determinismus", "Entität": "Cash-Anspruch", "Begründung": "Berechnung über SymPy Engine (Verhinderung von LLM-Halluzination)", "Compliance": "KONFORM"},
        {"Schritt": "6. KBV Check", "Entität": "Lieferantenschutz", "Begründung": "Es fand keine automatisierte Abwertung von Lieferanten statt.", "Compliance": "KONFORM"}
    ]
    st.table(pd.DataFrame(trail))

st.divider()
st.markdown("<p style='text-align:center; color:#8E8E93; font-size:12px;'>GlobalCorp Enterprise Architecture • Designed in Cupertino Style</p>", unsafe_allow_html=True)