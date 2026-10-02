/**
 * Raw screens for the Play Store / App Store screenshots — real captures of the
 * running app with the showcase data (never mock-ups, never empty states).
 *
 *   node tools/captureStoreScreens.mjs        (SKIP_EXPORT=1 reuses dist/)
 *
 * Output: store-assets/raw-screens/        phone   390×844  @3x
 *         store-assets/raw-screens-tablet/ tablet  800×1280 @2x
 * Then:   node tools/makeStoreAssets.mjs   composes the listing images.
 */
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startStack, WEB, API, CREDS } from "./devStack.mjs";

const FRONT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(FRONT, "store-assets");

const DEVICES = {
  phone: { dir: "raw-screens", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  tablet: { dir: "raw-screens-tablet", viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

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

async function api(method, url, { token, body } = {}) {
  const res = await fetch(API + url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(json)}`);
  return json?.data;
}

const settle = (page, ms = 900) =>
  page
    .waitForLoadState("networkidle")
    .catch(() => {})
    .then(() => page.waitForTimeout(ms));

try {
  const token = (await api("POST", "/auth/login", { body: CREDS.owner })).accessToken;
  const first = async (url) => (await api("GET", url, { token }))?.[0];
  const party = await first("/parties?limit=1&search=Krishna");
  const pod = await first("/pods?limit=1");
  const invoices = await api("GET", "/invoices?limit=20", { token });
  const invoice = invoices.find((i) => i.status !== "draft") || invoices[0];

  for (const [name, device] of Object.entries(DEVICES)) {
    console.log(`• ${name}`);
    const dir = path.join(OUT, device.dir);
    mkdirSync(dir, { recursive: true });
    const context = await browser.newContext({
      viewport: device.viewport,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
      colorScheme: "light",
    });
    const page = await context.newPage();
    // Scrollbars are a desktop-browser artefact; a phone does not show them.
    await context.addInitScript(() => {
      const s = document.createElement("style");
      s.textContent = "*::-webkit-scrollbar{display:none}*{scrollbar-width:none}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s));
    });
    const shot = async (file) => {
      await settle(page, 700);
      await page.screenshot({ path: path.join(dir, `${file}.png`) });
      console.log(`  ✓ ${file}`);
    };
    const visit = async (url, ms = 1200) => {
      await page.goto(WEB + url);
      await settle(page, ms);
    };

    await page.goto(WEB + "/login");
    await page.waitForSelector('[data-testid="login-email"]', { timeout: 30000 });
    await page.fill('[data-testid="login-email"]', CREDS.owner.email);
    await page.fill('[data-testid="login-password"]', CREDS.owner.password);
    await page.click('[data-testid="login-submit"]');
    await page.waitForSelector('[data-testid="topbar"]', { timeout: 30000 });
    await settle(page, 2400); // departure-board flaps settle
    await shot("board");

    await visit("/bookings/new");
    await page.fill('[data-testid="quick-entry-input"]', "NDLS 3pkg 60kg Ramesh topay 1550");
    await shot("quick-entry");

    await visit("/bookings");
    await shot("bookings");

    await visit(`/bilti/${pod.id}`);
    await shot("bilti");

    await visit(`/parties/${party.id}`);
    await shot("ledger");

    await visit(`/payments/new?partyId=${party.id}`);
    await page.fill('[data-testid="payment-amount"]', "2500");
    await shot("payment");

    await visit(`/invoices/${invoice.id}`);
    await shot("invoice");

    // At tablet width the daily table's nine columns are cramped; the reports
    // overview is the cleaner picture there.
    await visit(name === "tablet" ? "/reports" : "/reports/daily");
    await shot("reports");

    await visit("/settings/activity");
    await shot("activity");

    await context.close();

    // Dark departure board — the godown at night.
    const dark = await browser.newContext({ ...device, colorScheme: "dark" });
    const dp = await dark.newPage();
    await dp.goto(WEB + "/login");
    await dp.waitForSelector('[data-testid="login-email"]', { timeout: 30000 });
    await dp.fill('[data-testid="login-email"]', CREDS.owner.email);
    await dp.fill('[data-testid="login-password"]', CREDS.owner.password);
    await dp.click('[data-testid="login-submit"]');
    await dp.waitForSelector('[data-testid="topbar"]', { timeout: 30000 });
    await settle(dp, 2400);
    await dp.screenshot({ path: path.join(dir, "board-dark.png") });
    console.log("  ✓ board-dark");
    await dark.close();
  }
} finally {
  await browser.close();
  await stack.stop();
}
console.log(`\nraw screens → ${OUT}`);
