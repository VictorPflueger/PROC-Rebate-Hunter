// The live agent against a scripted stand-in for the Anthropic Messages API (lib/fake-claude.mjs).
// The fake streams realistic SSE and checks every request against the protocol rules in
// TECH_NOTES §3: assistant turns echoed unchanged with signatures, every tool_use answered, headers.
// The open-data APIs (GLEIF, Wikidata, Frankfurter) answer from fixtures in the shape of the real
// services, so the browser-side parsers and the page's connection policy are exercised too.
//   full      Cisco end to end: parallel lookups, pause_turn, a 529 retry, GLEIF parent and a
//             404-as-answer, a verified alert from two sources and two kinds of evidence, first
//             estimate then the verified figure, rejection then approval, max_tokens retry, a draft
//             refused by the figure audit and corrected, report, audit, cost maths, Save run as
//             simulation and replay of the recording
//   nows      web search disabled for the organisation → fallback and nudge; the Live sweep stays on
//   opendata  GLEIF answers 503 → console note, web-search fallback, and the next GLEIF call is
//             skipped by the data-source memory
//   race      a second decision while the model still answers the first; a posting with the mock
//             line; the recording branches correctly
//   abort     Abort while a model call is in flight: nothing appears afterwards
//   badkey    the key is rejected mid-run (401) → removed from the tab
//   scan      Live sweep with nothing material → honest end; Wikidata, ECB and GLEIF search parsed
//   guards    a web search in a response that breaks off does not count; a verified alert on the
//             register alone is refused; a decision on an older set of options is ignored; a posting
//             without a set-off, a German-format wrong amount and a contradicting outcome are refused
// Usage: node tests/live.mjs [case…]
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { createFakeClaude } from "./lib/fake-claude.mjs";
import { openDataFixture as openData, LEI, WD } from "./lib/fixtures.mjs";
import { APP_ROOT, outDir, wanted, launchBrowser, serveStatic, fulfilLeaflet, CORS, MOCK_KEY, NETWORK_NOISE, SKIP_INTRO, KEYS } from "./lib/harness.mjs";

const ROOT = APP_ROOT;
const OUT = await outDir("live");
const { base: BASE, close } = await serveStatic(ROOT, 8767);
const browser = await launchBrowser();
const REF = await loadRef();
const results = [];
const run = wanted;
const KEY = MOCK_KEY;

async function loadRef() {
  const src = await readFile(path.join(ROOT, "data/reference_cases.js"), "utf8");
  const sandbox = { window: {} };
  new Function("window", src)(sandbox.window);
  return sandbox.window.REFERENCE_CASES;
}

const served = new Map(); // extra same-origin files for a test (e.g. a recorded simulation script)
async function newPage(fake, { models = "ok", failHosts = [] } = {}) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true });
  await context.addInitScript(SKIP_INTRO);
  await context.route(/^http:\/\/127\.0\.0\.1:8767\/test\//, (route) => {
    const p = new URL(route.request().url()).pathname;
    if (served.has(p)) return route.fulfill({ status: 200, headers: { "content-type": "text/javascript; charset=utf-8" }, body: served.get(p) });
    return route.fulfill({ status: 404, body: "" });
  });
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const log = { pageErrors: [], consoleErrors: [], openData: [] };
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (await fulfilLeaflet(route)) return;
    if (u.host === "api.anthropic.com") {
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...CORS, "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST" } });
      if (u.pathname === "/v1/models") {
        if (models === "reject") return route.fulfill({ status: 401, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }) });
        return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ data: [{ id: "claude-sonnet-5-5" }, { id: "claude-haiku-5-5" }, { id: "claude-opus-5-5" }] }) });
      }
      if (u.pathname === "/v1/messages") {
        const out = fake.handle(req.postData() || "{}", req.headers());
        if (out.delayMs) await new Promise((r) => setTimeout(r, out.delayMs));
        return route.fulfill({ status: out.status, headers: { ...CORS, ...out.headers }, body: out.body }).catch(() => {});
      }
    }
    if (failHosts.includes(u.host)) {
      log.openData.push(`503 ${u.host}${u.pathname}`);
      return route.fulfill({ status: 503, headers: { ...CORS, "content-type": "text/plain" }, body: "Service unavailable (test)" });
    }
    const fixture = openData(req.url());
    if (fixture) {
      log.openData.push(`${fixture.status} ${u.host}${u.pathname}`);
      return route.fulfill({ status: fixture.status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(fixture.body) });
    }
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => log.pageErrors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) log.consoleErrors.push(m.text()); });
  return { context, page, log };
}

async function startLive(page, { scan = false } = {}) {
  await page.goto(BASE);
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  if (scan) await page.click("#btn-scan");
  else {
    await page.click("#btn-start");
    await page.waitForSelector(".mode-card");
    await page.click('.mode-card[data-mode="live"] .mode-cta button');
  }
  await page.waitForSelector("#api-key-input");
  await page.fill("#api-key-input", KEY);
  await page.click('button:has-text("Check key and continue")');
}

async function finish(name, t, fake, checks) {
  const csp = await t.page.evaluate(() => window.__csp || []).catch(() => []);
  results.push({ name, checks, violations: fake?.violations || [], remainingScript: fake?.remaining?.() ?? null, pageErrors: t.log.pageErrors, consoleErrors: t.log.consoleErrors.filter((x) => !x.includes("[Rebate Hunter] live run failed")), csp });
  await t.context.close();
}

const usage = (o = {}) => ({ input_tokens: 600, cache_creation_input_tokens: 0, cache_read_input_tokens: 9000, output_tokens: 420, ...o });
const lastResults = (req) => {
  const last = req.messages[req.messages.length - 1];
  return Array.isArray(last?.content) ? last.content.filter((b) => b.type === "tool_result").map((b) => ({ isError: b.is_error === true, raw: b.content, json: safeJson(b.content) })) : [];
};
const safeJson = (s) => { try { return JSON.parse(s); } catch { return null; } };
const consoleHas = (page, re) => page.evaluate((src) => [...document.querySelectorAll("#console .entry")].some((e) => new RegExp(src).test(e.textContent)), re.source);

const CISCO_OPTIONS = [
  { variant_id: "V1", title: "Claim now and link the three accounts", description: "Send Cisco a written claim for the agreement year and set the Cisco group key on Meraki, Acacia and Splunk.", residual_risk: "Cisco may ask for invoice evidence per account; the credit note takes about 45 days." },
  { variant_id: "V2", title: "Set off against open Cisco invoices", description: "Notify Cisco and deduct the rebate from open Cisco invoices in the next payment run; link the accounts as in option A.", residual_risk: "A set-off before Cisco agrees can strain the relationship." },
  { variant_id: "V3", title: "Claim the agreement year only", description: "Send the written claim but leave the vendor master as it is.", residual_risk: "Next year's rebate slips in exactly the same way." }
];
const CLAIM_BODY = "Dear Global Rebates team,\n\nUnder § 4.2 of our volume rebate agreement, Cisco credits 2 % of all net purchases of an agreement year once GlobalCorp's purchases from Cisco Systems, Inc. and its Affiliates reach €50.0m.\n\nIn the last agreement year our purchases from Cisco and its Affiliates, including Meraki, Acacia and Splunk, totalled €52,400,000. We claim a rebate of €1,048,000 and ask for a credit note.\n\nKind regards\nProcurement Controlling, GlobalCorp SE";

