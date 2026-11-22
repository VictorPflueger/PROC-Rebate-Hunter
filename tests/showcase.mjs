// The presenter in Chromium, case by case. Every page is served from this folder; any request to
// another host is blocked and fails the case.
//   first    the first screen: the guide opens by itself (Vici's own render check: once per tab, not
//            on a reload, ?guide=0 and ?guide=present), the four tiles answer before anything runs, the
//            header and the strip under it, the five steps under the header, Start agent with the free
//            simulation first, no link to the repository
//   play     Play starts as the guide closes, reads each step for 7 to 14 s and fills the rail, Space
//            and a chosen step pause it, a dialog holds it, it holds where the person acts and goes on
//            once they have, and ends on Replay
//   turn     wherever the page waits, a bar right under the story says Your turn and holds the one
//            primary action with vc-attention: the decision and the drafts of the lead case, a step
//            opened by a link, the decision of every case
//   cases    six cases on every decision path: options A, B, C and doing nothing approved, every
//            draft approved, the tiles moved with the old value struck through, the log, no record id
//            and no broken word on any screen, nothing sent
//   keeps    the threshold race at Calculate, the AI notice beside every live control, nothing sent
//            without approval, the decision log with times
//   layout   every step at 1920 × 1080 and 1280 × 720 in both themes: no overflow, no cut-off or small
//            text, the bar in view, nothing of the story under the bar; screenshots for a look
// Usage: node tests/showcase.mjs [case…]
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { APP_ROOT, ONLY, launchBrowser, serveStatic, openApp, outDir, viciDir, REQUIRE_VICI } from "./lib/harness.mjs";

const run = (name) => ONLY.length === 0 || ONLY.includes(name);
const OUT = await outDir("showcase");
const { base: BASE, close } = await serveStatic(APP_ROOT, 0);
const browser = await launchBrowser();
const results = [];
const result = (name, problems, note) => { results.push({ name, problems, note }); console.log(`${problems.length ? "FAIL" : "PASS"}  ${name}${problems.length ? "" : `: ${note}`}`); for (const p of problems) console.log(`        - ${p}`); };

const sandbox = { window: {} };
vm.createContext(sandbox);
for (const f of ["world.js", "scenarios.js", "reference_cases.js"]) vm.runInContext(readFileSync(path.join(APP_ROOT, "data", f), "utf8"), sandbox);
const { WORLD, SCENARIOS, REFERENCE_CASES } = sandbox.window;
const slug = (sc) => sc.short.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const IDS = new Set(["KONZS"]);
for (const v of WORLD.vendors) { IDS.add(v.id); if (v.tax_id) IDS.add(v.tax_id); }
for (const x of [...WORLD.agreements, ...WORLD.groups, ...WORLD.company_codes]) IDS.add(x.id);
for (const x of [...WORLD.groups, ...(WORLD.register || [])]) if (x.lei) IDS.add(x.lei);
const ID = new RegExp(`(?<![\\w-])(${[...IDS].map(String).filter((s) => s.length >= 4).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}|L-\\d{5})(?![\\w-])`);
const current = (p) => p.evaluate(() => document.querySelector("#steps .vc-step--current")?.dataset.step);
const waitStep = (p, id, ms = 15000) => p.waitForFunction((s) => document.querySelector("#steps .vc-step--current")?.dataset.step === s, id, { timeout: ms });
const closeGuide = async (p) => { if (await p.evaluate(() => document.querySelector("dialog.vc-guide")?.open)) { await p.keyboard.press("Escape"); await p.waitForTimeout(250); } };
/** The bar that asks: its words, its buttons (which is primary, which draws attention), where it sits. */
const bar = (p) => p.evaluate(() => {
  const m = document.querySelector("#move");
  const r = m.getBoundingClientRect();
  return {
    text: m.innerText.replace(/\s+/g, " ").trim(), visible: r.height > 0 && r.top >= 0 && r.bottom <= innerHeight + 1,
    buttons: [...m.querySelectorAll("button")].map((b) => ({ text: b.innerText.trim(), primary: !/vc-button--(secondary|ghost|outline|danger)/.test(b.className), attention: b.classList.contains("vc-attention") }))
  };
});
/** Story content partly under the bar (what a closed <details> holds is never seen, so it does not count). */
const underBar = (p) => p.evaluate(() => {
  const m = document.querySelector("#move");
  const story = m.closest("#story");
  const top = m.getBoundingClientRect().top;
  const sr = story.getBoundingClientRect();
  const seen = (e) => e.getClientRects().length && !e.closest("details:not([open]) > :not(summary)");
  const hit = [...story.querySelectorAll("*")].filter((e) => e.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING && !e.contains(m) && seen(e))
    .find((e) => { const r = e.getBoundingClientRect(); return r.bottom > top + 2 && r.top < top && r.bottom <= sr.bottom; });
  return hit ? hit.className || hit.tagName : "";
});

