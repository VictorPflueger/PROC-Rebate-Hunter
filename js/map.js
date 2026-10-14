// Leaflet map: basemap (tiles + offline land layer), vendor accounts, GlobalCorp's company codes,
// corporate group headquarters, register links (account → group) and billing links (account →
// company code), legend, popovers and the entity state API used by run events.

import { getModel, distKm, spendBand } from "./world.js";
import { BASEMAP, UI } from "./config.js";
import { h, escapeHtml, prefersReducedMotion } from "./dom.js";
import { icon, iconSvg } from "./icons.js";
import { vendorPopover, companyCodePopover, groupPopover, linkPopover } from "./popovers.js";

// Map colours come from the design tokens (css/tokens.css), read once when the map is created:
//   - the vendor master (accounts by size, register links, group headquarters) is a quiet slate
//     ramp, darker = more spend, so it recedes behind the states that matter;
//   - states use the status colours: a saturated stroke for the line, a lighter fill for the shape,
//     and a larger marker or heavier line than the network, so a state stands out without relying on
//     hue alone (the popover names it in words; tools/palette.mjs checks the hues for colour blindness);
//   - GlobalCorp's company codes and their billing links carry the brand burgundy.
let COLOR = {};
let STATE_FILL = {};
let BAND = {};
let BAND_LINE = {};
const LINK_OPACITY = 0.6;

function readMapColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  COLOR = {
    affected: v("--affected", "#c32b21"), at_risk: v("--at-risk", "#d3751a"), resolved: v("--resolved", "#36967a"),
    link: v("--network", "#596989"), spoke: v("--wine-8", "#dca3ad"), node: v("--network", "#596989"), nodeFill: "#ffffff",
    land: "#ffffff", coast: v("--slate-6", "#d2dae9"), border: v("--ink-5", "#ebe1e2")
  };
  STATE_FILL = { affected: v("--affected-fill", "#ffb6ab"), at_risk: v("--at-risk-fill", "#f5be97"), resolved: v("--resolved-fill", "#a8d7c6") };
  BAND = { 1: v("--slate-8", "#a9b5cf"), 2: v("--slate-6", "#d2dae9"), 3: v("--slate-4", "#e7ecf5") };
  BAND_LINE = { 1: v("--slate-11", "#445271"), 2: v("--slate-9", "#596989"), 3: v("--slate-8", "#a9b5cf") };
}
// Register links: an acquired company dashed, a subsidiary or the parent entity solid.
// At rest they stay light, so the long arcs to US headquarters do not crowd the Europe view; a
// marked link gains weight and full opacity.
const LINK = {
  acquired: { weight: 1.75, dash: "8 5" },
  subsidiary: { weight: 1.5, dash: null },
  "parent entity": { weight: 1.5, dash: null }
};
// Label placement where two labelled headquarters sit close together.
const NODE_LABEL_SIDE = { "G-CRM": "top", "G-AVGO": "bottom", "G-CISCO": "right", "G-APEX-DE": "right", "G-SCHN": "left", "G-APEX-GB": "left" };
const LABEL_OFFSET = { right: [8, 0], left: [-8, 0], top: [0, -6], bottom: [0, 6] };
// Schneider Electric sits in the middle of the Paris accounts: its label clears the cluster.
const NODE_LABEL_OFFSET = { "G-SCHN": [-24, 0] };

/**
 * Creates the map inside `container`. Returns an API object; if Leaflet failed to load,
 * returns a no-op API and shows an explanation instead of the map.
 */
