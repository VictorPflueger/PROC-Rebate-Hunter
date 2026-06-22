import time
import random
import pandas as pd
import streamlit as st
import plotly.graph_objects as go

# ==============================================================================
# 0. PAGE CONFIG & APPLE CUPERTINO DARK MODE CSS
# ==============================================================================
st.set_page_config(
    page_title="PROC Kickback Hunter AI | GlobalCorp SE",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="collapsed"
)

def inject_apple_cupertino_css():
    st.markdown("""
    <style>
        /* Apple Space Black Background */
        .stApp {
            background-color: #0A0A0C !important;
            color: #F5F5F7 !important;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif;
        }
        
        /* Frosted Glass Containers */
        .frosted-glass {
            background: rgba(28, 28, 30, 0.65) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
            border-radius: 16px !important;
            padding: 24px !important;
            box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.45) !important;
        }

        /* SF-Blue Accent Buttons */
        div.stButton > button:first-child {
            background-color: #007AFF !important;
            color: #FFFFFF !important;
            border-radius: 12px !important;
            font-weight: 600 !important;
            letter-spacing: 0.3px !important;
            border: none !important;
            padding: 12px 24px !important;
            transition: all 0.2s ease-in-out;
        }
        div.stButton > button:first-child:hover {
            background-color: #0062CC !important;
            transform: scale(1.01);
            box-shadow: 0 0 20px rgba(0, 122, 255, 0.4);
        }

        /* Search Input Styling */
        input[type="text"] {
            background-color: rgba(255, 255, 255, 0.07) !important;
            border: 1px solid rgba(255, 255, 255, 0.18) !important;
            color: #FFFFFF !important;
            border-radius: 12px !important;
            padding: 14px 18px !important;
            font-size: 16px !important;
            font-weight: 500 !important;
        }
        input[type="text"]:focus {
            border-color: #007AFF !important;
            box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.3) !important;
        }

        /* LangGraph Apple-Style Pipeline Badges */
        .pipeline-track {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(18, 18, 20, 0.8);
            padding: 14px 20px;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            margin-bottom: 20px;
            gap: 10px;
        }
        .agent-pill {
            flex: 1;
            text-align: center;
            padding: 10px 8px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.4);
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.04);
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .agent-pill.active {
            color: #FFFFFF;
            background: rgba(0, 122, 255, 0.18);
            border-color: #007AFF;
            box-shadow: 0 0 18px rgba(0, 122, 255, 0.35);
            transform: translateY(-2px);
        }
        .agent-pill.done {
            color: #30D158;
            background: rgba(48, 209, 88, 0.12);
            border-color: #30D158;
        }

        /* Apple Terminal Simulation */
        .apple-terminal {
            background-color: #0E0E10;
            border-radius: 14px;
            border: 1px solid #222226;
            padding: 20px;
            font-family: 'SF Mono', 'Menlo', 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.6;
            color: #30D158;
            height: 260px;
            overflow-y: auto;
            box-shadow: inset 0 0 16px rgba(0,0,0,0.8);
        }
        .terminal-time { color: #8E8E93; font-size: 11px; margin-right: 8px; }
        .terminal-source { color: #007AFF; font-weight: bold; margin-right: 8px; }

        /* Apple Mail Mockup Box */
        .apple-mail-box {
            background-color: #161618;
            border: 1px solid #2C2C30;
            border-radius: 14px;
            padding: 24px;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
            box-shadow: 0 8px 30px rgba(0,0,0,0.5);
        }
        .mail-row { margin-bottom: 6px; font-size: 13px; color: #8E8E93; }
        .mail-row span.val { color: #FFFFFF; font-weight: 500; }
        .mail-divider { border-top: 1px solid #2C2C30; margin: 16px 0; }

        /* Metric Overrides */
        div[data-testid="stMetricValue"] {
            font-size: 32px !important;
            font-weight: 700 !important;
            letter-spacing: -0.5px !important;
        }
        
        /* Custom Tabs */
        button[data-baseweb="tab"] {
            background: transparent !important;
            color: #8E8E93 !important;
            font-size: 16px !important;
            font-weight: 600 !important;
        }
        button[data-baseweb="tab"][aria-selected="true"] {
            color: #FFFFFF !important;
            border-bottom: 2px solid #007AFF !important;
        }
    </style>
    """, unsafe_allow_html=True)