// ---- case: full Cisco run --------------------------------------------------------------------------
if (run("full")) {
  const ref = REF["SC-CISCO-MA"];
  const script = [
    { usage: usage({ input_tokens: 3400, cache_creation_input_tokens: 6100, cache_read_input_tokens: 0, output_tokens: 380 }), stop: "tool_use", blocks: [
      { type: "thinking", thinking: "The tip is unverified. First see what the Cisco agreement counts and which accounts look like Cisco companies; both lookups are independent.", signature: "SIG-THINK-1==" },
      { type: "text", text: "Signal received: a category manager says Meraki and Acacia invoices sit on their own vendor accounts and never count towards the Cisco volume rebate. I read the agreement and look for the accounts in parallel." },
      { type: "tool_use", id: "toolu_01", name: "erp_get_agreement", input: { agreement_id: "RA-CISCO" } },
      { type: "tool_use", id: "toolu_02", name: "erp_list_vendors", input: { query: "Cisco, Meraki, Acacia" } }
    ], expect: (req, { check }) => {
      check(req.messages.length === 1 && typeof req.messages[0].content === "string" && req.messages[0].content.includes("Meraki and Acacia invoices"), "opening message must carry the seed");
      check(req.thinking?.type === "adaptive" && req.thinking?.display === "summarized", "thinking params");
      check(req.output_config?.effort === "medium", "effort");
      check(req.cache_control?.type === "ephemeral", "cache_control");
      check(req.tools[0].type === "web_search_20250305" && req.tools[0].max_uses === 5, "web search tool first");
      check(req.tools.length === 21, `20 tools plus web search (got ${req.tools.length})`);
    } },
    { usage: usage({ web_search_requests: 1 }), stop: "pause_turn", blocks: [
      { type: "text", text: "Hypothesis: the tip is right. Meraki Cloud Networks (10003) and Acacia Communications Opto (10004) have no Cisco group key, so the year-end report never counted their spend." },
      { type: "server_tool_use", id: "srvtoolu_01", name: "web_search", input: { query: "Cisco completes acquisition Acacia Communications Meraki" } },
      { type: "web_search_tool_result", tool_use_id: "srvtoolu_01", content: [
        { type: "web_search_result", url: "https://newsroom.example.com/cisco-acacia", title: "Cisco completes acquisition of Acacia Communications", encrypted_content: "ENC1", page_age: "1 March 2021" },
        { type: "web_search_result", url: "https://newsroom.example.com/cisco-meraki", title: "Cisco completes acquisition of Meraki", encrypted_content: "ENC2", page_age: "20 December 2012" }
      ] },
      { type: "text", text: "Check: both deals completed years before this agreement year. Next: who else belongs to Cisco according to the register?" }
    ], expect: (req, { check }) => {
      const r = lastResults(req);
      check(r.length === 2, "two tool results expected");
      check(r[0]?.json?.id === "RA-CISCO" && r[0]?.json?.tiers?.[0]?.from_eur === 50000000, `agreement returned (got ${String(r[0]?.raw).slice(0, 120)})`);
      const ids = (r[1]?.json?.vendors || []).map((v) => v.id);
      check(ids.includes("10003") && ids.includes("10004"), `vendor search finds Meraki and Acacia (got ${ids.join(",")})`);
    } },
    { usage: usage({ web_search_requests: 1 }), stop: "tool_use", blocks: [
      { type: "server_tool_use", id: "srvtoolu_02", name: "web_search", input: { query: "Cisco completes acquisition of Splunk" } },
      { type: "web_search_tool_result", tool_use_id: "srvtoolu_02", content: [
        { type: "web_search_result", url: "https://newsroom.example.com/cisco-splunk", title: "Cisco completes acquisition of Splunk", encrypted_content: "ENC3", page_age: "18 March 2024" }
      ] },
      { type: "text", text: "Confirmed: Cisco's announcements show all three deals completed. I check the register and GLEIF in parallel." },
      { type: "tool_use", id: "toolu_03", name: "erp_family_tree", input: { vendor_id: "10001" } },
      { type: "tool_use", id: "toolu_04", name: "open_gleif_parent", input: { lei: LEI.splunk } },
      { type: "tool_use", id: "toolu_05", name: "open_gleif_parent", input: { lei: LEI.acacia } }
    ], expect: (req, { check }) => { const last = req.messages[req.messages.length - 1]; check(last.role === "assistant", "pause_turn must be resent with the assistant turn last"); } },
    { error: { status: 529, type: "overloaded_error", message: "Overloaded" } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Revised: two acquired accounts → three. The register lists Splunk Software EMEA (10005) as a Cisco company as well, and GLEIF shows Splunk LLC ultimately consolidated by Cisco Systems, Inc. since 18 March 2024." },
      { type: "tool_use", id: "toolu_06", name: "ui_report_alert", input: {
        title: "Cisco rebate missed: three acquired companies invoiced outside the agreement", severity: "high", basis: "verified",
        summary: "Meraki, Acacia and Splunk invoice GlobalCorp on their own vendor accounts, without the Cisco group key. Counted with the two linked accounts, the Cisco group may cross the threshold of the 2 % volume rebate.",
        sources: [{ title: "Cisco completes acquisition of Splunk", url: "https://newsroom.example.com/cisco-splunk" }, { title: "GLEIF level-2 record of Splunk LLC", url: "https://search.gleif.org/#/record/549300XGDSGBP6UEI867" }],
        vendor_ids: ["10003", "10004", "10005"], group_ids: ["G-CISCO"]
      } },
      { type: "tool_use", id: "toolu_07", name: "sim_rebate", input: ref.hypothesis }
    ], expect: (req, { check }) => {
      const r = lastResults(req);
      check(r.length === 3 && r.every((x) => !x.isError), `three successful lookups (got ${r.map((x) => x.isError).join(",")})`);
      check(r[0]?.json?.members?.length === 5, "register lists five Cisco accounts");
      const sp = r[1]?.json;
      check(sp?.ultimate_parent?.lei === LEI.cisco && sp?.relationship?.period_start === "2024-03-18" && /not necessarily the acquisition date/.test(sp?.relationship?.note || "") && /10005/.test(sp?.entity?.globalcorp || ""), `GLEIF parent parsed (got ${JSON.stringify(sp).slice(0, 220)})`);
      const ac = r[2]?.json;
      check(ac?.ultimate_parent === null && /No ultimate parent/.test(ac?.note || "") && ac?.entity?.registration_status === "LAPSED", `GLEIF 404 is an answer, not a failure (got ${JSON.stringify(ac).slice(0, 220)})`);
    } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Finding: Meraki and Acacia alone keep the group below €50m in the agreement year, so the first estimate finds nothing owed. With Splunk the picture changes; I quantify the verified group." },
      { type: "tool_use", id: "toolu_08", name: "sim_rebate", input: ref.finding }
    ], expect: (req, { check }) => {
      const r = lastResults(req);
      const kinds = r[0]?.json?.evidence_kinds || [];
      check(r[0]?.json?.ok === true && ["contract", "register", "gleif", "web"].every((k) => kinds.includes(k)), `alert accepted with four kinds of evidence (got ${JSON.stringify(r[0]?.json)})`);
      check(r[1]?.json?.ok === true && r[1]?.json?.baseline?.rebate_at_risk_eur === 0, "first estimate: nothing owed");
    } },
    { usage: usage({ output_tokens: 900 }), stop: "tool_use", blocks: [
      { type: "text", text: "Recommendation: option A. It recovers the full amount for the lowest expected total; option B brings the cash in sooner by set-off." },
      { type: "tool_use", id: "toolu_09", name: "ui_propose_options", input: {
        recommended_variant_id: "V1",
        baseline_description: "Do nothing: the agreement-year claim expires, and the running year slips the same way.",
        options: CISCO_OPTIONS
      } }
    ], expect: (req, { check }) => {
      const r = lastResults(req)[0]?.json;
      check(r?.ok === true && r?.variants?.length === 3 && r?.basis === "verified", "sim_rebate with three variants on verified members");
      check(r?.baseline?.rebate_at_risk_eur === 2137920 && r?.years?.find((y) => y.year === "AY")?.owed_eur === 1048000 && !("value_at_risk_eur" in (r?.baseline || {})), `engine figures under the model-facing names (got ${JSON.stringify(r?.baseline).slice(0, 120)})`);
      check(!JSON.stringify(r).includes("purchase_orders"), "orders are not sent to the model");
    } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Option B rejected. Options A and C remain open." },
      { type: "tool_use", id: "toolu_10", name: "ui_await_decision", input: {} }
    ], expect: (req, { check }) => { const r = lastResults(req)[0]?.json; check(r?.decision === "rejected" && r?.option_id === "V2" && r?.refer_to_it_as === "option B", `rejection returned as tool result (got ${JSON.stringify(r).slice(0, 160)})`); } },
    { usage: usage({ output_tokens: 16000 }), stop: "max_tokens", cut: 1, discard: true, blocks: [
      { type: "text", text: "Option A approved. Drafting the claim letter." },
      { type: "tool_use", id: "toolu_11x", name: "ui_draft_action", input: { type: "email", recipient: "Cisco Systems, Inc., Global Rebates team", subject: "Volume rebate claim", body: "Dear …" } }
    ], expect: (req, { check }) => { const r = lastResults(req)[0]?.json; check(r?.decision === "approved" && r?.option_id === "V1" && r?.figures?.still_lost === "€0", `approval returned as tool result (got ${JSON.stringify(r).slice(0, 200)})`); } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Option A approved. Drafting the claim letter to Cisco and the vendor-master change; each draft waits for your approval in the Outbox." },
      { type: "tool_use", id: "toolu_11", name: "ui_draft_action", input: { type: "email", recipient: "Cisco Systems, Inc., Global Rebates team", subject: "Volume rebate claim for the agreement year: €1,084,500", body: CLAIM_BODY.replace("€1,048,000", "€1,084,500") } },
      { type: "tool_use", id: "toolu_12", name: "ui_mark_map", input: { vendor_ids: ["10003", "10004", "10005"], link_ids: ["L-10003", "L-10004", "L-10005"], state: "resolved" } }
    ], expect: (req, { check }) => { check(req.max_tokens === 24000, `max_tokens raised after cut-off (got ${req.max_tokens})`); } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Correction: the claim amount is the engine's figure, €1,048,000, not the one I typed." },
      { type: "tool_use", id: "toolu_13", name: "ui_draft_action", input: { type: "email", recipient: "Cisco Systems, Inc., Global Rebates team", subject: "Volume rebate claim for the agreement year: €1,048,000", body: CLAIM_BODY } },
      { type: "tool_use", id: "toolu_14", name: "ui_draft_action", input: { type: "memo", recipient: "Master Data Management, GlobalCorp SE", subject: "Set group key CISCO on vendor accounts 10003, 10004 and 10005", body: "Request: maintain the group key CISCO (vendor master field KONZS) on these accounts and link them to agreement RA-CISCO:\n- 10003 Meraki Cloud Networks Ltd.\n- 10004 Acacia Communications Opto\n- 10005 Splunk Software EMEA\n\nWhy: the subscription register lists all three as Cisco companies; without the link the year-end report misses their spend." } }
    ], expect: (req, { check }) => {
      const r = lastResults(req);
      check(r[0]?.isError && /1,084,500/.test(r[0]?.json?.error || "") && /match no figure this text may quote, in its currency/.test(r[0]?.json?.error || ""), `figure audit refuses the typed amount (got ${String(r[0]?.raw).slice(0, 200)})`);
      check(r[1]?.json?.ok === true && r[1]?.json?.marked === 6, `map marked (got ${String(r[1]?.raw).slice(0, 120)})`);
    } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "tool_use", id: "toolu_15", name: "ui_await_approvals", input: {} }
    ], expect: (req, { check }) => { const r = lastResults(req); check(r.length === 2 && r.every((x) => x.json?.status === "pending_approval"), "both corrected drafts queued"); } },
    { usage: usage({ output_tokens: 700 }), stop: "tool_use", blocks: [
      { type: "tool_use", id: "toolu_16", name: "ui_final_report", input: { outcome: "response_decided", markdown: "## Cisco: rebate decision\n\n**What we found.** Meraki, Acacia and Splunk invoice GlobalCorp on their own vendor accounts without the Cisco group key. The register lists all three as Cisco companies, confirmed by GLEIF and Cisco's announcements.\n\n**If we do nothing.** €2.14M lost: the agreement-year claim of €1,048,000 expires first.\n\n**Decision.** Option A approved: claim the agreement year and link the three accounts. Response cost €17,100; nothing left to lose.\n\n**Actions.** The claim letter is approved for sending by a human; the vendor-master change was rejected.\n\n*Live agent run. GlobalCorp SE and its vendor accounts are fictional; the corporate groups are real; figures come from the deterministic rebate engine.*" } }
    ], expect: (req, { check }) => { const r = lastResults(req)[0]?.json; check(r?.approved === 1 && r?.rejected === 1, `draft decisions returned (got ${JSON.stringify({ a: r?.approved, r: r?.rejected })})`); } },
    { usage: usage({ output_tokens: 40 }), stop: "end_turn", blocks: [
      { type: "text", text: "The management summary is published. One draft was approved, one rejected; nothing was sent." }
    ], expect: (req, { check }) => { const r = lastResults(req)[0]?.json; check(r?.published === true, `report published (got ${JSON.stringify(r).slice(0, 160)})`); } }
  ];
  const fake = createFakeClaude(script);
  const t = await newPage(fake);
  const { page } = t;
  const checks = {};
  try {
    await startLive(page);
    await page.waitForSelector("#api-key-input", { state: "detached", timeout: 8000 });
    checks.badge = (await page.textContent("#mode-badge")).trim();
    await page.waitForSelector(".alert-card", { timeout: 20000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "L1-live-alert.png") });
    checks.alert = await page.$eval(".alert-card", (e) => e.innerText.replace(/\s+/g, " ").slice(0, 200));
    await page.waitForSelector('.option-card[data-recommended="true"] .btn-approve', { state: "visible", timeout: 30000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "L2-live-options.png") });
    checks.optionTotals = await page.$$eval(".option-card", (els) => els.map((e) => e.querySelector(".option-total .value")?.textContent));
    checks.kpiBefore = await page.$eval("#kpi-var-value", (e) => `${e.closest(".kpi").dataset.tone}|${e.textContent}`);
    // Reject option B first, then approve the recommended option A.
    await page.click('.option-card[aria-label^="Option B:"] .btn-reject');
    await page.waitForFunction(() => document.querySelector('.option-card[aria-label^="Option B:"]')?.dataset.status === "rejected", null, { timeout: 5000 });
    await page.waitForFunction(() => [...document.querySelectorAll("#console .entry")].some((e) => /Option B rejected/.test(e.textContent)), null, { timeout: 15000 });
    await page.click('.option-card[data-recommended="true"] .btn-approve');
    await page.waitForTimeout(400);
    checks.payoffVar = await page.$eval("#kpi-var-value", (e) => `${e.closest(".kpi").dataset.tone}|${e.textContent}|${e.nextElementSibling.textContent}`);
    checks.payoffDeadline = await page.$eval("#kpi-deadline-value", (e) => `${e.closest(".kpi").dataset.tone}|${e.textContent}|${e.nextElementSibling.textContent}`);
    await page.waitForSelector('button:has-text("Approve all")', { state: "visible", timeout: 30000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, "L3-live-outbox.png") });
    checks.figureRefusal = await page.evaluate(() => [...document.querySelectorAll('#console .entry[data-guard="ui_draft_action"]')].map((e) => e.innerText.replace(/\s+/g, " ")).join(" | ").slice(0, 240));
    checks.drafts = await page.$$eval(".action-card", (els) => els.length);
    checks.draftFooter = await page.$$eval(".action-body", (els) => els.length > 0 && els.every((e) => e.textContent.includes("Requires human approval before sending")));
    checks.draftTypedAmount = await page.$$eval(".action-body", (els) => els.some((e) => e.textContent.includes("1,084,500")));
    checks.mapResolved = await page.$$eval("path.state-resolved", (els) => els.length);
    // Approve the claim letter, reject the vendor-master change.
    const approveButtons = await page.$$(".action-card .action-buttons .btn-approve");
    await approveButtons[0].click();
    await page.waitForTimeout(200);
    const rejectButtons = await page.$$(".action-card .action-buttons .btn-reject");
    await rejectButtons[rejectButtons.length - 1].click();
    await page.waitForSelector('button:has-text("Open management summary")', { timeout: 30000 });
    await page.waitForFunction(() => /Done/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 15000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, "L4-live-done.png") });
    checks.status = (await page.textContent(".status-pill .text")).trim();
    checks.costKpi = (await page.textContent("#kpi-cost-value")).trim();
    checks.costSub = (await page.textContent("#kpi-cost-sub")).trim();
    checks.varKpi = (await page.textContent("#kpi-var-value")).trim();
    checks.retryNotice = await consoleHas(page, /Retrying in/);
    checks.reasoning = await page.$$eval(".reasoning-text", (els) => els.map((e) => e.textContent).join(" | ").slice(0, 120));
    checks.webSources = await page.$$eval(".result-sources a", (els) => els.map((e) => e.href));
    checks.consoleWatermarkHidden = !(await page.isVisible(".sim-watermark"));
    checks.runFacts = await page.evaluate(() => [...document.querySelectorAll("#console .entry")].map((e) => e.innerText).slice(-1)[0]?.replace(/\s+/g, " ").slice(0, 300));
    checks.openData = t.log.openData.slice();
    await page.click("#tab-audit");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click('button:has-text("Export JSON")')]);
    const file = path.join(OUT, download.suggestedFilename());
    await download.saveAs(file);
    const audit = JSON.parse(await readFile(file, "utf8"));
    checks.auditFile = download.suggestedFilename();
    checks.auditMode = audit.mode;
    checks.auditExchanges = audit.api_exchanges.length;
    checks.auditFirstHasSystem = typeof audit.api_exchanges[0]?.request?.system === "string";
    checks.auditNoKey = !JSON.stringify(audit).includes("MOCKKEY");
    checks.auditNoSignature = !JSON.stringify(audit).includes("SIG-THINK-1");
    checks.auditCostEur = audit.cost?.eur;
    // Expected cost from the script's usage (Sonnet prices, web search $10/1000, FX 0.894).
    let usd = 0;
    for (const s of script) {
      if (!s.usage) continue;
      const u = s.usage;
      usd += u.input_tokens * 2 / 1e6 + u.cache_creation_input_tokens * 2.5 / 1e6 + u.cache_read_input_tokens * 0.1 / 1e6 + u.output_tokens * 10 / 1e6 + (u.web_search_requests || 0) * 0.01;
    }
    checks.expectedCostEur = Math.round(usd * 0.894 * 10000) / 10000;
    checks.costMatches = Math.abs((audit.cost?.eur || 0) - usd * 0.894) < 1e-9;
    checks.modelCallRows = await page.$$eval('.audit-table tr[data-type="model_call"]', (els) => els.length);

    // ---- Save run as simulation, then replay it -------------------------------------------------
    const [simDl] = await Promise.all([page.waitForEvent("download"), page.click('#console button:has-text("Save run as simulation")')]);
    checks.simFile = simDl.suggestedFilename();
    const simText = await readFile(await simDl.path(), "utf8");
    await writeFile(path.join(OUT, simDl.suggestedFilename()), simText);
    checks.simNoKey = !simText.includes("MOCKKEY") && !simText.includes("SIG-THINK");
    checks.simHasRecordedSource = simText.includes('"source": "recorded"');
    checks.simReportRewritten = !simText.includes("*Live agent run.") && simText.includes("Recorded live run, replayed in Simulation mode");
    checks.simNoRefusedDraft = !simText.includes("1,084,500\\n") && !simText.includes('"subject": "Volume rebate claim for the agreement year: €1,084,500"');
    served.set("/test/recorded.js", simText);
    await page.addScriptTag({ url: "/test/recorded.js" });
    checks.simLoaded = await page.evaluate(() => window.SIM_RUNS?.["SC-CISCO-MA"]?.source);
    await page.click("#btn-reset");
    await page.click('button[aria-label="Replay speed ×4"]');
    await page.click("#btn-start");
    await page.waitForSelector(".mode-card");
    await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
    await page.waitForSelector('.option-card[data-recommended="true"] .btn-approve', { state: "visible", timeout: 60000 });
    checks.replayWatermark = (await page.textContent(".sim-watermark")).replace(/\s+/g, " ").trim();
    checks.replayBadge = (await page.textContent("#mode-badge")).trim();
    checks.replayOptions = await page.$$eval(".option-card", (els) => els.map((e) => `${e.querySelector(".option-letter")?.textContent}:${e.querySelector(".option-title")?.textContent}:${e.querySelector(".option-total .value")?.textContent}`));
    checks.replaySources = await page.$$eval(".result-sources a, .result-sources span", (els) => els.map((e) => e.textContent).slice(0, 3));
    await page.screenshot({ path: path.join(OUT, "L7-replay-options.png") });
    await page.click('.option-card[data-recommended="true"] .btn-approve');
    await page.waitForSelector('button:has-text("Approve all")', { state: "visible", timeout: 60000 });
    await page.waitForFunction(() => /Waiting for your approval of \d+ draft/.test(document.querySelector("#console").innerText), null, { timeout: 60000 });
    await page.click('button:has-text("Approve all")');
    await page.waitForFunction(() => /Done/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 60000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "L8-replay-done.png") });
    checks.replayReport = await page.$eval(".report-card", (e) => e.innerText.split("\n").filter(Boolean).slice(-2).join(" | "));
    checks.replayCost = (await page.textContent("#kpi-cost-sub")).trim();
    await page.click("#tab-audit").catch(() => {});
    const [rdl] = await Promise.all([page.waitForEvent("download"), page.click('button:has-text("Export JSON")')]);
    const raudit = JSON.parse(await readFile(await rdl.path(), "utf8"));
    checks.replayAudit = `${raudit.mode}|${raudit.run?.sim_source}|${raudit.mode_statement.slice(0, 50)}`;
    // a different decision than the recorded one ends gracefully
    await page.click("#btn-reset");
    await page.click("#btn-start");
    await page.waitForSelector(".mode-card");
    await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
    await page.waitForSelector('.option-card[data-recommended="true"] .btn-approve', { state: "visible", timeout: 60000 });
    await page.click('.option-card[aria-label^="Option C:"] .btn-approve');
    await page.waitForFunction(() => /Done/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 60000 });
    checks.replayOtherPath = await page.evaluate(() => [...document.querySelectorAll("#console .entry")].map((e) => e.innerText).find((x) => /only the path recorded/.test(x))?.replace(/\s+/g, " ").slice(0, 120) || null);
  } catch (e) {
    checks.FAILED = String(e.message).split("\n")[0];
    await page.screenshot({ path: path.join(OUT, "L-fail.png") });
    checks.consoleTail = await page.$$eval("#console .entry", (els) => els.slice(-6).map((e) => e.innerText.replace(/\s+/g, " ").slice(0, 240)));
  }
  await finish("live: full Cisco run (mock API)", t, fake, checks);
}

