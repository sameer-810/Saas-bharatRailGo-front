/**
 * Screenshots for the user guide (docs/user-guide), with the exact position of
 * every element a step refers to — the guide draws numbered markers there.
 *
 * Same stack as `npm run verify`: real web build, real API, in-memory database
 * with the showcase data. Waits for animations to settle before each capture.
 *
 *   node tools/captureGuide.mjs            (SKIP_EXPORT=1 reuses dist/)
 *
 * Output: ../docs/user-guide/shots/*.png + shots.json
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startStack, WEB, API, CREDS } from "./devStack.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONT = path.resolve(HERE, "..");
const OUT = path.resolve(FRONT, "..", "docs", "user-guide", "shots");
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
const shots = {};

async function api(method, url, { token, body, admin } = {}) {
  const res = await fetch(`${API}${admin ? "/admin" : ""}${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok)
    throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(json)}`);
  return json?.data;
}

const settle = (page, ms = 900) =>
  page
    .waitForLoadState("networkidle")
    .catch(() => {})
    .then(() => page.waitForTimeout(ms));

/** Locator for a mark: "#testid" or "text=Some text". Only visible elements. */
function locate(page, mark) {
  if (mark.startsWith("#"))
    return page
      .locator(`[data-testid="${mark.slice(1)}"] >> visible=true`)
      .first();
  if (mark.startsWith("text="))
    return page
      .getByText(mark.slice(5), { exact: false })
      .locator("visible=true")
      .first();
  return page.locator(mark).first();
}

async function capture(page, name, marks = []) {
  await settle(page, 700);
  const vp = page.viewportSize();
  const boxes = [];
  for (const m of marks) {
    const box = await locate(page, m)
      .boundingBox({ timeout: 8000 })
      .catch(() => null);
    if (!box) throw new Error(`${name}: mark not found → ${m}`);
    const hidden = box.y < -2 || box.y > vp.height - 8 || box.x > vp.width - 8;
    if (hidden)
      console.log(
        `  ! ${name}: mark ${marks.indexOf(m) + 1} (${m}) is off-screen — not drawn`,
      );
    boxes.push({
      hidden,
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      w: box.width,
      h: box.height,
    });
  }
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(OUT, file) });
  shots[name] = { file, width: vp.width, height: vp.height, marks: boxes };
  console.log(`  ✓ ${name}${marks.length ? ` (${marks.length} marks)` : ""}`);
}

/** Scroll an element (by testid) to the middle of its scroll container. */
async function scrollTo(page, testId) {
  await page
    .locator(`[data-testid="${testId}"] >> visible=true`)
    .first()
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(500);
}

async function newPage(
  viewport = { width: 1440, height: 900 },
  colorScheme = "light",
) {
  const context = await browser.newContext({ viewport, colorScheme });
  return context.newPage();
}

async function loginApp(page, creds) {
  await page.goto(WEB + "/login");
  await page.waitForSelector('[data-testid="login-email"]', { timeout: 30000 });
  await page.fill('[data-testid="login-email"]', creds.email);
  await page.fill('[data-testid="login-password"]', creds.password);
  await page.click('[data-testid="login-submit"]');
  await page.waitForSelector('[data-testid="topbar"]', { timeout: 30000 });
}

async function visit(page, url) {
  await page.goto(WEB + url);
  await settle(page, 1200);
}