// ---- first: the first screen ------------------------------------------------------------------------
if (run("first")) {
  const problems = [];
  const dir = viciDir();
  if (dir) {
    // Run beside this process, not blocking it: the page is served from here.
    const out = await new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(dir, "scripts", "check-guide-render.mjs"), BASE], { env: process.env });
      let text = "";
      child.stdout.on("data", (d) => { text += d; });
      child.stderr.on("data", (d) => { text += d; });
      child.on("close", () => resolve(text));
    });
    if (!/GUIDE BEHAVIOUR OK/.test(out)) problems.push(`Vici's guide check: ${out.trim().split("\n").slice(-4).join(" | ")}`);
  } else if (REQUIRE_VICI) problems.push("no ViciDesign checkout for Vici's guide check");
  const p = await openApp(browser, BASE, {});
  const f = await p.evaluate(() => {
    const header = document.querySelector("header").getBoundingClientRect();
    const how = document.querySelector("[data-vc-guide-open]");
    const intro = document.querySelector("header + .intro");
    return {
      guideOpen: document.querySelector("dialog.vc-guide").open,
      tiles: [...document.querySelectorAll("[data-vc-kpi]")].map((t) => `${t.dataset.vcKpi}=${t.querySelector(".kpi-value").textContent.replace(/\s+/g, " ").trim()}`),
      name: document.querySelector(".brand-name")?.textContent.trim(), cell: !!document.querySelector(".brand .vc-cell .vc-icon--search"),
      mode: document.querySelector("#mode-text")?.textContent.trim(), how: how?.innerText.trim(), howWidth: how?.getBoundingClientRect().width || 0,
      toggle: !!document.querySelector("header [data-vc-theme-toggle]"),
      rows: new Set([".brand", "#mode-tag", "[data-vc-guide-open]", "[data-vc-theme-toggle]"].map((s) => Math.round(document.querySelector(s).getBoundingClientRect().top / 8))).size,
      sentence: intro?.querySelector(".intro-text")?.innerText.trim(), byline: intro?.querySelector(".vc-byline")?.innerText.replace(/\s+/g, " ").trim(),
      steps: [...document.querySelectorAll("#steps .vc-step")].map((li) => ({ label: li.querySelector(".vc-step__label").firstChild.textContent.trim(), top: li.getBoundingClientRect().top })),
      headerBottom: header.bottom,
      links: [...document.querySelectorAll("a[href]")].map((a) => a.href)
    };
  });
  if (!f.guideOpen) problems.push("the guide did not open by itself");
  const wantTiles = ["Rebate at stake=€2.14M", "Claim deadline=31 days", "Detection → decision=0:00", "Session cost=≈ €0.14"];
  if (f.tiles.join("|") !== wantTiles.join("|")) problems.push(`the tiles read ${f.tiles.join(", ")}`);
  if (f.name !== "Rebate Hunter" || !f.cell) problems.push(`the header shows "${f.name}" ${f.cell ? "with" : "without"} its icon`);
  if (f.mode !== "SIMULATION") problems.push(`the mode reads "${f.mode}"`);
  if (f.how !== "How it works" || f.howWidth < 60 || !f.toggle) problems.push(`How it works reads "${f.how}" (${Math.round(f.howWidth)} px), theme toggle ${f.toggle}`);
  if (f.rows > 2) problems.push("the header's parts sit on more than one line");
  if (!/rebate/i.test(f.sentence || "") || !/fictional/i.test(f.sentence || "") || (f.sentence || "").split(/(?<=[.!?])\s+(?=[A-Z])/).length !== 1) problems.push(`the sentence under the header reads "${f.sentence}"`);
  if (!/^Built by Victor Pflüger/.test(f.byline || "")) problems.push(`the byline reads "${f.byline}"`);
  if (f.steps.map((x) => x.label).join("|") !== "Spot|Check|Calculate|Propose|Prepare" || f.steps.some((x) => x.top < f.headerBottom || x.top > f.headerBottom + 160)) problems.push(`the steps under the header read ${f.steps.map((x) => x.label).join(", ")}`);
  const own = f.links.filter((h) => /github\.com|PROC-Rebate-Hunter/i.test(h));
  if (own.length) problems.push(`links to ${own.join(", ")}`);
  await closeGuide(p);
  await p.click("#start");
  await p.waitForSelector("#start-dialog[open]");
  const d = await p.evaluate(() => {
    const dlg = document.querySelector("#start-dialog");
    const buttons = [...dlg.querySelectorAll("button.vc-button")].filter((b) => b.getClientRects().length);
    return { first: buttons[0]?.innerText.trim(), focused: document.activeElement?.id, primaries: buttons.filter((b) => !/vc-button--(secondary|ghost|outline|danger)/.test(b.className)).length, text: dlg.innerText };
  });
  if (!/simulation/i.test(d.first || "") || d.focused !== "start-sim" || d.primaries !== 1) problems.push(`Start agent leads with "${d.first}" (focus on ${d.focused}, ${d.primaries} primary buttons)`);
  if (!/Free, no API key/.test(d.text) || !/You are interacting with an AI system/.test(d.text)) problems.push("the dialog does not say the simulation is free and needs no key, or the live run lacks the AI notice");
  await p.keyboard.press("Escape");
  await p.screenshot({ path: path.join(OUT, "first-1280.png") });
  if (p.external.length) problems.push(`requests to other hosts: ${p.external.join(", ")}`);
  if (p.errors.length) problems.push(`page errors: ${p.errors.join(" | ")}`);
  await p.context().close();
  result("first", problems, "the guide opens by itself once a tab, four answers before anything runs, the header and its strip, five steps, the simulation first");
}