// ---- case: web search disabled for the organisation --------------------------------------------------
if (run("nows")) {
  const script = [
    { error: { status: 400, type: "invalid_request_error", message: "Web search is not enabled for this organization. An admin can enable it in the Claude Console." } },
    { usage: usage(), stop: "end_turn", blocks: [{ type: "text", text: "Not confirmed: without web search I can still read the register and GLEIF. Should I continue on that basis?" }],
      expect: (req, { check }) => { check(!req.tools.some((t) => t.type?.startsWith("web_search")), "web_search tool must be removed after the 400"); check(req.system.includes("Web search is switched off"), "system prompt must mention missing web search"); } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Continuing on my own: I record the tip as unverified and keep monitoring." },
      { type: "tool_use", id: "toolu_n1", name: "ui_final_report", input: { outcome: "monitoring", markdown: "## Cisco tip: monitoring\n\nThe tip could not be verified without web search in this run. No claim is proposed yet.\n\n*Live agent run.*" } }
    ], expect: (req, { check }) => { const last = req.messages[req.messages.length - 1]; check(last.role === "user" && typeof last.content === "string" && last.content.includes("Nobody can answer questions"), "nudge sent as a user turn after the early end_turn"); } },
    { usage: usage({ output_tokens: 20 }), stop: "end_turn", blocks: [{ type: "text", text: "Monitoring note published." }] }
  ];
  const fake = createFakeClaude(script);
  const t = await newPage(fake);
  const checks = {};
  try {
    await startLive(t.page);
    await t.page.waitForFunction(() => /Done/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 20000 });
    checks.banner = await t.page.evaluate(() => document.querySelector(".banner")?.innerText.replace(/\s+/g, " ").slice(0, 160) || null);
    checks.notice = await consoleHas(t.page, /Web search is switched off/);
    checks.nudgeNotice = await consoleHas(t.page, /asked it to continue/);
    checks.scanEnabled = await t.page.$eval("#btn-scan", (b) => b.getAttribute("aria-disabled"));
    await t.page.screenshot({ path: path.join(OUT, "L5-no-websearch.png") });
  } catch (e) { checks.FAILED = String(e.message).split("\n")[0]; }
  await finish("live: web search disabled → fallback", t, fake, checks);
}

