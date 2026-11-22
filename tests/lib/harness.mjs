// Shared test harness: finds Playwright, serves the app folder over HTTP and opens the page. The page
// loads nothing from a third party and reaches only api.anthropic.com, and only in a live run, so every
// external request in a test is either answered by the stand-in API or blocked.
import { createRequire } from "node:module";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { readFile, mkdir } from "node:fs/promises";

/** The app folder: the parent of tests/. */
export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2",
  ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8"
};

export const CORS = { "access-control-allow-origin": "*", "access-control-expose-headers": "*" };

/** Case names given on the command line (empty: run all cases). */
export const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("--"));
export const wanted = (name) => ONLY.length === 0 || ONLY.includes(name);

/** Where screenshots, downloads and result files go (outside the app folder by default). */
export async function outDir(suite) {
  const dir = path.join(process.env.RH_TEST_OUT || path.join(os.tmpdir(), "rebate-hunter-tests"), suite);
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Playwright is not part of the app. Install it once, globally or in any folder:
 *   npm install -g playwright && npx playwright install chromium
 * and run with NODE_PATH="$(npm root -g)", or point PLAYWRIGHT_MODULE at its folder.
 */
export function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core"].filter(Boolean);
  for (const c of candidates) {
    try { return require(c); } catch { /* try the next one */ }
  }
  console.error("Playwright was not found. Install it with `npm install -g playwright` and `npx playwright install chromium`,\nthen run the tests with NODE_PATH=\"$(npm root -g)\" (or set PLAYWRIGHT_MODULE to the playwright folder).");
  process.exit(2);
}

/** Chromium from Playwright, or the browser at CHROME_PATH. */
export async function launchBrowser() {
  const { chromium } = loadPlaywright();
  return chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
}

/**
 * Serves `root` on 127.0.0.1:`port` (0: any free port). Paths in `blockLocal` (prefixes) answer 404,
 * to simulate a missing file. Returns { base, blockLocal, close }.
 */
export async function serveStatic(root, port) {
  const blockLocal = new Set();
  const server = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(root, path.normalize(p));
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    if ([...blockLocal].some((b) => p.startsWith(b))) { res.writeHead(404); res.end("blocked by test"); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404); res.end("not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return { base: `http://127.0.0.1:${server.address().port}/`, blockLocal, close: () => new Promise((r) => server.close(r)) };
}

/** Console noise that blocked external requests cause in every test. */
export const NETWORK_NOISE = /Failed to load resource|net::ERR_|ERR_BLOCKED_BY_CLIENT|ERR_FAILED/;

/** A key-shaped string that is obviously not a real key. */
export const MOCK_KEY = "sk-ant-test-MOCKKEY-0123456789abcdefghijklmnopqrstuvwxyz0123456789";

/** Browser storage key of the session's API key (js/config.js STORAGE.apiKey): sessionStorage only. */
export const KEYS = { apiKey: "rh.anthropic.key" };

/** --require-vici (or GitHub Actions): a missing ViciDesign checkout fails instead of skipping. */
export const REQUIRE_VICI = process.argv.includes("--require-vici") || process.env.GITHUB_ACTIONS === "true";

/** A ViciDesign checkout: the folder in VICI_DIR, or ../ViciDesign next to this repository. */
export function viciDir() {
  return [process.env.VICI_DIR, path.resolve(APP_ROOT, "..", "ViciDesign"), path.resolve(APP_ROOT, "..", "vicidesign")].filter(Boolean).find((d) => existsSync(path.join(d, "scripts", "lib", "guide.mjs"))) || null;
}

/**
 * A page of the app in a fresh browser context: every request to another host is aborted and listed
 * in page.external, page errors and console errors in page.errors. dark: the visitor's dark choice,
 * made before the page loads (the page opens light otherwise). Waits until the case has played up to
 * the person's first decision (html[data-boot="ready"]).
 */
export async function openApp(browser, base, { width = 1280, height = 720, dark = false, query = "", route = null } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  if (dark) await context.addInitScript(() => { try { localStorage.setItem("vc-theme", "dark"); } catch { /* no storage */ } });
  const page = await context.newPage();
  page.external = [];
  page.errors = [];
  const origin = new URL(base).origin;
  await context.route("**/*", async (r) => {
    const u = r.request().url();
    if (u.startsWith(origin) || u.startsWith("data:") || u.startsWith("blob:")) return r.continue();
    if (route && (await route(r))) return;
    page.external.push(u);
    return r.abort("blockedbyclient");
  });
  page.on("pageerror", (e) => page.errors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) page.errors.push(m.text()); });
  await page.goto(base + query);
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  return page;
}