// ---- play: the steps go by themselves ----------------------------------------------------------------
if (run("play")) {
  const problems = [];
  const p = await openApp(browser, BASE, {});
  const state = () => p.evaluate(() => {
    const cur = document.querySelector("#steps .vc-step--current");
    return { step: cur?.dataset.step, play: document.querySelector("#play")?.innerText.trim(), fill: Number(getComputedStyle(cur).getPropertyValue("--vc-step-fill") || 0) };
  });
  await p.waitForTimeout(2500);
  if ((await state()).step !== "spot") problems.push("the page moved while the guide was open");
  await closeGuide(p);
  await p.waitForTimeout(1500);
  let st = await state();
  if (st.play !== "Pause") problems.push(`after the guide closed the button reads "${st.play}", not Pause`);
  if (!(st.fill > 0)) problems.push(`the rail does not fill (--vc-step-fill ${st.fill})`);
  const t0 = Date.now();
  await p.waitForFunction(() => document.querySelector("#steps .vc-step--current")?.dataset.step !== "spot", null, { timeout: 16000 }).catch(() => problems.push("Play did not leave step 1 within 16 s"));
  const took = (Date.now() - t0 + 1500) / 1000;
  if (took < 6.5 || took > 15.5) problems.push(`step 1 lasted ${took.toFixed(1)} s`);
  await p.keyboard.press("Space");
  await p.waitForTimeout(300);
  const paused = await state();
  if (paused.play !== "Play") problems.push(`after Space the button reads "${paused.play}"`);
  await p.waitForTimeout(15000);
  if ((await state()).step !== paused.step) problems.push("the page moved while paused");
  await p.keyboard.press("Space");
  await p.click("[data-vc-guide-open]");
  const atOpen = (await state()).step;
  await p.waitForTimeout(15000);
  if ((await state()).step !== atOpen) problems.push("Play went on behind the open guide");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  await p.click("#steps .vc-step:nth-child(1) .vc-step__button");
  await p.waitForTimeout(300);
  if ((await state()).play !== "Play") problems.push("a step chosen by hand did not pause Play");
  await p.click("#play");
  await waitStep(p, "propose", 70000).catch(() => problems.push("Play did not reach Propose"));
  await p.waitForTimeout(15000);
  if ((await current(p)) !== "propose") problems.push("Play went past the open decision");
  if (!/^Your turn/.test((await bar(p)).text)) problems.push("at the decision the bar does not say Your turn");
  await p.click("#move button.vc-attention").catch(() => problems.push("no action at the decision"));
  await waitStep(p, "prepare", 20000).catch(() => problems.push("after the approval Play did not go on to Prepare"));
  await p.waitForTimeout(1200);
  await p.click("#move button.vc-attention").catch(() => problems.push("no action at the drafts"));
  // The story is over once the drafts are approved: the button offers Replay at once, as the bar does.
  await p.waitForTimeout(4000);
  if ((await state()).play !== "Replay") problems.push(`at the end the button reads "${(await state()).play}", not Replay`);
  if (p.external.length || p.errors.length) problems.push(`requests ${p.external.join(", ")} errors ${p.errors.join(" | ")}`);
  await p.context().close();
  result("play", problems, `starts as the guide closes, step 1 for ${took.toFixed(1)} s, pauses on Space and a chosen step, holds behind the guide, at the decision and the drafts, ends on Replay`);
}