export function createMap(container) {
  const L = window.L;
  readMapColors();
  if (!L) return fallbackMap(container, "The map library (Leaflet) could not be loaded from unpkg, jsDelivr or the local copy in vendor/. Rebate Hunter keeps working without the map: the console, options, outbox and audit are unaffected.");

  const model = getModel();
  const map = L.map(container, {
    zoomControl: false, attributionControl: true,
    minZoom: 2, maxZoom: 11, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 110,
    worldCopyJump: false, maxBounds: [[-80, -190], [85, 210]], maxBoundsViscosity: 0.7
  });
  L.control.zoom({ position: "bottomright" }).addTo(map);
  map.attributionControl.setPrefix(false);

  // The last view the app asked for (a fit, a focus or an overview). When the map is resized, for
  // example when the drawer opens, that view is re-applied so the marked region stays in sight.
  // Any pan or zoom by the presenter takes over and clears it.
  let viewIntent = null;
  const userTookOver = () => { viewIntent = null; };
  map.on("dragstart", userTookOver);
  for (const type of ["wheel", "dblclick", "keydown"]) container.addEventListener(type, userTookOver, { passive: true });
  container.addEventListener("click", (e) => { if (e.target.closest?.(".leaflet-control-zoom")) userTookOver(); });

  const panes = { offline: 150, billing: 360, links: 380, groups: 410, vendors: 440, codes: 620 };
  for (const [name, z] of Object.entries(panes)) {
    const pane = map.createPane(name);
    pane.style.zIndex = String(z);
    if (name === "offline") pane.style.pointerEvents = "none";
  }

  // ---- basemap ------------------------------------------------------------------------------
  const statusEl = h("div", { class: "map-status", hidden: true, role: "status" }, icon("info", 16), h("span", {}));
  container.parentElement.appendChild(statusEl);
  const showStatus = (text) => {
    statusEl.lastChild.textContent = text;
    statusEl.hidden = !text;
  };

  addOfflineBasemap(L, map);
  const basemap = { kind: BASEMAP.cartoKey ? "carto" : "osm", loaded: 0, errors: 0 };
  const tiles = makeTileLayer(L, basemap.kind);
  tiles.on("tileload", () => {
    basemap.loaded++;
    if (basemap.loaded === 1) showStatus("");
  });
  tiles.on("tileerror", () => {
    basemap.errors++;
    if (basemap.kind === "carto" && basemap.loaded === 0 && basemap.errors >= 4) {
      map.removeLayer(tiles);
      basemap.kind = "osm";
      basemap.errors = 0;
      const osm = makeTileLayer(L, "osm");
      osm.on("tileload", () => { basemap.loaded++; showStatus(""); });
      osm.on("tileerror", () => {
        basemap.errors++;
        if (basemap.loaded === 0 && basemap.errors >= 6) showStatus("Map tiles unavailable — showing the offline coastline map");
      });
      osm.addTo(map);
    } else if (basemap.loaded === 0 && basemap.errors >= 6) {
      showStatus("Map tiles unavailable — showing the offline coastline map");
    }
  });
  tiles.addTo(map);

  // ---- layers --------------------------------------------------------------------------------
  const layers = {
    billing: L.layerGroup().addTo(map),
    links: L.layerGroup().addTo(map),
    groups: L.layerGroup().addTo(map),
    vendors: L.layerGroup().addTo(map),
    small: L.layerGroup().addTo(map),
    codes: L.layerGroup().addTo(map)
  };
  const reg = { vendors: new Map(), billing: new Map(), links: new Map(), groups: new Map(), codes: new Map() };
  const states = new Map();
  const getState = (key) => states.get(key) || "neutral";

  const popupOpts = { maxWidth: 440, minWidth: 280, autoPanPadding: [48, 48], className: "app-popup" };

  // Billing links (thin spokes from an account to the company code it invoices) ----------------
  for (const v of model.world.vendors) {
    const cc = model.companyCodes.get(v.company_code);
    if (!cc) continue;
    const line = L.polyline(curve([v.lat, v.lon], [cc.lat, cc.lon]), { pane: "billing", color: COLOR.spoke, weight: 1, opacity: 0.55, interactive: false });
    line.addTo(layers.billing);
    reg.billing.set(v.id, line);
  }

  // Register links (account → ultimate parent) ---------------------------------------------------
  for (const r of model.world.register) {
    const v = model.vendors.get(r.vendor);
    const g = model.groups.get(r.group);
    if (!v || !g) continue;
    const st = LINK[r.relation] || LINK.subsidiary;
    const line = L.polyline(curve([v.lat, v.lon], [g.lat, g.lon]), {
      pane: "links", color: COLOR.link, weight: st.weight, opacity: LINK_OPACITY,
      dashArray: st.dash, lineCap: "round", lineJoin: "round", smoothFactor: 1.2
    });
    line.linkStyle = st;
    line.bindTooltip(escapeHtml(`${v.name} → ${g.short}`), { sticky: true, className: "hover-label", direction: "top", offset: [0, -6] });
    line.bindPopup(() => linkPopover(model, r.vendor, getState(`link:${r.vendor}`)), popupOpts);
    line.addTo(layers.links);
    reg.links.set(`L-${r.vendor}`, line);
  }

  // Group headquarters (labelled) ----------------------------------------------------------------
  for (const g of model.world.groups) {
    const m = L.circleMarker([g.lat, g.lon], {
      pane: "groups", radius: 6, color: COLOR.node, weight: 2, fillColor: COLOR.nodeFill, fillOpacity: 1
    });
    const side = NODE_LABEL_SIDE[g.id] || "right";
    m.bindTooltip(escapeHtml(g.short), { permanent: true, direction: side, offset: NODE_LABEL_OFFSET[g.id] || LABEL_OFFSET[side], className: "node-label" });
    m.bindPopup(() => groupPopover(model, g.id, getState(`group:${g.id}`)), popupOpts);
    m.addTo(layers.groups);
    reg.groups.set(g.id, m);
  }

  // Vendor accounts (by size) --------------------------------------------------------------------
  for (const v of model.world.vendors) {
    const band = spendBand(v);
    const base = band === 1 ? 7 : band === 2 ? 5.5 : 4.5;
    const m = L.circleMarker([v.lat, v.lon], {
      pane: "vendors", radius: base, color: BAND_LINE[band], weight: 1.5, fillColor: BAND[band], fillOpacity: 1
    });
    m.baseRadius = base;
    m.band = band;
    m.bindTooltip(escapeHtml(`${v.name} — ${v.city}`), { className: "hover-label", direction: "top", offset: [0, -8] });
    m.bindPopup(() => vendorPopover(model, v.id, getState(`vendor:${v.id}`)), popupOpts);
    m.addTo(band === 3 ? layers.small : layers.vendors);
    reg.vendors.set(v.id, m);
  }

  // Company codes ---------------------------------------------------------------------------------
  for (const c of model.world.company_codes) {
    const m = L.marker([c.lat, c.lon], {
      pane: "codes", riseOnHover: true, keyboard: true, title: `${c.code} ${c.name}`, alt: c.name,
      icon: L.divIcon({
        className: "site-icon", iconSize: [0, 0],
        html: `<div class="site-marker" data-state="neutral"><span class="site-glyph">${iconSvg("building", 22)}</span><span class="site-label">${escapeHtml(c.short)}</span></div>`
      })
    });
    m.bindPopup(() => companyCodePopover(model, c.id, getState(`code:${c.id}`)), popupOpts);
    m.addTo(layers.codes);
    reg.codes.set(c.id, m);
  }

  // ---- legend and tools --------------------------------------------------------------------------
  const legend = buildLegend(map, layers);
  container.parentElement.appendChild(legend);
  if (typeof ResizeObserver === "function") {
    new ResizeObserver((entries) => legend.fitToHeight(entries[0].contentRect.height)).observe(container);
  }
  const tools = h("div", { class: "map-tools" },
    h("button", { class: "btn btn-sm", type: "button", on: { click: () => showNetwork() } }, icon("target", 18), "Europe view"),
    h("button", { class: "btn btn-sm", type: "button", on: { click: () => showWorld() } }, icon("globe", 18), "Global view")
  );
  container.parentElement.appendChild(tools);

  // Below zoom 2.75 the headquarters labels go; below 4.5 the company codes shrink to their glyph, so
  // Frankfurt, Lyon and Birmingham do not cover each other in the transatlantic views.
  const syncZoomClass = () => {
    container.classList.toggle("zoom-low", map.getZoom() < 2.75);
    container.classList.toggle("zoom-far", map.getZoom() < 4.5);
  };
  map.on("zoomend", syncZoomClass);

  // The legend overlays the bottom left of the map: expanded, a tall card down the left side;
  // collapsed, a small bar in the corner. Views the app sets keep their subject in the part of the
  // map the legend leaves free (to its right, or above the bar), so a group in San Jose is never
  // hidden behind it.
  function legendInset() {
    if (!legend.isConnected) return { left: 0, bottom: 0 };
    const lr = legend.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    if (!cr.width || !lr.width) return { left: 0, bottom: 0 };
    if (legend.dataset.collapsed !== "true" && lr.height >= cr.height * 0.3) {
      return { left: Math.max(0, Math.min(Math.round(lr.right - cr.left), Math.round(cr.width * 0.4))), bottom: 0 };
    }
    return { left: 0, bottom: Math.max(0, Math.min(Math.round(cr.bottom - lr.top), Math.round(cr.height * 0.3))) };
  }
  const fitPadding = () => {
    const inset = legendInset();
    return { paddingTopLeft: [inset.left + 24, 24], paddingBottomRight: [24, inset.bottom + 24] };
  };
  /** The map centre that shows [lat, lon] in the middle of the free part of the map at zoom z. */
  function freeCenter(lat, lon, z) {
    const inset = legendInset();
    if (!inset.left && !inset.bottom) return L.latLng(lat, lon);
    return map.unproject(map.project([lat, lon], z).subtract([inset.left / 2, 0]).add([0, inset.bottom / 2]), z);
  }
  /** Re-applies the last view the app asked for, without animation (after a resize or a legend change). */
  function reapply() {
    if (!viewIntent) return;
    if (viewIntent.kind === "bounds") map.fitBounds(viewIntent.bounds, { ...fitPadding(), animate: false, maxZoom: viewIntent.maxZoom });
    else map.setView(freeCenter(...viewIntent.target, viewIntent.zoom), viewIntent.zoom, { animate: false });
  }
  // A fly that started before the map or the legend changed (the drawer opening at replay speed ×4)
  // lands where the old layout wanted it: when it ends, the view is set again for the layout now.
  function settleAfterFly() {
    const intent = viewIntent;
    const size = map.getSize();
    const folded = legend.dataset.collapsed;
    map.once("moveend", () => {
      if (viewIntent === intent && (!map.getSize().equals(size) || legend.dataset.collapsed !== folded)) reapply();
    });
  }
  legend.onToggle = () => reapply();

  function showNetwork() {
    viewIntent = { kind: "view", target: [UI.networkView.lat, UI.networkView.lon], zoom: UI.networkView.zoom };
    map.setView(freeCenter(...viewIntent.target, viewIntent.zoom), viewIntent.zoom, { animate: !prefersReducedMotion() });
  }
  function showWorld() {
    const pts = [...model.world.vendors, ...model.world.groups].map((x) => [x.lat, x.lon]);
    viewIntent = { kind: "bounds", bounds: L.latLngBounds(pts).pad(0.05), maxZoom: 11 };
    map.fitBounds(viewIntent.bounds, { ...fitPadding(), animate: !prefersReducedMotion() });
  }
  showNetwork();
  syncZoomClass();

  // ---- state styling ------------------------------------------------------------------------------
  const pathClass = (layer, st, flash) => {
    const el = layer.getElement?.();
    if (!el) return;
    el.classList.remove("state-affected", "state-at_risk", "state-resolved");
    if (st !== "neutral") el.classList.add(`state-${st}`);
    if (flash && !prefersReducedMotion()) {
      el.classList.remove("flash");
      void el.getBoundingClientRect();
      el.classList.add("flash");
    }
  };

  function styleVendor(id, flash) {
    const m = reg.vendors.get(id);
    if (!m) return;
    const st = getState(`vendor:${id}`);
    m.setStyle({
      fillColor: st === "neutral" ? BAND[m.band] : STATE_FILL[st],
      color: st === "neutral" ? BAND_LINE[m.band] : COLOR[st],
      weight: st === "neutral" ? 1.5 : 2.5
    });
    m.setRadius(m.baseRadius + (st === "affected" ? 3 : st === "neutral" ? 0 : 2));
    // A marked small account shows even when the small-account layer is hidden.
    if (st !== "neutral" && m.band === 3 && !map.hasLayer(m)) m.addTo(map);
    if (st === "neutral" && m.band === 3 && !map.hasLayer(layers.small)) map.removeLayer(m);
    if (st !== "neutral") m.bringToFront();
    pathClass(m, st, flash);
    const spoke = reg.billing.get(id);
    if (spoke) spoke.setStyle(st === "neutral" ? { color: COLOR.spoke, weight: 1, opacity: 0.55 } : { color: COLOR[st], weight: 1.8, opacity: 0.85 });
  }

  function styleLink(id, flash) {
    const line = reg.links.get(id);
    if (!line) return;
    const st = getState(`link:${id.slice(2)}`);
    line.setStyle({ color: st === "neutral" ? COLOR.link : COLOR[st], weight: line.linkStyle.weight + (st === "neutral" ? 0 : 1.6), opacity: st === "neutral" ? LINK_OPACITY : 1 });
    if (st !== "neutral") line.bringToFront();
    pathClass(line, st, flash);
  }

  function styleGroup(id, flash) {
    const m = reg.groups.get(id);
    if (!m) return;
    const st = getState(`group:${id}`);
    m.setStyle({ color: st === "neutral" ? COLOR.node : COLOR[st], weight: st === "neutral" ? 2 : 3, fillColor: st === "neutral" ? COLOR.nodeFill : STATE_FILL[st] });
    m.setRadius(st === "neutral" ? 6 : 8);
    pathClass(m, st, flash);
  }

  function styleCode(id) {
    const el = reg.codes.get(id)?.getElement()?.querySelector(".site-marker");
    if (el) el.dataset.state = getState(`code:${id}`);
  }

  /** Apply a state to entities: vendor accounts, register links (L-…), groups (G-…), company codes (CC-…). */
  function mark({ vendor_ids = [], link_ids = [], group_ids = [], company_code_ids = [], state = "affected" } = {}) {
    const st = ["affected", "at_risk", "resolved", "neutral"].includes(state) ? state : "affected";
    for (const id of vendor_ids || []) {
      if (String(id).startsWith("G-")) { states.set(`group:${id}`, st); styleGroup(id, st === "affected"); continue; }
      if (String(id).startsWith("CC-")) { states.set(`code:${id}`, st); styleCode(id); continue; }
      states.set(`vendor:${id}`, st);
      styleVendor(id, st === "affected");
    }
    for (const id of link_ids || []) { states.set(`link:${String(id).slice(2)}`, st); styleLink(String(id), st === "affected"); }
    for (const id of group_ids || []) { states.set(`group:${id}`, st); styleGroup(id, st === "affected"); }
    for (const id of company_code_ids || []) { states.set(`code:${id}`, st); styleCode(id); }
  }

  function clearStates() {
    const keys = [...states.keys()];
    states.clear();
    for (const key of keys) {
      const [kind, ...rest] = key.split(":");
      const id = rest.join(":");
      if (kind === "vendor") styleVendor(id);
      else if (kind === "link") styleLink(`L-${id}`);
      else if (kind === "group") styleGroup(id);
      else if (kind === "code") styleCode(id);
    }
    map.closePopup();
  }

  function focus({ lat, lon, zoom } = {}) {
    if (typeof lat !== "number" || typeof lon !== "number") return;
    const z = zoom ?? Math.max(map.getZoom(), 5);
    viewIntent = { kind: "view", target: [lat, lon], zoom: z };
    map.flyTo(freeCenter(lat, lon, z), z, { duration: prefersReducedMotion() ? 0 : 1.2 });
    settleAfterFly();
  }

  /** Re-measure after a layout change and keep the last requested view in sight. */
  function invalidate() {
    map.invalidateSize({ pan: false });
    reapply();
  }

  /** Fit the view to a set of entity ids (vendors, groups, company codes). */
  function fitIds(ids = []) {
    const pts = [];
    for (const id of ids) {
      const x = model.vendors.get(id) || model.groups.get(id) || model.companyCodes.get(id);
      if (x) pts.push([x.lat, x.lon]);
    }
    if (!pts.length) return;
    if (pts.length === 1) { focus({ lat: pts[0][0], lon: pts[0][1], zoom: 6 }); return; }
    viewIntent = { kind: "bounds", bounds: L.latLngBounds(pts).pad(0.25), maxZoom: 7 };
    map.flyToBounds(viewIntent.bounds, { ...fitPadding(), duration: prefersReducedMotion() ? 0 : 1.2, maxZoom: 7 });
    settleAfterFly();
  }

  return { ready: true, mark, clearStates, focus, fitIds, showNetwork, showWorld, invalidate };
}

