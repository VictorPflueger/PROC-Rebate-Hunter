// A live run on the page, against a scripted stand-in for the Anthropic Messages API
// (lib/fake-claude.mjs). The stand-in streams realistic SSE and checks every request against the
// protocol rules the live agent follows: headers, the tools, every assistant turn passed back unchanged,
// every tool_use answered first. The page may reach api.anthropic.com alone; every other request is
// blocked and fails the case.
//   full     Cisco end to end: Start agent, the key checked and kept in this tab, LIVE and the AI
//            notice, the steps opening as the agent reaches them, a pause_turn with web searches, GLEIF
//            refused without a request (the page connects to the model API only), a verified alert,
//            €0 on the first count then €2.14M, option B rejected and option A approved from the page,
//            two drafts approved, the summary, Done with nothing sent, the session cost measured to the
//            cent from the stand-in's usage
//   stop     Stop the live run while a call is in flight: the run ends, the bar says so and offers
//            Replay, which brings the simulation back
//   badkey   a key the API rejects (401): the dialog says so, no run starts, no message is sent
// Usage: node tests/live.mjs [case…]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createFakeClaude } from "./lib/fake-claude.mjs";
import { APP_ROOT, ONLY, outDir, launchBrowser, serveStatic, CORS, MOCK_KEY, KEYS, NETWORK_NOISE } from "./lib/harness.mjs";

const run = (name) => ONLY.length === 0 || ONLY.includes(name);
const OUT = await outDir("live");
const { base: BASE, close } = await serveStatic(APP_ROOT, 0);
const browser = await launchBrowser();
const results = [];
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(path.join(APP_ROOT, "data/reference_cases.js"), "utf8"), sandbox);
// Copied into this realm: the stand-in compares what the agent sends back with what it sent, prototypes included.
const REF = JSON.parse(JSON.stringify(sandbox.window.REFERENCE_CASES));

/** A page whose requests to api.anthropic.com go to the stand-in; every other host is blocked and logged. */
async function newPage(fake, { models = "ok" } = {}) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const log = { pageErrors: [], consoleErrors: [], blocked: [], api: [] };
  const origin = new URL(BASE).origin;
  await context.route("**/*", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.origin === origin || u.protocol === "data:" || u.protocol === "blob:") return route.continue();
    if (u.host === "api.anthropic.com") {
      log.api.push(`${req.method()} ${u.pathname}`);
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
    log.blocked.push(req.url());
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => log.pageErrors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text()) && !/live run failed|stopped/i.test(m.text())) log.consoleErrors.push(m.text()); });
  await page.goto(`${BASE}?guide=0`);
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  return { context, page, log };
}

async function startLive(page) {
  await page.click("#start");
  await page.waitForSelector("#start-dialog[open]");
  await page.fill("#key-input", MOCK_KEY);
  await page.click("#start-live");
}

const bar = (page) => page.evaluate(() => ({ text: document.querySelector("#move").innerText.replace(/\s+/g, " ").trim(), tone: document.querySelector("#move").dataset.tone, attention: [...document.querySelectorAll("#move button.vc-attention")].map((b) => b.innerText.trim()) }));
const tile = (page, name) => page.evaluate((n) => document.querySelector(`[data-vc-kpi="${n}"] .kpi-value`).innerText.replace(/\s+/g, " ").trim(), name);
const usage = (o = {}) => ({ input_tokens: 600, cache_creation_input_tokens: 0, cache_read_input_tokens: 9000, output_tokens: 420, ...o });
const safeJson = (s) => { try { return JSON.parse(s); } catch { return null; } };
const lastResults = (req) => {
  const last = req.messages[req.messages.length - 1];
  return Array.isArray(last?.content) ? last.content.filter((b) => b.type === "tool_result").map((b) => ({ isError: b.is_error === true, raw: b.content, json: safeJson(b.content) })) : [];
};
function finish(name, t, fake, problems, note) {
  if (fake && (problems.length || fake.violations.length)) writeFileSync(path.join(OUT, `${name}-requests.json`), JSON.stringify({ requests: fake.requests.map((r) => r.req), sent: fake.sent }, null, 1));
  if (fake) {
    for (const v of fake.violations) problems.push(`protocol: ${v}`);
    if (name === "full" && fake.remaining()) problems.push(`${fake.remaining()} scripted responses never asked for`);
  }
  for (const u of t.log.blocked) problems.push(`a request to another host: ${u}`);
  for (const e of [...t.log.pageErrors, ...t.log.consoleErrors]) problems.push(`page error: ${e}`);
  results.push({ name, problems });
  console.log(`${problems.length ? "FAIL" : "PASS"}  ${name}${problems.length ? "" : `: ${note}`}`);
  for (const p of problems) console.log(`        - ${p}`);
}