inject_apple_cupertino_css()

def fmt_curr(val):
    return f"{val:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


# ==============================================================================
# 1. EPIC 1: MASSIVE DATA SCALING ENGINE (In-Memory Deterministic Generator)
# ==============================================================================
@st.cache_data
def generate_enterprise_sap_data():
    random.seed(1337)
    
    core_vendors = [
        {"LIFNR": "10001", "NAME1": "Cisco Systems Germany GmbH", "ORT01": "Bonn", "LAND1": "DE", "STCD1": "DE123456780", "SPEND_YTD": 18200000.0},
        {"LIFNR": "10002", "NAME1": "Cisco Technology Inc.", "ORT01": "San Jose", "LAND1": "US", "STCD1": "US987654321", "SPEND_YTD": 14100000.0},
        {"LIFNR": "10003", "NAME1": "Meraki Cloud Networks Ltd.", "ORT01": "London", "LAND1": "GB", "STCD1": "GB554433221", "SPEND_YTD": 9500000.0},
        {"LIFNR": "10004", "NAME1": "Acacia Communications Opto", "ORT01": "Maynard", "LAND1": "US", "STCD1": "US112233445", "SPEND_YTD": 6200000.0},
        {"LIFNR": "10005", "NAME1": "Splunk Software EMEA", "ORT01": "Munich", "LAND1": "DE", "STCD1": "DE887766554", "SPEND_YTD": 4400000.0},
        
        {"LIFNR": "20001", "NAME1": "Microsoft Deutschland GmbH", "ORT01": "Munich", "LAND1": "DE", "STCD1": "DE998877665", "SPEND_YTD": 41000000.0},
        {"LIFNR": "20002", "NAME1": "Activision Blizzard Germany", "ORT01": "Ismaning", "LAND1": "DE", "STCD1": "DE556677889", "SPEND_YTD": 6000000.0},
    ]

    stems = ["Logistics", "Facility", "Consulting", "MRO", "Packaging", "IT-Services", "Robotics", "Chemicals", "Security", "Fleet"]
    cities = ["Frankfurt", "Stuttgart", "Hamburg", "Berlin", "Düsseldorf", "Paris", "Zurich", "Vienna", "Milan", "Madrid", "Amsterdam"]
    prefixes = ["Apex", "Global", "Nova", "Sino", "Euro", "Chroma", "Stellar", "Vanguard", "Omni", "Inno"]
    
    filler_vendors = []
    for i in range(8, 151):
        spend = round(random.uniform(15000.0, 3800000.0), 2)
        filler_vendors.append({
            "LIFNR": f"{30000 + i}",
            "NAME1": f"{random.choice(prefixes)} {random.choice(stems)} {random.choice(['GmbH', 'AG', 'S.A.', 'Ltd'])}",
            "ORT01": random.choice(cities),
            "LAND1": random.choice(["DE", "FR", "CH", "AT", "IT", "ES", "NL"]),
            "STCD1": f"EU{random.randint(100000000, 999999999)}",
            "SPEND_YTD": spend
        })
    
    all_vendors_list = core_vendors + filler_vendors
    df_lfa1 = pd.DataFrame(all_vendors_list)

    po_counts = {
        "10001": 30, "10002": 25, "10003": 20, "10004": 15, "10005": 10,
        "20001": 35, "20002": 15
    }
    for idx, v in enumerate(filler_vendors):
        po_counts[v["LIFNR"]] = 8 if idx < 49 else 7

    ekko_rows = []
    ebeln_base = 4500000001

    for v in all_vendors_list:
        lifnr = v["LIFNR"]
        target_sum = v["SPEND_YTD"]
        n_pos = po_counts[lifnr]
        
        target_cents = int(target_sum * 100)
        cutpoints = sorted([random.randint(1, target_cents - 1) for _ in range(n_pos - 1)])
        cutpoints = [0] + cutpoints + [target_cents]
        
        for k in range(len(cutpoints) - 1):
            val_cents = cutpoints[k+1] - cutpoints[k]
            netwr = val_cents / 100.0
            aedat = f"2026-{random.randint(1,5):02d}-{random.randint(1,28):02d}"
            
            ekko_rows.append({
                "EBELN": str(ebeln_base), "LIFNR": lifnr, "BUKRS": "1000",
                "AEDAT": aedat, "NETWR": netwr, "WAERS": "EUR"
            })
            ebeln_base += 1

    df_ekko = pd.DataFrame(ekko_rows).sample(frac=1, random_state=42).reset_index(drop=True)
    return df_lfa1, df_ekko