// ---- case: an open-data API fails → console note, web-search fallback, source memory ------------------
if (run("opendata")) {
  const script = [
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Check: I ask GLEIF who consolidates Splunk LLC." },
      { type: "tool_use", id: "toolu_g1", name: "open_gleif_parent", input: { lei: LEI.splunk } }
    ] },
    { usage: usage({ web_search_requests: 1 }), stop: "tool_use", blocks: [
      { type: "text", text: "GLEIF is unreachable from this browser, so I use web search instead, and try a GLEIF name search once more." },
      { type: "server_tool_use", id: "srvtoolu_g1", name: "web_search", input: { query: "Splunk ultimate parent Cisco" } },
      { type: "web_search_tool_result", tool_use_id: "srvtoolu_g1", content: [{ type: "web_search_result", url: "https://newsroom.example.com/cisco-splunk", title: "Cisco completes acquisition of Splunk", encrypted_content: "E", page_age: "18 March 2024" }] },
      { type: "tool_use", id: "toolu_g2", name: "open_gleif_search", input: { name: "Splunk" } }
    ], expect: (req, { check }) => { const r = lastResults(req)[0]; check(r?.isError === true && r?.json?.fallback_hint === "use web_search" && /503/.test(r?.json?.error || ""), `GLEIF failure returned with fallback_hint (got ${String(r?.raw).slice(0, 160)})`); } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "tool_use", id: "toolu_g3", name: "ui_final_report", input: { outcome: "monitoring", markdown: "## Splunk check\n\nGLEIF failed in this browser; web search was used instead. Nothing is claimed in this run.\n\n*Live agent run.*" } }
    ], expect: (req, { check }) => { const r = lastResults(req)[0]; check(r?.isError === true && /failed earlier in this session/.test(r?.json?.error || "") && r?.json?.fallback_hint === "use web_search", `second GLEIF call skipped by the source memory (got ${String(r?.raw).slice(0, 200)})`); } },
    { usage: usage({ output_tokens: 20 }), stop: "end_turn", blocks: [{ type: "text", text: "Done." }] }
  ];
  const fake = createFakeClaude(script);
  const t = await newPage(fake, { failHosts: ["api.gleif.org"] });
  const checks = {};
  try {
    await startLive(t.page);
    await t.page.waitForFunction(() => /Done/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 20000 });
    checks.fallbackNotice = await t.page.evaluate(() => [...document.querySelectorAll("#console .entry")].map((e) => e.innerText).find((x) => /falls back to web search/.test(x))?.replace(/\s+/g, " ").slice(0, 160) || null);
    checks.toolError = await t.page.evaluate(() => [...document.querySelectorAll('.result-summary[data-ok="false"]')].map((e) => e.textContent).join(" | ").slice(0, 300));
    checks.gleifRequests = t.log.openData.filter((x) => x.includes("api.gleif.org")).length;
    await t.page.screenshot({ path: path.join(OUT, "L9-opendata-fallback.png") });
  } catch (e) { checks.FAILED = String(e.message).split("\n")[0]; }
  await finish("live: open-data failure → web-search fallback", t, fake, checks);
}