const OPTIONS = [
  { variant_id: "V1", title: "Claim now and link the three accounts", description: "Send Cisco a written claim for the agreement year and set the Cisco group key on Meraki, Acacia and Splunk.", residual_risk: "Cisco may ask for invoice evidence per account; the credit note takes about 45 days." },
  { variant_id: "V2", title: "Set off against open Cisco invoices", description: "Notify Cisco and deduct the rebate from open Cisco invoices in the next payment run; link the accounts as in option A.", residual_risk: "A set-off before Cisco agrees can strain the relationship." },
  { variant_id: "V3", title: "Claim the agreement year only", description: "Send the written claim but leave the vendor master as it is.", residual_risk: "Next year's rebate slips in exactly the same way." }
];
const CLAIM = "Dear Global Rebates team,\n\nUnder § 4.2 of our volume rebate agreement, Cisco credits 2 % of all net purchases of an agreement year once GlobalCorp's purchases from Cisco Systems, Inc. and its Affiliates reach €50.0m.\n\nIn the last agreement year our purchases from Cisco and its Affiliates, including Meraki, Acacia and Splunk, totalled €52,400,000. We claim a rebate of €1,048,000 and ask for a credit note.\n\nKind regards\nProcurement Controlling, GlobalCorp SE";
const MEMO = "Request: maintain the group key CISCO (vendor master field KONZS) on these accounts and link them to agreement RA-CISCO:\n- 10003 Meraki Cloud Networks Ltd.\n- 10004 Acacia Communications Opto\n- 10005 Splunk Software EMEA\n\nWhy: the subscription register lists all three as Cisco companies; without the link the year-end report misses their spend.";
const web = (id, query, results) => [
  { type: "server_tool_use", id, name: "web_search", input: { query } },
  { type: "web_search_tool_result", tool_use_id: id, content: results.map(([url, title, age], i) => ({ type: "web_search_result", url, title, encrypted_content: `ENC-${id}-${i}`, page_age: age })) }
];