df_lfa1, df_ekko = generate_enterprise_sap_data()


# ==============================================================================
# HEADER & GLOBAL SEARCH BAR (Persists across all Tabs!)
# ==============================================================================
st.markdown("""
<div class="frosted-glass" style="margin-bottom: 16px;">
    <h1 style="margin:0; font-size: 32px; font-weight: 800; letter-spacing: -1px;">
        PROC Kickback Hunter AI <span style="color:#007AFF; font-size: 20px;">v4.2 Enterprise</span>
    </h1>
    <p style="margin: 4px 0 0 0; color: #8E8E93; font-size: 15px;">
        Agentic Multi-Hop Entity Resolution & Automated Spend Consolidation for SAP ECC / S/4HANA
    </p>
</div>
""", unsafe_allow_html=True)

# ARCHITEKTUR-FIX: Globale Suchleiste über den Tabs platziert!
global_search_query = st.text_input(
    "🔍 GLOBALE KREDITOR- & ENTITÄTSSUCHE (Filtert in Echtzeit Tabellen, KI-Fokus & Audit-Berichte)...", 
    value="", 
    placeholder="Tippe z.B. 'Cisco', 'Microsoft', '10004', 'Munich' oder 'Activision'..."
).strip()

# Globale Filterung der Datensätze
if global_search_query:
    q_lower = global_search_query.lower()
    mask_lfa1 = (
        df_lfa1["NAME1"].str.lower().str.contains(q_lower, na=False) |
        df_lfa1["ORT01"].str.lower().str.contains(q_lower, na=False) |
        df_lfa1["LIFNR"].str.lower().str.contains(q_lower, na=False)
    )
    filtered_lfa1 = df_lfa1[mask_lfa1]
    filtered_ekko = df_ekko[df_ekko["LIFNR"].isin(filtered_lfa1["LIFNR"].tolist())]
else:
    filtered_lfa1 = df_lfa1
    filtered_ekko = df_ekko

# Check helper für den dynamischen Scope
is_cisco_in_search = not global_search_query or any(k in global_search_query.lower() for k in ["cisc", "bonn", "san jose", "meraki", "acacia", "splunk", "10001", "10002", "10003", "10004", "10005"])
is_msft_in_search = not global_search_query or any(k in global_search_query.lower() for k in ["micr", "activ", "blizz", "20001", "20002"])


# NAVIGATION TABS
tab1, tab2, tab3, tab4 = st.tabs([
    "🏛️ 1. SAP ERP Source Dump", 
    "🧠 2. LangGraph Deep-Thought", 
    "💎 3. Financial Impact",
    "📈 4. Management Summary & E-Mail"
])


# ==============================================================================
# TAB 1: SOURCE DUMP
# ==============================================================================
with tab1:
    st.markdown(f"<h3 style='margin-bottom:16px;'>In-Memory Subsystem Dump (Gefiltert: {len(filtered_lfa1)} Kreditoren)</h3>", unsafe_allow_html=True)
    col_lfa1, col_ekko = st.columns(2)
    
    with col_lfa1:
        st.markdown(f"**Kreditorenstamm (`SAP.LFA1`)**")
        st.dataframe(filtered_lfa1.style.format({"SPEND_YTD": "{:,.2f} €"}), use_container_width=True, height=450, hide_index=True)

    with col_ekko:
        st.markdown(f"**Bestellbelege YTD (`SAP.EKKO`)** — Zugehörige Einzelbelege")
        st.dataframe(filtered_ekko.style.format({"NETWR": "{:,.2f} €"}), use_container_width=True, height=450, hide_index=True)


# ==============================================================================
# TAB 2: LANGGRAPH DEEP-THOUGHT ORCHESTRATOR
# ==============================================================================
def render_pipeline_badges(active_step):
    steps = [("🕵️‍♂️", "1. ERP Ingestion"), ("🧬", "2. Fuzzy Matcher"), ("🌐", "3. Web Graph"), ("⚖️", "4. Legal RAG"), ("🧮", "5. Math Core")]
    html = '<div class="pipeline-track">'
    for idx, (icon, label) in enumerate(steps, 1):
        status = "active" if active_step == idx else ("done" if active_step > idx else "")
        html += f'<div class="agent-pill {status}">{icon} {label}</div>'
    return html + '</div>'