// ---- case: guardrails a live model can run into ------------------------------------------------------
// A web search in a response that breaks off does not count; a verified alert on the register alone is
// refused; a decision on an older set of options is ignored; a posting without a set-off, a German-format
// wrong amount and a summary outcome that contradicts the decision are refused.
if (run("guards")) {
  const ref = REF["SC-CISCO-MA"];
  const script = [
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Check: I read the Cisco agreement and the register." },
      { type: "tool_use", id: "toolu_q1", name: "erp_get_agreement", input: { agreement_id: "RA-CISCO" } },
      { type: "tool_use", id: "toolu_q2", name: "erp_family_tree", input: { vendor_id: "10001" } }
    ] },
    { usage: usage({ web_search_requests: 1 }), midError: { type: "overloaded_error" }, blocks: [
      { type: "text", text: "Check: I search for the Meraki acquisition before I raise the alert." },
      { type: "server_tool_use", id: "srvtoolu_q1", name: "web_search", input: { query: "Cisco completes acquisition of Meraki" } },
      { type: "web_search_tool_result", tool_use_id: "srvtoolu_q1", content: [{ type: "web_search_result", url: "https://newsroom.example.com/cisco-meraki", title: "Cisco completes acquisition of Meraki", encrypted_content: "EQ", page_age: "20 December 2012" }] }
    ] },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Finding: the register lists Meraki as a Cisco company." },
      { type: "tool_use", id: "toolu_q3", name: "ui_report_alert", input: { title: "Cisco rebate missed", severity: "high", basis: "verified", summary: "Meraki invoices outside the agreement.", sources: [{ title: "Subscription register" }, { title: "Cisco newsroom" }], vendor_ids: ["10003"], group_ids: ["G-CISCO"] } }
    ], expect: (req, { check }) => {
      const r = lastResults(req);
      check(r.length === 2 && r.every((x) => !x.isError), "the retried request carries the two lookups");
      check(!JSON.stringify(req.messages).includes("srvtoolu_q1"), "the broken-off response is not part of the conversation");
    } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Not confirmed: only the register supports it so far, so I raise it as a what-if and quantify." },
      { type: "tool_use", id: "toolu_q4", name: "ui_report_alert", input: { title: "Cisco rebate may be missed (what-if)", severity: "medium", basis: "what_if", summary: "If the register is right, Meraki counts towards the Cisco agreement.", vendor_ids: ["10003"], group_ids: ["G-CISCO"] } },
      { type: "tool_use", id: "toolu_q5", name: "sim_rebate", input: ref.finding }
    ], expect: (req, { check }) => {
      const r = lastResults(req)[0];
      check(r?.isError && /rests on the register alone/.test(r?.json?.error || ""), `verified alert refused: the web search was in a broken-off response (got ${String(r?.raw).slice(0, 200)})`);
    } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "tool_use", id: "toolu_q6", name: "ui_propose_options", input: { recommended_variant_id: "V1", baseline_description: "The agreement-year claim expires.", options: CISCO_OPTIONS } }
    ], expect: (req, { check }) => { const r = lastResults(req); check(r.length === 2 && r.every((x) => !x.isError), "what-if alert and engine accepted"); } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Option C rejected. I recalculate before you decide." },
      { type: "tool_use", id: "toolu_q7", name: "sim_rebate", input: ref.finding },
      { type: "tool_use", id: "toolu_q8", name: "ui_propose_options", input: { recommended_variant_id: "V2", baseline_description: "The agreement-year claim expires.", options: CISCO_OPTIONS } }
    ], expect: (req, { check }) => { const r = lastResults(req)[0]?.json; check(r?.decision === "rejected" && r?.option_id === "V3", "first decision: option C rejected"); } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "tool_use", id: "toolu_q9", name: "ui_draft_action", input: { type: "posting", recipient: "Accounts Payable, GlobalCorp SE", subject: "Set-off posting", body: "Amount: €1,048,000 credit against open invoices" } }
    ], expect: (req, { check }) => {
      const r = lastResults(req);
      const d = r[1]?.json;
      check(d?.decision === "approved" && d?.option_id === "V1", `the click on the new set counts, the stale one does not (got ${JSON.stringify(d).slice(0, 160)})`);
    } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "tool_use", id: "toolu_q10", name: "ui_draft_action", input: { type: "email", recipient: "Cisco Systems, Inc., Global Rebates team", subject: "Rebate claim", body: "Dear Global Rebates team,\n\nWir fordern 1.084.500,00 EUR.\n\nKind regards\nProcurement Controlling, GlobalCorp SE" } }
    ], expect: (req, { check }) => { const r = lastResults(req)[0]; check(r?.isError && /contains no set-off/.test(r?.json?.error || ""), `posting refused without a set-off (got ${String(r?.raw).slice(0, 160)})`); } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "tool_use", id: "toolu_q11", name: "ui_draft_action", input: { type: "email", recipient: "Cisco Systems, Inc., Global Rebates team", subject: "Volume rebate claim: €1,048,000", body: CLAIM_BODY } },
      { type: "tool_use", id: "toolu_q12", name: "ui_await_approvals", input: {} }
    ], expect: (req, { check }) => { const r = lastResults(req)[0]; check(r?.isError && /1\.084\.500,00 EUR/.test(r?.json?.error || ""), `German-format wrong amount refused (got ${String(r?.raw).slice(0, 160)})`); } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "tool_use", id: "toolu_q13", name: "ui_final_report", input: { outcome: "loss_accepted", markdown: "## Cisco: rebate decision\n\n**Decision.** Option A approved: claim €1,048,000 and link the accounts.\n\n*Live agent run.*" } }
    ], expect: (req, { check }) => { const r = lastResults(req); check(r[1]?.json?.all_decided === true, "approvals returned"); } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "tool_use", id: "toolu_q14", name: "ui_final_report", input: { outcome: "response_decided", markdown: "## Cisco: rebate decision\n\n**Decision.** Option A approved: claim €1,048,000 and link the accounts.\n\n*Live agent run.*" } }
    ], expect: (req, { check }) => { const r = lastResults(req)[0]; check(r?.isError && /The outcome is response_decided/.test(r?.json?.error || ""), `contradicting outcome refused (got ${String(r?.raw).slice(0, 160)})`); } },
    { usage: usage({ output_tokens: 20 }), stop: "end_turn", blocks: [{ type: "text", text: "Done." }],
      expect: (req, { check }) => { const r = lastResults(req)[0]?.json; check(r?.published === true && r?.outcome === "response_decided", "report published with the decision's outcome"); } }
  ];
  const fake = createFakeClaude(script);
  const t = await newPage(fake);
  const { page } = t;
  const checks = {};
  try {
    await startLive(page);
    await page.waitForSelector('.option-card[data-recommended="true"] .btn-approve', { state: "visible", timeout: 30000 });
    checks.discarded = await page.$$eval('#console .entry[data-discarded="true"]', (els) => els.length);
    checks.alert = await page.$eval(".alert-card", (e) => e.dataset.basis);
    await page.click('.option-card[aria-label^="Option C:"] .btn-reject');
    // The agent recalculates and proposes again (B recommended now); a click on the old set must not count.
    await page.waitForSelector('.option-card[data-recommended="true"][aria-label^="Option B:"]', { timeout: 20000 });
    await page.evaluate(async () => (await import("./js/events.js")).bus.emit("option_decision", { option_id: "V2", option_label: "Option B (old set)", decision: "approved", options_seq: 1, by: "user" }));
    await page.waitForTimeout(300);
    checks.staleIgnoredOnCards = await page.$$eval(".option-card", (els) => els.every((e) => !e.dataset.status));
    await page.click('.option-card[aria-label^="Option A:"] .btn-approve');
    await page.waitForSelector('button:has-text("Approve all"), .action-card[data-status="pending"] .btn-approve', { state: "visible", timeout: 30000 });
    await page.waitForFunction(() => /Waiting for your approval of \d+ draft/.test(document.querySelector("#console").innerText), null, { timeout: 30000 });
    checks.drafts = await page.$$eval(".action-card", (els) => els.map((e) => e.querySelector(".action-meta span")?.textContent));
    await page.click('.action-card[data-status="pending"] .btn-approve');
    await page.waitForFunction(() => /Done/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 30000 });
    checks.runFacts = await page.evaluate(() => [...document.querySelectorAll("#console .entry")].map((e) => e.innerText).slice(-1)[0]?.replace(/\s+/g, " ").slice(0, 300));
    checks.guardLines = await page.$$eval('#console .entry[data-guard]', (els) => els.map((e) => e.dataset.guard));
    await page.screenshot({ path: path.join(OUT, "L9-guards.png") });
  } catch (e) { checks.FAILED = String(e.message).split("\n")[0]; await page.screenshot({ path: path.join(OUT, "L-guards-fail.png") }).catch(() => {}); }
  await finish("live: guardrails (broken-off response, stale decision, drafts, outcome)", t, fake, checks);
}