// ---- full: Cisco end to end -----------------------------------------------------------------------------
if (run("full")) {
  const ref = REF["SC-CISCO-MA"];
  const script = [
    { usage: usage({ input_tokens: 3400, cache_creation_input_tokens: 6100, cache_read_input_tokens: 0, output_tokens: 380 }), stop: "tool_use", blocks: [
      { type: "thinking", thinking: "The tip is unverified. First see what the Cisco agreement counts and which accounts look like Cisco companies.", signature: "SIG-THINK-1==" },
      { type: "text", text: "Signal received: a category manager says Meraki and Acacia invoices sit on their own vendor accounts and never count towards the Cisco volume rebate. I read the agreement and look for the accounts." },
      { type: "tool_use", id: "toolu_01", name: "erp_get_agreement", input: { agreement_id: "RA-CISCO" } },
      { type: "tool_use", id: "toolu_02", name: "erp_list_vendors", input: { query: "Cisco, Meraki, Acacia" } }
    ], expect: (req, { check }) => {
      check(typeof req.messages[0]?.content === "string" && req.messages[0].content.includes("Meraki and Acacia invoices"), "the opening message carries the tip");
      check(req.tools.some((t) => t.type === "web_search_20250305"), "web search is offered");
    } },
    { usage: usage({ web_search_requests: 1 }), stop: "pause_turn", blocks: [
      { type: "text", text: "Hypothesis: the tip is right. Meraki Cloud Networks (10003) and Acacia Communications Opto (10004) have no Cisco group key, so the year-end report never counted their spend." },
      ...web("srvtoolu_01", "Cisco completes acquisition Acacia Communications Meraki", [["https://newsroom.example.com/cisco-acacia", "Cisco completes acquisition of Acacia Communications", "1 March 2021"], ["https://newsroom.example.com/cisco-meraki", "Cisco completes acquisition of Meraki", "20 December 2012"]]),
      { type: "text", text: "Check: both deals completed years before this agreement year. Next: who else belongs to Cisco according to the register?" }
    ], expect: (req, { check }) => {
      const r = lastResults(req);
      check(r[0]?.json?.id === "RA-CISCO" && r[0]?.json?.tiers?.[0]?.from_eur === 50000000, "the agreement came back");
    } },
    { usage: usage({ web_search_requests: 1 }), stop: "tool_use", blocks: [
      ...web("srvtoolu_02", "Cisco completes acquisition of Splunk", [["https://newsroom.example.com/cisco-splunk", "Cisco completes acquisition of Splunk", "18 March 2024"]]),
      { type: "text", text: "Confirmed: Cisco's announcements show all three deals completed. I check the register, and GLEIF if it answers." },
      { type: "tool_use", id: "toolu_03", name: "erp_family_tree", input: { vendor_id: "10001" } },
      { type: "tool_use", id: "toolu_04", name: "open_gleif_parent", input: { lei: "549300XGDSGBP6UEI867" } }
    ], expect: (req, { check }) => check(req.messages[req.messages.length - 1].role === "assistant", "a pause_turn is sent back with the assistant turn last") },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Revised: two acquired accounts → three. The register lists Splunk Software EMEA (10005) as a Cisco company as well, and Cisco's newsroom confirms the deal." },
      { type: "tool_use", id: "toolu_05", name: "ui_report_alert", input: {
        title: "Cisco rebate missed: three acquired companies invoiced outside the agreement", severity: "high", basis: "verified",
        summary: "Meraki, Acacia and Splunk invoice GlobalCorp on their own vendor accounts, without the Cisco group key. Counted with the two linked accounts, the Cisco group may cross the threshold of the 2 % volume rebate.",
        sources: [{ title: "Cisco completes acquisition of Splunk", url: "https://newsroom.example.com/cisco-splunk" }, { title: "Cisco completes acquisition of Acacia Communications", url: "https://newsroom.example.com/cisco-acacia" }],
        vendor_ids: ["10003", "10004", "10005"], group_ids: ["G-CISCO"]
      } },
      { type: "tool_use", id: "toolu_06", name: "sim_rebate", input: ref.hypothesis }
    ], expect: (req, { check }) => {
      const r = lastResults(req);
      check(r[0]?.json?.members?.length === 5, "the register lists five Cisco accounts");
      check(r[1]?.isError || /unavailable|not reachable|could not|failed/i.test(String(r[1]?.raw)), `GLEIF is refused without a request (got ${String(r[1]?.raw).slice(0, 160)})`);
    } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Finding: Meraki and Acacia alone keep the group below €50m, so the first estimate finds nothing owed. With Splunk the picture changes; I quantify the verified group." },
      { type: "tool_use", id: "toolu_07", name: "sim_rebate", input: ref.finding }
    ], expect: (req, { check }) => {
      const r = lastResults(req);
      check(r[0]?.json?.ok === true, `the verified alert is accepted (got ${String(r[0]?.raw).slice(0, 200)})`);
      check(r[1]?.json?.ok === true && r[1]?.json?.baseline?.rebate_at_risk_eur === 0, "the first estimate finds nothing owed");
    } },
    { usage: usage({ output_tokens: 900 }), stop: "tool_use", blocks: [
      { type: "text", text: "Recommendation: option A. It recovers the full amount for the lowest expected total; option B brings the cash in sooner by set-off." },
      { type: "tool_use", id: "toolu_08", name: "ui_propose_options", input: { recommended_variant_id: "V1", baseline_description: "Do nothing: the agreement-year claim expires, and the running year slips the same way.", options: OPTIONS } }
    ], expect: (req, { check }) => {
      const r = lastResults(req)[0]?.json;
      check(r?.ok === true && r?.variants?.length === 3 && r?.baseline?.rebate_at_risk_eur === 2137920, "the engine costs three options on €2,137,920 at stake");
    } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Option B rejected. Options A and C remain open." },
      { type: "tool_use", id: "toolu_09", name: "ui_await_decision", input: {} }
    ], expect: (req, { check }) => { const r = lastResults(req)[0]?.json; check(r?.decision === "rejected" && r?.option_id === "V2", `the rejection of option B came back (got ${JSON.stringify(r).slice(0, 160)})`); } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Option A approved. Drafting the claim letter to Cisco and the vendor-master change; each draft waits for your approval in the Outbox." },
      { type: "tool_use", id: "toolu_10", name: "ui_draft_action", input: { type: "email", recipient: "Cisco Systems, Inc., Global Rebates team", subject: "Volume rebate claim for the agreement year: €1,048,000", body: CLAIM } },
      { type: "tool_use", id: "toolu_11", name: "ui_draft_action", input: { type: "memo", recipient: "Master Data Management, GlobalCorp SE", subject: "Set group key CISCO on vendor accounts 10003, 10004 and 10005", body: MEMO } }
    ], expect: (req, { check }) => { const r = lastResults(req)[0]?.json; check(r?.decision === "approved" && r?.option_id === "V1", `the approval of option A came back (got ${JSON.stringify(r).slice(0, 160)})`); } },
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "tool_use", id: "toolu_12", name: "ui_await_approvals", input: {} }
    ], expect: (req, { check }) => { const r = lastResults(req); check(r.length === 2 && r.every((x) => x.json?.status === "pending_approval"), "both drafts wait for approval"); } },
    { usage: usage({ output_tokens: 700 }), stop: "tool_use", blocks: [
      { type: "tool_use", id: "toolu_13", name: "ui_final_report", input: { outcome: "response_decided", markdown: "## Cisco: rebate decision\n\n**What we found.** Meraki, Acacia and Splunk invoice GlobalCorp on their own vendor accounts without the Cisco group key. The register lists all three as Cisco companies, confirmed by Cisco's announcements.\n\n**If we do nothing.** €2.14M lost: the agreement-year claim of €1,048,000 expires first.\n\n**Decision.** Option A approved: claim the agreement year and link the three accounts. Response cost €17,100; nothing left to lose.\n\n**Actions.** Both drafts are approved for a person to send.\n\n*Live agent run. GlobalCorp SE and its vendor accounts are fictional; the corporate groups are real; figures come from the deterministic rebate engine.*" } }
    ], expect: (req, { check }) => { const r = lastResults(req)[0]?.json; check(r?.approved === 2, `both approvals came back (got ${JSON.stringify(r).slice(0, 120)})`); } },
    { usage: usage({ output_tokens: 40 }), stop: "end_turn", blocks: [
      { type: "text", text: "The management summary is published. Both drafts are approved; nothing was sent." }
    ] }
  ];
  const fake = createFakeClaude(script);
  const t = await newPage(fake);
  const { page } = t;
  const problems = [];
  try {
    await startLive(page);
    await page.waitForFunction(() => document.querySelector("#mode-text")?.textContent === "LIVE", null, { timeout: 10000 });
    const stored = await page.evaluate((k) => ({ session: sessionStorage.getItem(k), local: Object.keys(localStorage).filter((x) => /key/i.test(x)) }), KEYS.apiKey);
    if (stored.session !== MOCK_KEY || stored.local.length) problems.push(`the key is not kept in this tab alone (${JSON.stringify(stored)})`);
    const working = await bar(page);
    if (!/You are interacting with an AI system/.test(working.text) && !/Your turn/.test(working.text)) problems.push(`while the agent works the bar reads "${working.text}"`);
    if (!(await page.isVisible(".talk-track .ai-notice"))) problems.push("the AI notice is not beside Start agent during the run");
    // The decision: the page follows the agent to Propose and asks.
    await page.waitForFunction(() => document.querySelector("#steps .vc-step--current")?.dataset.step === "propose" && /^Your turn/.test(document.querySelector("#move").innerText), null, { timeout: 30000 });
    await page.screenshot({ path: path.join(OUT, "live-decision.png") });
    const ask = await bar(page);
    if (!ask.attention.includes("Approve option A")) problems.push(`at the decision the bar holds ${JSON.stringify(ask.attention)}`);
    const tiles = [await tile(page, "Rebate at stake"), await tile(page, "Claim deadline")];
    if (tiles.join("|") !== "€2.14M|31 days") problems.push(`the tiles read ${tiles.join(", ")}`);
    await page.click("#steps .vc-step:nth-child(3) .vc-step__button");
    const calc = await page.evaluate(() => document.querySelector("#story").innerText);
    if (!/From €0 on the first count to €2\.14M at stake/.test(calc)) problems.push("Calculate does not tell €0 → €2.14M");
    if (!/Claude, live on your key/.test(calc)) problems.push("the agent's words are not marked as live");
    await page.click("#steps .vc-step:nth-child(4) .vc-step__button");
    await page.click('[data-option="V2"] button[data-action="reject"]');
    await page.waitForFunction(() => document.querySelector('[data-option="V2"]')?.dataset.state === "rejected", null, { timeout: 10000 });
    await page.waitForTimeout(400);
    await page.click("#move button.vc-attention");
    // The drafts: the page follows the agent to Prepare.
    await page.waitForFunction(() => document.querySelectorAll(".draft[data-status='pending']").length === 2 && /^Your turn/.test(document.querySelector("#move").innerText), null, { timeout: 30000 });
    const drafts = await bar(page);
    if (!drafts.attention.includes("Approve both")) problems.push(`with the drafts the bar holds ${JSON.stringify(drafts.attention)}`);
    const memo = await page.evaluate(() => document.querySelectorAll(".draft")[1]?.innerText || "");
    if (/CISCO|10003|RA-CISCO|KONZS/.test(memo)) problems.push(`a draft shows record ids: ${memo.slice(0, 120)}`);
    await page.click("#move button.vc-attention");
    await page.waitForFunction(() => /^Done\./.test(document.querySelector("#move").innerText), null, { timeout: 30000 });
    await page.screenshot({ path: path.join(OUT, "live-done.png") });
    const done = await bar(page);
    if (!/Nothing was sent/.test(done.text)) problems.push(`the end reads "${done.text}"`);
    // The session cost, measured: the stand-in's usage at Sonnet's prices, web search $10 per 1,000, $1 = €0.894.
    let usd = 0;
    for (const s of script) if (s.usage) { const u = s.usage; usd += u.input_tokens * 2 / 1e6 + u.cache_creation_input_tokens * 2.5 / 1e6 + u.cache_read_input_tokens * 0.1 / 1e6 + u.output_tokens * 10 / 1e6 + (u.web_search_requests || 0) * 0.01; }
    const want = `€${(usd * 0.894).toFixed(2)}`;
    const cost = await tile(page, "Session cost");
    const note = await page.evaluate(() => document.querySelector('[data-vc-kpi="Session cost"] .kpi-note').textContent);
    if (cost !== want || !/measured/.test(note)) problems.push(`the session cost reads ${cost} (${note}), the stand-in's usage makes ${want}`);
    const log = await page.evaluate(() => { const l = document.querySelector(".log"); if (l) l.open = true; return [...document.querySelectorAll(".log li")].map((li) => li.innerText); });
    if (log.length < 4 || !/rejected option B/.test(log.join(" ")) || !/approved option A/.test(log.join(" "))) problems.push(`the decision log reads ${JSON.stringify(log)}`);
    if (t.log.api.some((x) => !/^(GET \/v1\/models|POST \/v1\/messages|OPTIONS \/v1\/(models|messages))$/.test(x))) problems.push(`unexpected API calls: ${t.log.api.join(", ")}`);
  } catch (e) {
    problems.push(`the run did not complete: ${String(e.message || e).split("\n")[0]}`);
    await page.screenshot({ path: path.join(OUT, "live-full-failed.png") }).catch(() => {});
  }
  finish("full", t, fake, problems, "Cisco live: key in this tab, LIVE, steps follow the agent, GLEIF refused without a request, €0 then €2.14M, B rejected, A approved, both drafts approved, nothing sent, cost measured");
  await t.context.close();
}