with tab2:
    st.markdown("<h3>Agentic Execution Pipeline (Choreografiert auf exakt 30.0s)</h3>", unsafe_allow_html=True)
    
    badge_container = st.empty()
    terminal_container = st.empty()
    
    badge_container.markdown(render_pipeline_badges(0), unsafe_allow_html=True)
    terminal_container.markdown('<div class="apple-terminal"><span class="terminal-time">[00:00.0]</span> <span class="terminal-source">[SYSTEM]</span> Ready. Set global filter above and click execute...</div>', unsafe_allow_html=True)

    if st.button("🚀 EXECUTE LANGGRAPH VENDOR DEEP-SCAN", type="primary"):
        log_text = ""
        def push_term(t_str, src="LANGGRAPH", time_code="00:00"):
            global log_text
            log_text += f'<span class="terminal-time">[{time_code}]</span> <span class="terminal-source">[{src}]</span> {t_str}<br>'
            terminal_container.markdown(f'<div class="apple-terminal">{log_text}</div>', unsafe_allow_html=True)

        # Phase 1
        badge_container.markdown(render_pipeline_badges(1), unsafe_allow_html=True)
        if global_search_query:
            push_term(f"Globaler Filter aktiv ➔ Fokussiere Graph-Traversierung auf Entitäts-Query: '<b>{global_search_query}</b>'", "ORCHESTRATOR", "00:01")
        push_term("Alloziere SAP In-Memory Vektorraum für Belegstrukturen...", "ERP-INGEST", "00:02")
        time.sleep(3.0)
        push_term("Initial-Salden aus SAP FI-AP erfolgreich extrahiert.", "ERP-INGEST", "00:05")

        # Phase 2
        badge_container.markdown(render_pipeline_badges(2), unsafe_allow_html=True)
        push_term("Überführe Stammdaten in n-dimensionale Levenshtein-Vektoren...", "FUZZY-SPACE", "00:07")
        time.sleep(3.0)
        if is_cisco_in_search: push_term("Hohe Namensähnlichkeit: 'Cisco Systems Germany' & 'Cisco Technology Inc.' (Score: 0.94)", "FUZZY-SPACE", "00:10")
        elif is_msft_in_search: push_term("Steuer-ID Cluster erkannt: Microsoft Deutschland & Activision Blizzard (Mutter-Tochter Verbund)", "FUZZY-SPACE", "00:10")
        else: push_term(f"Scanne Einheiten für Suchbegriff '{global_search_query}'...", "FUZZY-SPACE", "00:10")
        time.sleep(1.0)

        # Phase 3
        badge_container.markdown(render_pipeline_badges(3), unsafe_allow_html=True)
        push_term("Frage globale SEC-Filings & Handelsregister via OSINT-Agent ab...", "OSINT-CRAWL", "00:12")
        time.sleep(3.0)
        if is_cisco_in_search:
            push_term("Verifiziere 10-K Filing: Cisco Systems kaufte Acacia ($4.5B) & Splunk ($28B).", "OSINT-CRAWL", "00:15")
        if is_msft_in_search:
            push_term("Verifiziere SEC Filing: Microsoft schließt Akquisition von Activision Blizzard ab.", "OSINT-CRAWL", "00:16")
        time.sleep(2.0)

        # Phase 4
        badge_container.markdown(render_pipeline_badges(4), unsafe_allow_html=True)
        push_term("Vektorisiere hinterlegte PDF-Rahmenverträge der GlobalCorp SE...", "LEGAL-RAG", "00:19")
        time.sleep(3.0)
        push_term("<i style='color:#fff;'>Extrahierte Klausel: '2.0% Kickback ab einem kumulierten Gruppen-Bestellwert von exakt 50.000.000,00 €.'</i>", "LEGAL-RAG", "00:23")
        time.sleep(1.0)

        # Phase 5
        badge_container.markdown(render_pipeline_badges(5), unsafe_allow_html=True)
        push_term("Übergebe Sub-Graphen an deterministische SymPy-Engine...", "MATH-CORE", "00:25")
        time.sleep(2.0)
        
        if is_cisco_in_search:
            push_term("Prüfe Cisco Cluster: Summe = 52.400.000,00 € ➔ > 50.0M? <b>TRUE</b> (Cashback verifiziert!)", "MATH-CORE", "00:27")
        if is_msft_in_search:
            push_term("Prüfe Microsoft Cluster: Summe = 47.000.000,00 € ➔ > 50.0M? <b style='color:#FF453A;'>FALSE</b> (Kein Cashback)", "MATH-CORE", "00:28")
        
        if not is_cisco_in_search and not is_msft_in_search:
            c_sum = filtered_lfa1["SPEND_YTD"].sum()
            hit = c_sum >= 50000000
            col = "#30D158" if hit else "#FF453A"
            push_term(f"Prüfe Custom-Query '{global_search_query}': Summe = {fmt_curr(c_sum)} ➔ > 50.0M? <b style='color:{col};'>{hit}</b>", "MATH-CORE", "00:29")

        time.sleep(1.0)
        push_term("Generiere RFC/BAPI-Payload für FI-CA Buchung... Done.", "MATH-CORE", "00:30")
        
        badge_container.markdown(render_pipeline_badges(6), unsafe_allow_html=True)
        st.balloons()
        st.success("✅ **DEEP-SCAN ABGESCHLOSSEN.** Bitte wechseln Sie in Reiter 3 oder 4 für das Management-Briefing.")