// ---- case: quick second decision while the model answers the first; then Save run as simulation -------
if (run("race")) {
  const ref = REF["SC-CISCO-MA"];
  const script = [
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Finding: the register lists five Cisco accounts; I quantify the group." },
      { type: "tool_use", id: "toolu_r1", name: "sim_rebate", input: ref.finding }
    ] },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Recommendation: option B." },
      { type: "tool_use", id: "toolu_r2", name: "ui_propose_options", input: { recommended_variant_id: "V2", baseline_description: "Do nothing: the agreement-year claim expires.", options: CISCO_OPTIONS } }
    ] },
    { usage: usage(), stop: "tool_use", delayMs: 1500, blocks: [
      { type: "text", text: "Option A rejected. Options B and C remain open." },
      { type: "tool_use", id: "toolu_r3", name: "ui_await_decision", input: {} }
    ], expect: (req, { check }) => { const r = lastResults(req)[0]?.json; check(r?.decision === "rejected" && r?.option_id === "V1", "first decision is the rejection"); } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Option B approved. Drafting the set-off notice and the posting." },
      { type: "tool_use", id: "toolu_r4", name: "ui_draft_action", input: { type: "email", recipient: "Cisco Systems, Inc., Global Rebates team", subject: "Notice of set-off: volume rebate €1,048,000", body: "Dear Global Rebates team,\n\nUnder § 4.2 a rebate of €1,048,000 is due for the last agreement year. As § 9.1 allows, we will set it off against open Cisco invoices in our next payment run.\n\nKind regards\nProcurement Controlling, GlobalCorp SE" } },
      { type: "tool_use", id: "toolu_r5", name: "ui_draft_action", input: { type: "posting", recipient: "Accounts Payable, GlobalCorp SE (company code CC-1000)", subject: "Set-off posting: Cisco volume rebate", body: "Company code: CC-1000 GlobalCorp SE\nVendor: 10001 Cisco Systems Germany GmbH\nAmount: €1,048,000 credit against open invoices\nReference: RA-CISCO § 4.2 and § 9.1" } },
      { type: "tool_use", id: "toolu_r6", name: "ui_await_approvals", input: {} }
    ], expect: (req, { check }) => { const r = lastResults(req)[0]?.json; check(r?.decision === "approved" && r?.option_id === "V2", "queued approval consumed by ui_await_decision"); } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "tool_use", id: "toolu_r7", name: "ui_final_report", input: { markdown: "## Cisco: rebate decision\n\n**Decision.** Option B approved: set off €1,048,000 against open Cisco invoices.\n\n_Live agent run. Figures from the engine._" } }
    ] },
    { usage: usage({ output_tokens: 20 }), stop: "end_turn", blocks: [{ type: "text", text: "Done." }] }
  ];
  const fake = createFakeClaude(script);
  const t = await newPage(fake);
  const { page } = t;
  const checks = {};
  try {
    await startLive(page);
    await page.waitForSelector('.option-card[data-recommended="true"] .btn-approve', { state: "visible", timeout: 20000 });
    await page.click('.option-card[aria-label^="Option A:"] .btn-reject');
    await page.waitForTimeout(150);
    await page.click('.option-card[data-recommended="true"] .btn-approve');
    await page.waitForFunction(() => /Waiting for your approval of \d+ draft/.test(document.querySelector("#console").innerText), null, { timeout: 20000 });
    checks.postingHasMockLine = await page.$$eval(".action-card .action-body", (els) => els.map((e) => e.textContent).some((x) => /Mock posting for demonstration; no ERP system is connected/.test(x)));
    await page.click('button:has-text("Approve all")');
    await page.waitForFunction(() => /Done/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 20000 });
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click('#console button:has-text("Save run as simulation")')]);
    const text = await readFile(await dl.path(), "utf8");
    const def = JSON.parse(text.slice(text.indexOf("= {") + 2, text.lastIndexOf("};") + 1));
    const aw = def.steps.find((s) => s.awaitOption).awaitOption;
    checks.rejectedLine = aw.rejected.V1 || null;
    checks.branchStart = (aw.approved.V2 || []).slice(0, 3).map((s) => Object.keys(s)[0] + ":" + JSON.stringify(Object.values(s)[0]).slice(0, 50));
    checks.branchStates = (aw.approved.V2 || []).filter((s) => s.state).map((s) => s.state);
    checks.reportFooter = (aw.approved.V2 || []).find((s) => s.report)?.report.split("\n").slice(-1)[0];
  } catch (e) { checks.FAILED = String(e.message).split("\n")[0]; await page.screenshot({ path: path.join(OUT, "L-race-fail.png") }); }
  await finish("live: quick second decision + recording", t, fake, checks);
}