// ---- stop: Stop while a call is in flight -------------------------------------------------------------------
if (run("stop")) {
  const script = [
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "text", text: "Signal received: a category manager says Meraki and Acacia invoices sit on their own vendor accounts." },
      { type: "tool_use", id: "toolu_s1", name: "erp_get_agreement", input: { agreement_id: "RA-CISCO" } }
    ] },
    { usage: usage(), stop: "end_turn", delayMs: 8000, blocks: [{ type: "text", text: "This answer comes too late to be shown." }] }
  ];
  const fake = createFakeClaude(script);
  const t = await newPage(fake);
  const { page } = t;
  const problems = [];
  try {
    await startLive(page);
    await page.waitForFunction(() => [...document.querySelectorAll("#move button")].some((b) => /Stop the live run/.test(b.innerText)) && /Signal received/.test(document.querySelector("#agent-words")?.innerText || ""), null, { timeout: 15000 });
    await page.click('#move button:has-text("Stop the live run")');
    await page.waitForFunction(() => /stopped/i.test(document.querySelector("#move").innerText), null, { timeout: 10000 });
    const stopped = await bar(page);
    if (!/Replay/.test(stopped.text)) problems.push(`after Stop the bar reads "${stopped.text}"`);
    await page.waitForTimeout(8500);
    if (/too late/.test(await page.evaluate(() => document.body.innerText))) problems.push("an answer after Stop still appeared");
    await page.click('#move button:has-text("Replay")');
    await page.waitForFunction(() => document.querySelector("#mode-text")?.textContent === "SIMULATION", null, { timeout: 10000 });
  } catch (e) {
    problems.push(`Stop did not work: ${String(e.message || e).split("\n")[0]}`);
  }
  finish("stop", t, fake, problems, "Stop ends the live run mid-call, nothing after it appears, Replay brings back the simulation");
  await t.context.close();
}