// ---- turn: the bar that asks ---------------------------------------------------------------------------
if (run("turn")) {
  const problems = [];
  const expectTurn = async (p, where, ms = 1500) => {
    await p.waitForTimeout(ms);
    const b = await bar(p);
    const primaries = b.buttons.filter((x) => x.primary);
    const outside = await p.evaluate(() => [...document.querySelectorAll("button.vc-button")].filter((x) => !x.closest("#move, dialog") && x.getClientRects().length && !/vc-button--(secondary|ghost|outline|danger)/.test(x.className)).map((x) => x.innerText.trim()));
    if (!/^Your turn\./.test(b.text)) problems.push(`${where}: the bar says "${b.text.slice(0, 80)}"`);
    if (primaries.length !== 1 || !primaries[0].attention) problems.push(`${where}: ${primaries.length} primary actions, attention ${primaries[0]?.attention}`);
    if (outside.length) problems.push(`${where}: a primary button outside the bar: ${outside.join(", ")}`);
    if (!b.visible) problems.push(`${where}: the bar is out of view`);
    const under = await underBar(p);
    if (under) problems.push(`${where}: story content under the bar (${under})`);
  };
  {
    const p = await openApp(browser, BASE, { query: "?guide=0&step=propose" });
    await expectTurn(p, "lead case, the decision");
    await p.click("#move button.vc-attention");
    await waitStep(p, "prepare");
    await expectTurn(p, "lead case, the drafts");
    await p.click("#move button.vc-attention");
    await p.waitForTimeout(800);
    const done = await bar(p);
    if (!/^Done\./.test(done.text) || done.buttons.some((x) => x.attention)) problems.push(`after the drafts the bar reads "${done.text}"`);
    await p.context().close();
  }
  {
    const p = await openApp(browser, BASE, { query: "?guide=0&step=check" });
    await expectTurn(p, "a link to step 2, paused", 7000);
    await p.context().close();
  }
  for (const sc of SCENARIOS) {
    const p = await openApp(browser, BASE, { query: `?guide=0&case=${slug(sc)}&step=propose` });
    if ((await current(p)) !== "propose") problems.push(`${sc.short}: ?step=propose shows ${await current(p)}`);
    else await expectTurn(p, `${sc.short}, the decision`);
    if (p.errors.length) problems.push(`${sc.short}: ${p.errors.join(" | ")}`);
    await p.context().close();
  }
  result("turn", problems, `Your turn with one primary action and vc-attention at the decision and the drafts, on a paused link and at the decision of ${SCENARIOS.length} cases`);
}