// ---- case: Abort while a model call is in flight: nothing from the old run appears afterwards ------------
if (run("abort")) {
  const script = [
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Check: I read the ECB reference rate for pounds sterling." },
      { type: "tool_use", id: "toolu_a1", name: "open_ecb_rate", input: { currency: "GBP" } }
    ] },
    { usage: usage(), stop: "end_turn", delayMs: 2500, blocks: [{ type: "text", text: "This late answer must never appear." }] }
  ];
  const fake = createFakeClaude(script);
  const t = await newPage(fake);
  const { page } = t;
  const checks = {};
  try {
    await startLive(page);
    await page.waitForFunction(() => document.querySelectorAll(".result-summary").length > 0, null, { timeout: 15000 });
    checks.ecbSummary = await page.$eval(".result-summary", (e) => e.textContent.slice(0, 160));
    await page.click("#btn-abort");
    await page.waitForFunction(() => /Aborted/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 5000 });
    const before = await page.$$eval("#console .entry", (els) => els.length);
    const requestsAtAbort = fake.requests.length;
    await page.waitForTimeout(3500);
    const after = await page.$$eval("#console .entry", (els) => els.length);
    checks.requestsAfterAbort = fake.requests.length - requestsAtAbort;
    checks.entriesStable = before === after;
    checks.lateTextShown = await page.evaluate(() => /must never appear/.test(document.querySelector("#console").innerText));
    checks.status = (await page.textContent(".status-pill .text")).trim();
  } catch (e) { checks.FAILED = String(e.message).split("\n")[0]; }
  await finish("live: abort during a model call", t, fake, checks);
}

// ---- case: key rejected mid-run (401) ------------------------------------------------------------------
if (run("badkey")) {
  const script = [{ error: { status: 401, type: "authentication_error", message: "invalid x-api-key" } }];
  const fake = createFakeClaude(script);
  const t = await newPage(fake);
  const checks = {};
  try {
    await startLive(t.page);
    await t.page.waitForFunction(() => /Error/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 20000 });
    checks.keyForgotten = await t.page.evaluate((k) => !sessionStorage.getItem(k), KEYS.apiKey);
    checks.message = await t.page.evaluate(() => [...document.querySelectorAll("#console .entry")].map((e) => e.innerText).find((x) => /401/.test(x))?.replace(/\s+/g, " ").slice(0, 160) || null);
  } catch (e) { checks.FAILED = String(e.message).split("\n")[0]; }
  await finish("live: key rejected (401)", t, fake, checks);
}

// ---- case: Live sweep, nothing material ----------------------------------------------------------------
if (run("scan")) {
  const script = [
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Live sweep: I read the overview and check one acquisition and the pound rate in the open data, in parallel." },
      { type: "tool_use", id: "toolu_s1", name: "erp_get_overview", input: {} },
      { type: "tool_use", id: "toolu_s2", name: "open_wikidata_owner", input: { name: "Splunk" } },
      { type: "tool_use", id: "toolu_s3", name: "open_ecb_rate", input: { currency: "GBP" } },
      { type: "tool_use", id: "toolu_s4", name: "open_gleif_search", input: { name: "Splunk", country: "US" } }
    ], expect: (req, { check }) => { const c = req.messages[0].content; check(typeof c === "string" && c.startsWith("Live sweep") && c.includes("Agreements:") && c.includes("RA-CISCO"), "sweep opener lists the agreements"); } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "No material finding in this sweep: the lookups I made match the register." },
      { type: "tool_use", id: "toolu_s5", name: "ui_final_report", input: { outcome: "no_material_finding", markdown: "## Live sweep: no material finding\n\nChecked the overview, Wikidata, GLEIF and the ECB pound rate. Nothing material in this sweep.\n\n*Live agent run.*" } }
    ], expect: (req, { check }) => {
      const r = lastResults(req);
      check(r.length === 4 && r.every((x) => !x.isError), `four successful lookups (got ${r.map((x) => String(x.raw).slice(0, 80)).join(" / ")})`);
      check(r[0]?.json?.agreements?.length === 8, "overview lists eight agreements");
      const wd = r[1]?.json;
      check(wd?.item?.id === WD.splunk && wd?.owned_by?.[0]?.name === "Cisco" && wd?.owned_by?.[0]?.since === "2024-03-18" && wd?.item?.lei === LEI.splunk && /10005/.test(wd?.item?.globalcorp || ""), `Wikidata owner parsed (got ${JSON.stringify(wd).slice(0, 260)})`);
      const fx = r[2]?.json;
      check(fx?.per_eur === 0.8712 && fx?.eur_per_unit === 1.1478 && Array.isArray(fx?.contract_rates), `ECB rate parsed (got ${JSON.stringify(fx).slice(0, 200)})`);
      const gs = r[3]?.json;
      check(gs?.records?.[0]?.lei === LEI.splunk && /10005/.test(gs?.records?.[0]?.globalcorp || "") && gs?.total === 1, `GLEIF search parsed (got ${JSON.stringify(gs).slice(0, 200)})`);
    } },
    { usage: usage({ output_tokens: 30 }), stop: "end_turn", blocks: [{ type: "text", text: "Sweep complete." }] }
  ];
  const fake = createFakeClaude(script);
  const t = await newPage(fake);
  const checks = {};
  try {
    await startLive(t.page, { scan: true });
    await t.page.waitForFunction(() => /Done/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 20000 });
    checks.endLine = await t.page.evaluate(() => [...document.querySelectorAll("#console .entry")].map((e) => e.innerText).slice(-1)[0]?.replace(/\s+/g, " "));
    checks.openData = t.log.openData.slice();
    await t.page.screenshot({ path: path.join(OUT, "L6-sweep-nothing.png") });
  } catch (e) { checks.FAILED = String(e.message).split("\n")[0]; }
  await finish("live: sweep with no findings", t, fake, checks);
}