// ---- badkey: the API rejects the key -------------------------------------------------------------------------
if (run("badkey")) {
  const fake = createFakeClaude([]);
  const t = await newPage(fake, { models: "reject" });
  const { page } = t;
  const problems = [];
  await startLive(page);
  await page.waitForFunction(() => !document.querySelector("#key-error").hidden, null, { timeout: 10000 }).catch(() => problems.push("no error under the key"));
  const error = await page.evaluate(() => document.querySelector("#key-error").innerText);
  if (!/rejected this key \(401\)/.test(error)) problems.push(`the dialog says "${error}"`);
  if (!(await page.evaluate(() => document.querySelector("#start-dialog").open))) problems.push("the dialog closed");
  if ((await page.evaluate(() => document.querySelector("#mode-text").textContent)) !== "SIMULATION") problems.push("a live run started");
  if (fake.requests.length) problems.push(`${fake.requests.length} messages were sent with a rejected key`);
  finish("badkey", t, null, problems, "a rejected key is named in the dialog, and no run starts");
  await t.context.close();
}

await browser.close();
await close();
const failed = results.filter((r) => r.problems.length);
console.log(`\n${results.length - failed.length} of ${results.length} live cases passed.`);
if (failed.length) process.exit(1);
console.log("LIVE OK");