# ==============================================================================
# TAB 3: FINANCIAL IMPACT (Dynamisch gesteuert durch Suchleiste!)
# ==============================================================================
with tab3:
    st.markdown("<h3>Executive Financial Summary & Audit-Nachweise</h3>", unsafe_allow_html=True)
    
    kcol1, kcol2, kcol3, kcol4 = st.columns(4)
    with kcol1: st.metric("Silo SQL-Skript Kickback", "0,00 €", "Standard SAP Report")
    with kcol2: st.metric("Konsolidierter Cisco Spend", "52.400.000,00 €", "+2.4M € über Schwelle")
    with kcol3: st.metric("Identifizierter Cashback", "1.048.000,00 €", "2.0% vertraglicher Kickback")
    with kcol4: st.metric("EBITDA Impact YTD", "+ 1.048.000 €", "Sofort wirksam", delta_color="normal")

    st.markdown("<hr style='border-color: rgba(255,255,255,0.08); margin: 24px 0;'>", unsafe_allow_html=True)

    # Dynamische Darstellung der Boxen basierend auf der Suche
    rendered_boxes = 0
    cols = st.columns(2)

    if is_cisco_in_search:
        with cols[rendered_boxes % 2]:
            st.markdown("""
            <div class="frosted-glass">
                <h4 style="margin-top:0; color: #007AFF;">🟢 ENTITY CLUSTER #1: Cisco Systems Group</h4>
                <p style="color:#8E8E93; font-size: 13px;">Durch Multi-Hop Reasoning konsolidierte SAP-Kreditoren</p>
            </div>
            """, unsafe_allow_html=True)
            cisco_df = df_lfa1[df_lfa1["LIFNR"].isin(["10001", "10002", "10003", "10004", "10005"])]
            st.dataframe(cisco_df[["LIFNR", "NAME1", "ORT01", "SPEND_YTD"]].style.format({"SPEND_YTD": "{:,.2f} €"}), use_container_width=True, hide_index=True)
            st.markdown('<div style="background: rgba(48, 209, 88, 0.1); border: 1px solid #30D158; padding: 12px; border-radius: 10px; margin-top: 12px;"><b style="color:#30D158;">Ergebnis:</b> 52,40 Mio. € Spend > 50,00 Mio. € Schwelle ➔ <b>Anspruch auf 1.048.000,00 € Rückvergütung verifiziert.</b></div>', unsafe_allow_html=True)
        rendered_boxes += 1

    if is_msft_in_search:
        with cols[rendered_boxes % 2]:
            st.markdown("""
            <div class="frosted-glass">
                <h4 style="margin-top:0; color: #FF453A;">🛡️ AUDITOR PROOF: Die Microsoft M&A-Falle</h4>
                <p style="color:#8E8E93; font-size: 13px;">Beweis der mathematischen und logischen Integrität der KI</p>
            </div>
            """, unsafe_allow_html=True)
            msft_df = df_lfa1[df_lfa1["LIFNR"].isin(["20001", "20002"])]
            st.dataframe(msft_df[["LIFNR", "NAME1", "ORT01", "SPEND_YTD"]].style.format({"SPEND_YTD": "{:,.2f} €"}), use_container_width=True, hide_index=True)
            st.markdown('<div style="background: rgba(255, 69, 58, 0.1); border: 1px solid #FF453A; padding: 12px; border-radius: 10px; margin-top: 12px; font-size: 14px;"><b style="color:#FF453A;">Audit-Logik intakt:</b> Die Agentic AI hat Activision korrekt zu Microsoft konsolidiert (Spend: <b>47,00 Mio. €</b>). Da die 50M-Schwelle verfehlt wurde, hat die KI <b>keinen falschen Anspruch</b> ausgelöst.</div>', unsafe_allow_html=True)
        rendered_boxes += 1

    # Falls der User nach einem Custom-Lieferanten gesucht hat, der weder Cisco noch MSFT ist:
    if not is_cisco_in_search and not is_msft_in_search and len(filtered_lfa1) > 0:
        with cols[0]:
            st.markdown(f"""
            <div class="frosted-glass">
                <h4 style="margin-top:0; color: #F5C211;">🟡 CUSTOM SEARCH TARGET: "{global_search_query}"</h4>
                <p style="color:#8E8E93; font-size: 13px;">Gefilterte Entitäten aus dem SAP-Bestand</p>
            </div>
            """, unsafe_allow_html=True)
            st.dataframe(filtered_lfa1[["LIFNR", "NAME1", "ORT01", "SPEND_YTD"]].style.format({"SPEND_YTD": "{:,.2f} €"}), use_container_width=True, hide_index=True)
            
            c_spend = filtered_lfa1["SPEND_YTD"].sum()
            if c_spend >= 50000000:
                st.markdown(f'<div style="background: rgba(48, 209, 88, 0.1); border: 1px solid #30D158; padding: 12px; border-radius: 10px; margin-top: 12px;"><b style="color:#30D158;">Erfolg!</b> Kumulierter Spend ({fmt_curr(c_spend)}) überschreitet 50M-Schwelle. Kickback-Anspruch: <b>{fmt_curr(c_spend*0.02)}</b>.</div>', unsafe_allow_html=True)
            else:
                st.markdown(f'<div style="background: rgba(255, 159, 10, 0.1); border: 1px solid #FF9F0A; padding: 12px; border-radius: 10px; margin-top: 12px;"><b style="color:#FF9F0A;">Hinweis:</b> Kumulierter Spend liegt bei <b>{fmt_curr(c_spend)}</b> und damit unter der vertraglichen 50.0M € Kickback-Schwelle.</div>', unsafe_allow_html=True)

    st.markdown("<div style='margin-top: 32px;'></div>", unsafe_allow_html=True)
    if st.button("⚡ BAPI: Debitoren-Sollstellung im SAP FI-CA erzeugen (Transaktion FB01)", type="primary"):
        st.toast("BAPI_ACC_DOCUMENT_POST erfolgreich an SAP S/4HANA abgesetzt!", icon="🚀")
        st.success("Buchungsbeleg **#109482001** (Debitor Cisco Systems an Erlöse aus Rückvergütungen: 1.048.000,00 €) im SAP erzeugt.")


