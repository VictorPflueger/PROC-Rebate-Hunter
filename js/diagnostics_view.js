// Diagnostics dialog: self-tests every external endpoint from this browser and shows the
// synthetic company's integrity checks. Failures are remembered so tools fall back to web search.

import { h, clear } from "./dom.js";
import { icon } from "./icons.js";
import { openModal } from "./modal.js";
import { TESTS, runAll, runTest, memory } from "./diagnostics.js";
import { probeWebSearch } from "./anthropic.js";
import { getKey } from "./keystore.js";
import { APP, FX_USD_EUR, MODELS } from "./config.js";
import { usageCostUsd } from "./cost.js";

const STATUS_TEXT = { pass: "Pass", fail: "Fail", warn: "Check", skip: "Skipped", running: "Testing", idle: "Not run" };
const STATUS_ICON = { pass: "check", fail: "x", warn: "alert", skip: "info", idle: "info" };
// Each status is a Vici tag in its tone, with its icon and its word; skipped and not run are plain.
const STATUS_TAG = { pass: "vc-tag--success", fail: "vc-tag--danger", warn: "vc-tag--warning", running: "vc-tag--info", skip: "", idle: "" };

export function openDiagnostics({ onWebSearchResult, onCost } = {}) {
  const rows = new Map();
  const remembered = memory();
  const tbody = h("tbody");
  for (const t of TESTS) {
    const statusCell = h("td", { class: "status" });
    const msCell = h("td", { class: "ms vc-tabular" }, "");
    const detailCell = h("td", { class: "detail" }, t.purpose);
    tbody.appendChild(h("tr", {},
      h("td", {}, h("strong", {}, t.label), h("span", { class: "host" }, t.host)),
      statusCell, msCell, detailCell));
    rows.set(t.id, { statusCell, msCell, detailCell });
    const prev = remembered[t.id];
    setRow(t.id, prev ? { status: prev.status, detail: `${prev.detail} (earlier this session)` } : { status: "idle" });
  }

  const worldList = h("ul", { class: "world-checks" });
  const wsResult = h("p", { class: "detail", role: "status" }, "");
  const wsBtn = h("button", { class: "vc-button vc-button--outline button-compact", type: "button" }, icon("globe", 16), "Test web search on my key");
  wsBtn.addEventListener("click", async () => {
    if (wsBtn.getAttribute("aria-disabled") === "true") return;
    const key = getKey();
    if (!key) { wsResult.textContent = "Add your API key first (choose Live agent in Start agent)."; return; }
    wsBtn.setAttribute("aria-disabled", "true");
    wsResult.replaceChildren(h("span", { class: "vc-spinner vc-spinner--sm", "aria-hidden": "true" }), " Testing…");
    const r = await probeWebSearch(key);
    wsBtn.setAttribute("aria-disabled", "false");
    wsResult.textContent = r.available === true ? `Available. ${r.detail}` : r.available === false ? r.detail : `Inconclusive: ${r.detail}`;
    onWebSearchResult?.(r.available);
    if (r.usage) onCost?.(estimateHaikuCostEur(r.usage));
  });

  function setRow(id, r) {
    const row = rows.get(id);
    if (!row) return;
    const s = r.status || "idle";
    clear(row.statusCell).appendChild(h("span", { class: ["vc-tag", STATUS_TAG[s] || "", "diag-status"], dataset: { s } },
      s === "running" ? h("span", { class: "vc-spinner vc-spinner--sm", "aria-hidden": "true" }) : icon(STATUS_ICON[s] || "info", 16), STATUS_TEXT[s] || s));
    row.msCell.textContent = r.ms ? `${r.ms} ms` : "";
    if (r.detail) row.detailCell.textContent = r.detail;
    if (id === "world" && r.checks) {
      clear(worldList);
      for (const c of r.checks) {
        const s = c.ok ? "pass" : "fail";
        worldList.appendChild(h("li", { dataset: { ok: String(!!c.ok) } },
          h("span", { class: ["vc-tag", STATUS_TAG[s], "world-mark"] }, icon(STATUS_ICON[s], 14), STATUS_TEXT[s]),
          h("span", {}, `${c.name}${c.detail ? ` — ${c.detail}` : ""}`)));
      }
    }
  }

  const runBtn = h("button", { class: "vc-button", type: "button", autofocus: true }, icon("pulse", 18), "Run all tests");
  runBtn.addEventListener("click", async () => {
    if (runBtn.getAttribute("aria-disabled") === "true") return;
    runBtn.setAttribute("aria-disabled", "true");
    await runAll(setRow);
    runBtn.setAttribute("aria-disabled", "false");
  });

  const modal = openModal({
    title: "Diagnostics",
    intro: "Tests every external service from this browser. Failed open-data services are remembered for this session: the agent then skips them and verifies through web search instead.",
    size: "wide",
    body: [
      h("div", { class: "vc-table-wrap diag-wrap" },
        h("table", { class: "vc-table diag-table" },
          h("thead", {}, h("tr", {}, h("th", {}, "Service"), h("th", {}, "Status"), h("th", {}, "Time"), h("th", {}, "Details"))),
          tbody)),
      h("div", { class: "diag-section" },
        h("h3", {}, "Web search on your key (optional, ≈ €0.0001)"),
        h("p", {}, `Organisation admins can disable Claude's web search. This sends one tiny request on Haiku to find out. If it is disabled, ${APP.name} uses the open-data APIs (GLEIF, Wikidata, ECB) and scenario mode instead.`),
        wsBtn, wsResult),
      h("div", { class: "diag-section" },
        h("h3", {}, "World data integrity"),
        h("p", {}, "Checks run locally on the synthetic company: ledger totals, agreement and register consistency, the look-alike pair, scenario coverage, the reference cases and the simulation scripts."),
        worldList)
    ],
    footer: [
      h("span", { class: "dialog-note" }, `${APP.name} ${APP.version}. Run this on the presentation laptop and network before going on stage.`),
      runBtn
    ]
  });

  // Integrity check is local and instant: show it straight away.
  runTest("world").then((r) => setRow("world", r));
  runTest("privacy").then((r) => setRow("privacy", r));
  return modal;
}

/** The probe's cost with the same price table as the cost meter (cache and search included). */
function estimateHaikuCostEur(usage) {
  const probe = MODELS.find((m) => m.probe) || MODELS[0];
  return usageCostUsd(probe.id, usage) * FX_USD_EUR;
}