// ---- cases: every decision path ------------------------------------------------------------------------
if (run("cases")) {
  const problems = [];
  let screens = 0;
  for (const sc of SCENARIOS) {
    for (const choice of [...REFERENCE_CASES[sc.id].finding.variants.map((v) => v.variant_id), "baseline"]) {
      const where = `${sc.short}, ${choice}`;
      const p = await openApp(browser, BASE, { query: `?guide=0&case=${slug(sc)}&step=propose` });
      const before = await p.evaluate(() => document.querySelector('[data-vc-kpi="Rebate at stake"] .kpi-value').textContent.trim());
      await p.click(`[data-option="${choice}"] button[data-action="approve"]`);
      await waitStep(p, "prepare").catch(() => problems.push(`${where}: the decision did not lead to Prepare`));
      await p.waitForTimeout(300);
      for (let k = 0; k < 3; k++) { const a = p.locator("#move button.vc-attention"); if (!(await a.count())) break; await a.first().click(); await p.waitForTimeout(400); }
      const after = await p.evaluate(() => ({
        tile: document.querySelector('[data-vc-kpi="Rebate at stake"] .kpi-value').innerText.replace(/\s+/g, " ").trim(),
        was: document.querySelector('[data-vc-kpi="Rebate at stake"] .vc-stat__was')?.textContent.trim() || null,
        drafts: [...document.querySelectorAll(".draft")].map((d) => d.dataset.status), log: document.querySelectorAll(".log li").length, bar: document.querySelector("#move").innerText
      }));
      if (choice !== "baseline" && after.was !== before) problems.push(`${where}: the stake tile does not strike through ${before} (${after.tile})`);
      if (after.drafts.some((x) => x !== "approved")) problems.push(`${where}: drafts left ${after.drafts.join(", ")}`);
      if (after.log < 1 + after.drafts.length) problems.push(`${where}: ${after.log} log entries`);
      if (!/Nothing was sent|nothing goes to/i.test(after.bar)) problems.push(`${where}: the end does not say nothing was sent`);
      for (const [i] of ["spot", "check", "calculate", "propose", "prepare"].entries()) {
        await p.click(`#steps .vc-step:nth-child(${i + 1}) .vc-step__button`);
        await p.waitForTimeout(120);
        await p.evaluate(() => document.querySelectorAll("details").forEach((d) => { d.open = true; }));
        const text = await p.evaluate(() => document.body.innerText);
        screens += 1;
        const id = text.match(ID);
        if (id) problems.push(`${where}, step ${i + 1}: record id ${id[1]} on screen`);
        if (/\b(undefined|NaN|null)\b|\{\{/.test(text)) problems.push(`${where}, step ${i + 1}: a broken word on screen`);
      }
      if (p.external.length || p.errors.length) problems.push(`${where}: requests ${p.external.join(", ")} errors ${p.errors.join(" | ")}`);
      await p.context().close();
    }
  }
  result("cases", problems, `${screens} screens of ${SCENARIOS.length} cases on every decision path: tiles moved, drafts approved, logged, nothing sent, no record id`);
}

// ---- keeps: the race, the AI notice, nothing sent, the log ----------------------------------------------
if (run("keeps")) {
  const problems = [];
  const p = await openApp(browser, BASE, { query: "?guide=0&step=calculate" });
  const race = await p.evaluate(() => [...document.querySelectorAll(".race .race-row")].map((r) => ({ text: r.innerText.replace(/\s+/g, " "), counted: r.querySelectorAll(".seg--counted").length, missed: r.querySelectorAll(".seg--missed").length, tiers: r.querySelectorAll(".race-tier").length, first: r.querySelectorAll(".race-first").length })));
  const closed = race.find((r) => /Closed year/.test(r.text));
  if (!closed || closed.counted !== 2 || closed.missed !== 3 || closed.tiers !== 1 || closed.first !== 1 || !/€52\.4M/.test(closed.text) || !/€1,048,000/.test(closed.text)) problems.push(`the closed year's race reads ${JSON.stringify(closed)}`);
  const live = await p.evaluate(() => [...document.querySelectorAll("[data-vc-live]")].map((el) => ({ id: el.id, notice: [...el.parentElement.children].some((x) => x.matches(".vc-tag--feature") && /You are interacting with an AI system/.test(x.textContent)) })));
  if (live.length < 2 || live.some((l) => !l.notice)) problems.push(`live controls and their notices: ${JSON.stringify(live)}`);
  await p.click("#steps .vc-step:nth-child(4) .vc-step__button");
  await p.click("#move button.vc-attention");
  await p.waitForSelector(".draft", { timeout: 10000 });
  await p.waitForTimeout(300);
  const pending = await p.evaluate(() => [...document.querySelectorAll(".draft")].map((d) => d.dataset.status));
  if (!pending.length || pending.some((x) => x !== "pending")) problems.push(`the drafts do not wait: ${pending.join(", ")}`);
  await p.click("#move button.vc-attention");
  await p.waitForTimeout(600);
  await p.evaluate(() => { document.querySelector(".log").open = true; });
  const log = await p.evaluate(() => [...document.querySelectorAll(".log li")].map((li) => ({ text: li.innerText.trim(), time: !!li.querySelector("time") })));
  if (log.length < 3 || log.some((l) => !l.time) || !/approved option A/.test(log[0]?.text || "")) problems.push(`the log reads ${JSON.stringify(log)}`);
  if (p.external.length || p.errors.length) problems.push(`requests ${p.external.join(", ")} errors ${p.errors.join(" | ")}`);
  await p.context().close();
  result("keeps", problems, "the threshold race with the first estimate, the AI notice beside both live controls, drafts that wait, nothing sent, a log with times");
}

// ---- layout: two sizes, two themes ----------------------------------------------------------------------
if (run("layout")) {
  const problems = [];
  for (const [width, height] of [[1920, 1080], [1280, 720]]) {
    for (const dark of [false, true]) {
      const at = `${width}x${height} ${dark ? "dark" : "light"}`;
      const p = await openApp(browser, BASE, { width, height, dark, query: "?guide=0" });
      if ((await p.evaluate(() => document.documentElement.dataset.theme)) !== (dark ? "dark" : "light")) problems.push(`${at}: the theme is not ${dark ? "dark" : "light"}`);
      for (const [i, id] of ["spot", "check", "calculate", "propose", "prepare"].entries()) {
        if (id === "prepare") { await p.click("#move button.vc-attention"); await waitStep(p, "prepare"); await p.waitForTimeout(500); }
        else { await p.click(`#steps .vc-step:nth-child(${i + 1}) .vc-step__button`); await p.waitForTimeout(350); }
        const r = await p.evaluate(() => {
          const out = [];
          if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`the page is ${document.documentElement.scrollWidth} px wide`);
          if (document.documentElement.scrollHeight > innerHeight + 1) out.push(`the page scrolls to ${document.documentElement.scrollHeight} px`);
          const visible = (el) => { const cs = getComputedStyle(el); return el.getClientRects().length && cs.visibility !== "hidden" && cs.display !== "none" && !el.closest("dialog:not([open]), [hidden], .vc-visually-hidden, details:not([open]) > :not(summary)"); };
          for (const el of document.querySelectorAll("body *")) {
            if (!visible(el) || el.closest("dialog, svg") || el.matches("script, style")) continue;
            if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
            const cs = getComputedStyle(el);
            const size = parseFloat(cs.fontSize);
            if (size < 12) out.push(`${size} px text: "${el.textContent.trim().slice(0, 40)}"`);
            if ((cs.overflowX === "hidden" || cs.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 1) out.push(`cut off: "${el.textContent.trim().slice(0, 40)}"`);
            if (el.closest("#story") && !el.closest("#move, .vc-tag, .log, figcaption") && size < 14) out.push(`story text at ${size} px: "${el.textContent.trim().slice(0, 40)}"`);
          }
          for (const el of document.querySelectorAll("main *")) if (visible(el) && el.getBoundingClientRect().right > innerWidth + 1) { out.push(`spills past the window: ${el.className || el.tagName}`); break; }
          const m = document.querySelector("#move").getBoundingClientRect();
          if (m.bottom > innerHeight + 1 || m.top < 0) out.push("the bar is out of view");
          return [...new Set(out)];
        });
        for (const x of r) problems.push(`${at}, ${id}: ${x}`);
        const under = await underBar(p);
        if (under) problems.push(`${at}, ${id}: story content under the bar (${under})`);
        await p.screenshot({ path: path.join(OUT, `${width}-${dark ? "dark" : "light"}-${i + 1}-${id}.png`) });
      }
      if (p.external.length || p.errors.length) problems.push(`${at}: requests ${p.external.join(", ")} errors ${p.errors.join(" | ")}`);
      await p.context().close();
    }
  }
  result("layout", problems, `five steps at 1920 × 1080 and 1280 × 720, light and dark: nothing overflows, no cut-off or small text, the bar in view; screenshots in ${OUT}`);
}

await browser.close();
await close();
const failed = results.filter((r) => r.problems.length);
console.log(`\n${results.length - failed.length} of ${results.length} showcase cases passed.`);
if (failed.length) process.exit(1);
console.log("SHOWCASE OK");
