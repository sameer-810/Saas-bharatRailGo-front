/**
 * Phase 4 gate — drives the real web build against the real API with Playwright.
 *
 *   1. expo export (web) with EXPO_PUBLIC_API_URL → dist/
 *   2. devStack: in-memory MongoDB + seeded API + static server
 *   3. flows per role / viewport, a screenshot per check
 *   4. verify-evidence/phase4/results.json + PASS/FAIL summary (exit 1 on failure)
 *
 * Usage: npm run verify            (SKIP_EXPORT=1 to reuse dist/)
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startStack, WEB, API, CREDS } from "./devStack.mjs";
import { flows } from "./verifyFlows.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONT = path.resolve(HERE, "..");
const OUT = process.env.OUT || path.resolve(FRONT, "..", "verify-evidence", "phase4");
mkdirSync(OUT, { recursive: true });

if (!process.env.SKIP_EXPORT) {
  console.log("• exporting web build…");
  execSync("npx expo export -p web --output-dir dist --clear", {
    cwd: FRONT,
    stdio: "ignore",
    env: { ...process.env, CI: "1", EXPO_PUBLIC_API_URL: API },
  });
}

const stack = await startStack({ log: (...a) => console.log(...a) });
const browser = await chromium.launch();
const results = [];
let shot = 0;

/** Context passed to every flow. */
function makeCtx(page, pageErrors) {
  const ctx = {
    page,
    WEB,
    API,
    CREDS,
    pageErrors,
    async check(name, fn) {
      const started = Date.now();
      const errorsBefore = pageErrors.length;
      let ok = true;
      let error = null;
      try {
        await fn();
        if (pageErrors.length > errorsBefore) {
          throw new Error(`page error: ${pageErrors.slice(errorsBefore).join(" | ").slice(0, 400)}`);
        }
      } catch (e) {
        ok = false;
        error = String(e?.message || e).split("\n")[0].slice(0, 500);
      }
      const file = `${String(++shot).padStart(3, "0")}-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
      await page.screenshot({ path: path.join(OUT, file), fullPage: false }).catch(() => undefined);
      results.push({ name, ok, error, screenshot: file, ms: Date.now() - started });
      console.log(`${ok ? "PASS" : "FAIL"}  ${name}${error ? `  — ${error}` : ""}`);
      return ok;
    },
    /** Navigate by URL and wait for the screen to settle. */
    async visit(urlPath) {
      await page.goto(WEB + urlPath);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await page.waitForTimeout(400);
    },
    async login(creds) {
      await page.goto(WEB + "/login");
      await page.waitForSelector('[data-testid="login-email"]', { timeout: 30000 });
      await page.fill('[data-testid="login-email"]', creds.email);
      await page.fill('[data-testid="login-password"]', creds.password);
      await page.click('[data-testid="login-submit"]');
      await page.waitForSelector('[data-testid="topbar"]', { timeout: 30000 });
    },
    async logout() {
      await page.evaluate(() => localStorage.clear());
    },
    /** Direct API call as a user (for fixtures / cross-checks). */
    async api(method, url, { token, body } = {}) {
      const res = await fetch(API + url, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(json)}`);
      return json?.data;
    },
    async tokenFor(creds) {
      return (await ctx.api("POST", "/auth/login", { body: creds })).accessToken;
    },
    async adminToken() {
      return (await ctx.api("POST", "/admin/auth/login", { body: CREDS.admin })).accessToken;
    },
    // The navigation stack keeps previous screens mounted (hidden), so every
    // lookup is restricted to VISIBLE elements.
    async expectVisible(testId, timeout = 15000) {
      await page.locator(`[data-testid="${testId}"] >> visible=true`).first().waitFor({ timeout });
    },
    async expectText(text, timeout = 15000) {
      await page.getByText(text, { exact: false }).locator("visible=true").first().waitFor({ timeout });
    },
    async expectNoPlaceholder() {
      const n = await page.locator(`[data-testid="placeholder"] >> visible=true`).count();
      if (n) throw new Error("screen still shows the placeholder");
    },
  };
  return ctx;
}

try {
  for (const flow of flows) {
    const context = await browser.newContext({ viewport: flow.viewport || { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const text = m.text();
      // Expected 4xx from deliberate negative checks are not page errors.
      if (/Failed to load resource: the server responded with a status of 4\d\d/.test(text)) return;
      pageErrors.push(text);
    });
    console.log(`\n── ${flow.name}`);
    try {
      await flow.run(makeCtx(page, pageErrors));
    } catch (e) {
      results.push({ name: `${flow.name} (flow crashed)`, ok: false, error: String(e?.message || e).slice(0, 500) });
      console.log(`FAIL  ${flow.name} crashed — ${e?.message}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
  await stack.stop();
}

const failed = results.filter((r) => !r.ok);
writeFileSync(
  path.join(OUT, "results.json"),
  JSON.stringify({ at: new Date().toISOString(), total: results.length, failed: failed.length, results }, null, 2),
);
console.log(`\n${results.length - failed.length}/${results.length} checks passed — evidence in ${OUT}`);
process.exit(failed.length ? 1 : 0);