try {
  const ownerToken = (await api("POST", "/auth/login", { body: CREDS.owner }))
    .accessToken;
  const first = async (url) =>
    (await api("GET", url, { token: ownerToken }))?.[0];
  const party = await first("/parties?limit=1&search=Krishna");
  const pod = await first("/pods?limit=1");
  const invoices = await api("GET", "/invoices?limit=20", {
    token: ownerToken,
  });
  const draft = invoices.find((i) => i.status === "draft") || invoices[0];
  const booking = await first("/consignments?limit=1");

  // ── Sign-in & signup ─────────────────────────────────────────────
  console.log("• sign-in pages");
  let page = await newPage();
  await visit(page, "/login");
  await page.fill('[data-testid="login-email"]', CREDS.owner.email);
  await capture(page, "app-login", [
    "#login-email",
    "#login-password",
    "#login-submit",
  ]);
  await visit(page, "/signup");
  await capture(page, "app-signup", [
    "#signup-businessName",
    "#signup-gstin",
    "#signup-email",
    "#signup-submit",
  ]);

  // ── Platform console (super admin) ───────────────────────────────
  console.log("• platform console");
  await visit(page, "/admin");
  await page.fill('[data-testid="admin-email"]', CREDS.admin.email);
  await capture(page, "admin-login", [
    "#admin-email",
    "#admin-password",
    "#admin-login-submit",
  ]);
  await page.fill('[data-testid="admin-password"]', CREDS.admin.password);
  await page.click('[data-testid="admin-login-submit"]');
  await page.waitForSelector('[data-testid="admin-nav-AdminOrgs"]', {
    timeout: 30000,
  });
  await settle(page, 1800); // revenue board flaps
  await capture(page, "admin-overview", [
    "#admin-revenue-board",
    "#admin-kpi-pending",
    "#admin-pending-list",
  ]);
  await page.click('[data-testid="admin-nav-AdminOrgs"]');
  await settle(page);
  await capture(page, "admin-agencies", [
    "#admin-orgs-filters",
    "text=Maa Durga Roadlines",
  ]);
  const adminToken = (
    await api("POST", "/auth/login", { admin: true, body: CREDS.admin })
  ).accessToken;
  const orgs = await api("GET", "/organizations?limit=50", {
    admin: true,
    token: adminToken,
  });
  const pending = orgs.find((o) => o.approvalStatus === "pending");
  const demo = orgs.find((o) => /Shree Ganesh/.test(o.name));
  await visit(page, `/admin/organizations/${pending.id}`);
  await capture(page, "admin-agency-pending", [
    "#admin-org-approve",
    "text=Reject",
    "text=Terms accepted",
  ]);
  await visit(page, `/admin/organizations/${demo.id}`);
  await scrollTo(page, "admin-usage-bookings");
  await capture(page, "admin-agency-subscription", [
    "#admin-org-sub-change-plan",
    "#admin-usage-bookings",
    "#admin-org-extend-7",
  ]);
  await scrollTo(page, "admin-org-suspend");
  await capture(page, "admin-agency-controls", [
    "#admin-limits-maxUsers",
    "#admin-org-suspend",
    "#admin-org-revoke-sessions",
  ]);
  await page.click('[data-testid="admin-nav-AdminPlans"]');
  await settle(page);
  await capture(page, "admin-plans", [
    "#admin-plan-new",
    "#admin-plan-edit-growth",
  ]);
  await page.click('[data-testid="admin-nav-AdminBackups"]');
  await settle(page);
  await capture(page, "admin-backups", [
    "#admin-backup-run",
    "#admin-backup-drive-warning",
  ]);
  await page.click('[data-testid="admin-nav-AdminAudit"]');
  await settle(page);
  await capture(page, "admin-audit", ["#admin-audit-action-chips"]);
  await page.context().close();

  // ── Agency app — owner, desktop ──────────────────────────────────
  console.log("• agency app (owner)");
  page = await newPage();
  await loginApp(page, CREDS.owner);
  await settle(page, 2200); // departure board flaps
  await capture(page, "home", [
    "#home-new-booking",
    "#money-strip",
    "#departure-board",
    "#branch-switcher",
    "#open-command-palette",
  ]);
  await page.keyboard.press("Control+k");
  await page.fill('[data-testid="command-input"]', "krishna");
  await settle(page, 600);
  await capture(page, "command-palette", ["#command-input"]);
  await page.keyboard.press("Escape");

  await visit(page, "/bookings");
  await capture(page, "bookings", [
    "#quick-entry-input",
    "#bookings-filters-toggle",
    "#bookings-daily-summary",
    "#bookings-loading-list",
    "#booking-new",
  ]);
  await visit(page, "/bookings/new");
  await page.fill(
    '[data-testid="quick-entry-input"]',
    "NDLS 3pkg 60kg Ramesh topay 1550",
  );
  await settle(page, 500);
  await capture(page, "booking-quick", [
    "#quick-entry-input",
    "#quick-entry-preview",
    "#quick-entry-continue",
  ]);
  await page.click('[data-testid="quick-entry-continue"]');
  await settle(page);
  await scrollTo(page, "booking-suggest");
  await page.click('[data-testid="booking-suggest"]');
  await page.waitForTimeout(4200); // let the toast fade
  await scrollTo(page, "booking-save");
  await capture(page, "booking-charges", [
    "#booking-quote-lines",
    "#booking-total",
    "#booking-save",
  ]);

  await visit(page, `/bilti/${pod.id}`);
  await capture(page, "bilti-detail", [
    "#bilti-board",
    "text=Delivery status",
    "#bilti-pdf",
    "#bilti-whatsapp",
  ]);
  await visit(page, "/bilti/new");
  await capture(page, "bilti-new", [
    "#bilti-date",
    "#bilti-party",
    "#bilti-save",
  ]);

  await visit(page, `/parties/${party.id}`);
  await capture(page, "party", [
    "#party-outstanding",
    "#party-quick-actions",
    "#party-whatsapp",
    "text=Ledger",
  ]);

  await visit(page, `/payments/new?partyId=${party.id}`);
  await capture(page, "payment-new", [
    "#payment-party",
    "#payment-amount",
    "#payment-mode",
    "#payment-save",
  ]);

  await visit(page, `/invoices/${draft.id}`);
  await capture(page, "invoice", [
    "#invoice-draft-banner",
    "#invoice-add-consignments",
    "#invoice-totals",
    "#invoice-finalize",
    "#invoice-pdf",
  ]);

  await visit(page, "/reports");
  await capture(page, "reports", ["#reports-hub"]);
  await visit(page, "/reports/daily");
  await capture(page, "report-daily", [
    "text=This month",
    "text=Export Excel",
    "#daily-chart",
  ]);
  await visit(page, "/reports/outstanding");
  await capture(page, "report-outstanding", [
    "#aging-summary",
    "#outstanding-list",
  ]);

  await visit(page, "/settings/branches");
  await capture(page, "branches", ["#branch-add", "#branch-card-DEL"]);
  await visit(page, "/settings/team");
  await capture(page, "team", ["#team-add", "#team-list"]);
  await visit(page, "/settings");
  await capture(page, "settings", [
    "#settings-card-business",
    "#settings-card-branding",
    "#settings-card-team",
    "#settings-card-rates",
    "#backup-card",
  ]);
  await visit(page, "/settings/branding");
  await capture(page, "branding", [
    "#branding-logo-upload",
    "#branding-color-card",
    "#branding-theme",
  ]);
  await visit(page, "/settings/rates");
  await capture(page, "rates", []);
  await visit(page, "/settings/plan");
  await capture(page, "plan", ["#plan-current", "#plan-usage", "#plan-list"]);
  await visit(page, "/settings/activity");
  await capture(page, "activity", [
    "#activity-search",
    "#activity-person",
    "#activity-groups",
    "#activity-list",
  ]);
  await visit(page, "/settings/privacy");
  await capture(page, "privacy", [
    "#privacy-export",
    "#privacy-consent-card",
    "#privacy-deletion-card",
  ]);
  await visit(page, `/bookings/${booking.id}`);
  await capture(page, "booking-detail", []);
  await page.context().close();

  // Dark theme
  page = await newPage({ width: 1440, height: 900 }, "dark");
  await loginApp(page, CREDS.owner);
  await settle(page, 2200);
  await capture(page, "home-dark", []);
  await page.context().close();

  // Phone
  console.log("• phone");
  page = await newPage({ width: 390, height: 844 });
  await loginApp(page, CREDS.owner);
  await settle(page, 2200);
  await capture(page, "phone-home", ["#tabbar"]);
  await visit(page, "/bookings");
  await capture(page, "phone-bookings", []);
  await page.context().close();

  // Branch staff
  console.log("• branch staff");
  page = await newPage();
  await loginApp(page, CREDS.staff);
  await visit(page, "/bookings");
  await capture(page, "staff-bookings", ["#sidebar", "#bookings-count"]);
  await page.context().close();
} finally {
  writeFileSync(path.join(OUT, "shots.json"), JSON.stringify(shots, null, 2));
  await browser.close();
  await stack.stop();
}
console.log(`\n${Object.keys(shots).length} screenshots → ${OUT}`);