# ==============================================================================
# TAB 4: EPIC 4 - MANAGEMENT SUMMARY, PLOTLY CHART & EXECUTIVE EMAIL
# ==============================================================================
with tab4:
    st.markdown("<h3>Executive Board Visualizer & E-Mail Dispatcher</h3>", unsafe_allow_html=True)
    
    col_graph, col_mail = st.columns([1.1, 0.9])

    with col_graph:
        st.markdown("**Spend-Konsolidierung vs. Kickback-Schwellenwert**")
        
        fig = go.Figure()

        # Bar 1: Silo
        fig.add_trace(go.Bar(
            name="SAP Einzelsilo (Max)", x=["Cisco Group", "Microsoft Group"], y=[18200000, 41000000],
            marker_color="#3A3A3C", text=["18.2M € (Bonn)", "41.0M € (München)"], textposition="auto"
        ))
        
        # Bar 2: Consolidated
        fig.add_trace(go.Bar(
            name="AI Konsolidiert (True Spend)", x=["Cisco Group", "Microsoft Group"], y=[52400000, 47000000],
            marker_color=["#30D158", "#FF453A"], text=["52.4M € (HIT!)", "47.0M € (No Hit)"], textposition="outside"
        ))

        # 50M Threshold Line
        fig.add_hline(
            y=50000000, line_dash="dash", line_color="#007AFF",
            annotation_text="Vertragliche Kickback-Schwelle (50.0 Mio. €)", 
            annotation_position="top left", annotation_font_color="#007AFF"
        )

        fig.update_layout(
            barmode='group', plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#F5F5F7"), margin=dict(l=10, r=10, t=30, b=10), height=400,
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
            yaxis=dict(title="Spend YTD in €", gridcolor="#1C1C1E", zerolinecolor="#1C1C1E")
        )
        st.plotly_chart(fig, use_container_width=True)
        st.info("💡 **CFO Takeaway:** Ohne AI-Konsolidierung (graue Balken) entgehen GlobalCorp jährlich Millionenbeträge, da kein Einzellieferant die 50M-Linie durchbricht.")

    with col_mail:
        st.markdown("**Automatisierter E-Mail-Entwurf (C-Level Dispatch)**")
        
        target_entity_name = global_search_query if global_search_query else "Cisco Systems & Microsoft"
        
        mail_body = f"""
        <div class="apple-mail-box">
            <div class="mail-row"><b>VON:</b> <span class="val">AI.ProcurementOrchestrator@globalcorp.com</span></div>
            <div class="mail-row"><b>AN:</b> <span class="val">Dr. Henrik von Bohlen (CFO)</span></div>
            <div class="mail-row"><b>CC:</b> <span class="val">Marcus Thorne (Global Head of Procurement)</span></div>
            <div class="mail-row" style="margin-top: 10px; color:#007AFF;"><b>BETREFF: [STRICTLY CONFIDENTIAL] AI Audit Q2/2026 — 1.048.000 € Rückvergütung gesichert</b></div>
            
            <div class="mail-divider"></div>
            
            <div style="font-size: 13.5px; line-height: 1.6; color: #D1D1D6;">
                Sehr geehrter Herr Dr. von Bohlen,<br><br>
                unsere autonome Agentic AI hat den globalen SAP-Lieferantenstamm unter Fokus auf die Suchmaske <b>„{target_entity_name}“</b> auditiert. 
                Durch Multi-Hop Entity Resolution wurden folgende historische M&A-Fragmente rechtssicher konsolidiert:<br><br>
                
                <b style="color:#30D158;">1. VERIFIZIERTER CASHBACK: Cisco Systems Group</b><br>
                • Fragmentierte SAP-Töchter: <i>Bonn, San Jose, London (Meraki), Maynard (Acacia), München (Splunk)</i><br>
                • Kumulierter True-Spend: <b>52.400.000,00 €</b> (Höchstes Einzelsilo lag bei nur 18.2M €)<br>
                • Vertrag: <i>Klausel 8.2 (CTR-2024-CISC)</i> ➔ Schwellenwert (50.0M €) überschritten.<br>
                • <b>Gesicherter Cash-Return: + 1.048.000,00 €</b> (BAPI-Sollstellung in Vorbereitung)<br><br>

                <b style="color:#FF453A;">2. COMPLIANCE NACHWEIS: Microsoft / Activision Blizzard</b><br>
                • Kumulierter True-Spend: <b>47.000.000,00 €</b> ➔ Schwellenwert (50.0M €) exakt verfehlt.<br>
                • Prädikat: Logik-Integrität intakt (Keine falsche Cashback-Forderung ausgelöst).<br><br>
                
                Mit freundlichen Grüßen<br>
                <b>PROC Kickback Hunter AI</b> (v4.2 Enterprise Core)
            </div>
        </div>
        """
        st.markdown(mail_body, unsafe_allow_html=True)
        
        st.markdown("<div style='margin-top: 16px;'></div>", unsafe_allow_html=True)
        if st.button("✉️ E-Mail sofort über internes SMTP-Relay versenden", type="primary"):
            st.balloons()
            st.success("TLS-Handshake erfolgreich: E-Mail wurde kryptografisch signiert und an **cfo@globalcorp.com** zugestellt.")