// ---------------------------------------------------------------------------------------------

function makeTileLayer(L, kind) {
  if (kind === "carto") {
    return L.tileLayer(BASEMAP.carto.url.replace("{key}", encodeURIComponent(BASEMAP.cartoKey)), {
      attribution: BASEMAP.carto.attribution, maxZoom: 11, className: "tiles-carto", crossOrigin: false
    });
  }
  return L.tileLayer(BASEMAP.osm.url, { attribution: BASEMAP.osm.attribution, maxZoom: 11, className: "tiles-osm-light" });
}

function addOfflineBasemap(L, map) {
  const data = window.OFFLINE_BASEMAP;
  if (!data) return;
  const renderer = L.canvas({ pane: "offline", padding: 0.5 });
  for (const rings of data.land) {
    L.polygon(rings, { renderer, pane: "offline", color: COLOR.coast, weight: 0.8, opacity: 1, fillColor: COLOR.land, fillOpacity: 1, interactive: false, smoothFactor: 1.5 }).addTo(map);
  }
  for (const line of data.borders) {
    L.polyline(line, { renderer, pane: "offline", color: COLOR.border, weight: 1, opacity: 1, interactive: false, smoothFactor: 1.5 }).addTo(map);
  }
}

function buildLegend(map, layers) {
  const toggle = (label, layer, on) => {
    const btn = h("button", { class: "legend-toggle", type: "button", "aria-pressed": on ? "true" : "false" },
      h("span", { class: "box" }, icon("check", 14)), label);
    btn.addEventListener("click", () => {
      const now = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", String(now));
      if (now) layer.addTo(map); else map.removeLayer(layer);
    });
    return btn;
  };
  const dot = (fill, stroke, label) => h("div", { class: "legend-row" }, h("span", { class: "legend-swatch-dot", style: { background: fill, borderColor: stroke } }), label);
  const line = (cls, color, label) => h("div", { class: "legend-row" }, h("span", { class: `legend-swatch-line ${cls}`, style: { borderTopColor: color } }), label);
  const legend = h("section", { class: "legend", "aria-label": "Map legend", dataset: { collapsed: "false" } });
  const collapseBtn = h("button", { class: "btn btn-ghost btn-icon", type: "button", "aria-label": "Collapse legend", "aria-expanded": "true", title: "Collapse legend" }, icon("chevronDown", 18));
  const setCollapsed = (collapsed) => {
    legend.dataset.collapsed = String(collapsed);
    collapseBtn.replaceChildren(icon(collapsed ? "chevronUp" : "chevronDown", 18));
    collapseBtn.setAttribute("aria-expanded", String(!collapsed));
    collapseBtn.setAttribute("aria-label", collapsed ? "Expand legend" : "Collapse legend");
    collapseBtn.title = collapsed ? "Expand legend" : "Collapse legend";
    // The map keeps its subject clear of the legend's new size (set by createMap).
    legend.onToggle?.();
  };
  let userChoice = false;
  collapseBtn.addEventListener("click", () => {
    userChoice = true;
    setCollapsed(legend.dataset.collapsed !== "true");
  });
  // While the presenter has not chosen, the legend folds away when the map gets short (drawer open).
  legend.fitToHeight = (height) => {
    if (userChoice) return;
    const collapse = height < 560;
    if (collapse !== (legend.dataset.collapsed === "true")) setCollapsed(collapse);
  };
  legend.append(
    h("div", { class: "legend-head" }, h("strong", {}, "Legend"), collapseBtn),
    h("div", { class: "legend-body" },
      h("div", { class: "legend-group" }, h("h4", {}, "Vendor accounts"),
        dot(BAND[1], BAND_LINE[1], "Over €10M last year"), dot(BAND[2], BAND_LINE[2], "€2M to €10M"), dot(BAND[3], BAND_LINE[3], "Under €2M")),
      h("div", { class: "legend-group" }, h("h4", {}, "Status"),
        line("", COLOR.affected, "Affected"), line("", COLOR.at_risk, "At risk"), line("", COLOR.resolved, "Resolved or recovered")),
      h("div", { class: "legend-group" }, h("h4", {}, "Register links"),
        line("dashed", COLOR.node, "Acquired company"), line("", COLOR.node, "Subsidiary or parent")),
      h("div", { class: "legend-group" },
        toggle("Billing links", layers.billing, true),
        toggle("Register links", layers.links, true),
        toggle("Accounts under €2M", layers.small, true))
    )
  );
  return legend;
}

/** A line between two points; long ones follow the great circle so they arc across the Atlantic. */
function curve(a, b) {
  return distKm(a, b) > 1500 ? greatCircle(a, b, 48) : [a, b];
}

/** Points along the great circle between two [lat, lon] points. */
function greatCircle(a, b, n = 40) {
  const rad = Math.PI / 180;
  const [lat1, lon1] = [a[0] * rad, a[1] * rad];
  const [lat2, lon2] = [b[0] * rad, b[1] * rad];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2));
  if (d < 1e-6) return [a, b];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    pts.push([Math.atan2(z, Math.sqrt(x * x + y * y)) / rad, Math.atan2(y, x) / rad]);
  }
  return pts;
}

function fallbackMap(container, message) {
  container.appendChild(h("div", { class: "map-fallback" }, h("div", {}, icon("alert", 28), h("p", {}, message))));
  const noop = () => {};
  return { ready: false, mark: noop, clearStates: noop, focus: noop, fitIds: noop, showNetwork: noop, showWorld: noop, invalidate: noop };
}