await browser.close();
await close();

// What each case must show, beyond zero protocol violations and zero page, console or CSP errors.
const EXPECT = {
  "live: full Cisco run (mock API)": (c) => [
    [c.badge === "LIVE", "LIVE badge"],
    [/Cisco rebate missed/.test(c.alert || ""), "alert card shown"],
    [c.optionTotals?.length === 4, "three options plus do nothing"],
    [/^affected\|€2\.14M$/.test(c.kpiBefore || ""), `rebate-at-risk tile shows the verified figure (got ${c.kpiBefore})`],
    [/^resolved\|€0\|left with option A \(was €2\.14M\)$/.test(c.payoffVar || ""), `rebate-at-risk tile shows the payoff of the approved option (got ${c.payoffVar})`],
    [/^resolved\|None\|nothing lost with option A$/.test(c.payoffDeadline || ""), `deadline tile shows the payoff (got ${c.payoffDeadline})`],
    [/Guardrail: The draft was refused\. These amounts match no figure this text may quote, in its currency: €1,084,500/.test(c.figureRefusal || "") && c.draftTypedAmount === false, `the typed amount was refused in view and never reached the Outbox (got ${c.figureRefusal})`],
    [/1 guardrail refusal/.test(c.runFacts || ""), "run facts count the refusal"],
    [c.drafts === 2 && c.draftFooter, "two drafts, each with the approval footer"],
    [c.mapResolved >= 7, `accounts, links and the group turn resolved (got ${c.mapResolved})`],
    [c.status === "Done" && c.retryNotice, "run ends Done after a visible retry"],
    [/Run facts:/.test(c.runFacts || ""), "run facts on the last console line"],
    [(c.openData || []).filter((x) => x.startsWith("404 api.gleif.org")).length === 2, "GLEIF 404s answered for the entity without a parent"],
    [c.auditMode === "live" && c.auditNoKey && c.auditNoSignature && c.auditFirstHasSystem, "audit export: live, no key, no signatures, system prompt logged"],
    [c.costMatches, "cost meter equals the usage maths"],
    [c.simNoKey && c.simHasRecordedSource && c.simReportRewritten && c.simNoRefusedDraft, "recording is valid, carries no secrets and no refused draft"],
    [c.replayBadge === "SIMULATION" && /recorded on/.test(c.replayWatermark || ""), "replay labelled as a recorded run"],
    [/Recorded live run/.test(c.replayReport || "") && /simulation\|recorded/.test(c.replayAudit || ""), "replay report and audit marked"],
    [!!c.replayOtherPath, "a decision the live run did not take ends the replay gracefully"]
  ],
  "live: web search disabled → fallback": (c) => [
    [c.notice && c.nudgeNotice, "fallback notice and nudge note in the console"],
    [/Web search is switched off/.test(c.banner || ""), "banner explains the missing web search"],
    [c.scanEnabled === "false", "Live sweep stays available (open data needs no web search)"]
  ],
  "live: open-data failure → web-search fallback": (c) => [
    [!!c.fallbackNotice && /503/.test(c.toolError || ""), "console names the failure and the fallback"],
    [/failed earlier in this session/.test(c.toolError || ""), "the second call is skipped, not retried"],
    [c.gleifRequests === 3, `only the first call's three requests reached GLEIF (got ${c.gleifRequests})`]
  ],
  "live: quick second decision + recording": (c) => [
    [c.postingHasMockLine, "posting carries the mock line"],
    [c.rejectedLine === "Option A rejected. Options B and C remain open.", "rejection line recorded"],
    [/Recorded live run/.test(c.reportFooter || ""), "report footer rewritten for replay"]
  ],
  "live: abort during a model call": (c) => [
    [/1 GBP = €1\.1478/.test(c.ecbSummary || ""), `ECB rate summarised (got ${c.ecbSummary})`],
    [c.entriesStable && c.lateTextShown === false && c.status === "Aborted", "nothing appears after Abort"],
    [c.requestsAfterAbort === 0, `no model call after Abort (got ${c.requestsAfterAbort})`]
  ],
  "live: key rejected (401)": (c) => [[c.keyForgotten && /401/.test(c.message || ""), "key removed and 401 explained"]],
  "live: sweep with no findings": (c) => [[/no material finding/.test(c.endLine || "") && /Run facts:/.test(c.endLine || ""), "honest end with run facts"]],
  "live: guardrails (broken-off response, stale decision, drafts, outcome)": (c) => [
    [c.discarded >= 2, `the broken-off response's text and search are marked as discarded (got ${c.discarded})`],
    [c.alert === "what_if", "the alert on the register alone went out as a what-if"],
    [c.staleIgnoredOnCards, "a decision on the older set of options left the cards undecided"],
    [(c.drafts || []).length === 1 && /Email/.test(c.drafts[0] || ""), `only the claim letter reached the Outbox (got ${JSON.stringify(c.drafts)})`],
    [/4 guardrail refusals/.test(c.runFacts || ""), `run facts count four refusals (got ${c.runFacts})`],
    [["ui_report_alert", "ui_draft_action", "ui_final_report"].every((g) => (c.guardLines || []).includes(g)), `guardrail lines for the alert, the drafts and the summary (got ${JSON.stringify(c.guardLines)})`]
  ]
};

await writeFile(path.join(OUT, "live-results.json"), JSON.stringify(results, null, 2));
let passed = 0;
for (const r of results) {
  const problems = [
    ...(r.checks.FAILED ? [`exception: ${r.checks.FAILED}`] : []),
    ...(EXPECT[r.name]?.(r.checks) || []).filter(([ok]) => !ok).map(([, msg]) => msg),
    ...r.violations.map((v) => `protocol: ${v}`),
    ...(r.remainingScript ? [`${r.remainingScript} scripted responses were never requested`] : []),
    ...r.pageErrors.map((e) => `page error: ${e}`),
    ...r.consoleErrors.map((e) => `console error: ${e}`),
    ...r.csp.map((e) => `CSP: ${e}`)
  ];
  if (!problems.length) passed += 1;
  console.log(`${problems.length ? "FAIL" : "PASS"}  ${r.name}`);
  for (const p of problems) console.log(`      - ${String(p).slice(0, 300)}`);
}
console.log(`\n${passed}/${results.length} live cases passed. Screenshots and downloads: ${OUT}`);
process.exit(passed === results.length ? 0 : 1);
