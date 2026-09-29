/**
 * UI flows for tools/verifyAll.mjs. Each flow gets a fresh browser context.
 * ctx: { page, check, visit, login, api, tokenFor, adminToken, expectVisible,
 *        expectText, expectNoPlaceholder, CREDS, WEB, API }
 */

const TODAY = new Date().toISOString().slice(0, 10);

/** Every tenant route; ":x" params are filled from live ids. */
const ROUTES = [
  ["Home", "/"],
  ["Bookings", "/bookings"],
  ["BookingNew", "/bookings/new"],
  ["BookingDetail", "/bookings/:consignment"],
  ["BookingEdit", "/bookings/:consignment/edit"],
  ["DailySummary", "/bookings/daily-summary"],
  ["LoadingList", "/bookings/loading-list"],
  ["Bilti", "/bilti"],
  ["BiltiNew", "/bilti/new"],
  ["BiltiDetail", "/bilti/:pod"],
  ["BiltiEdit", "/bilti/:pod/edit"],
  ["Parties", "/parties"],
  ["PartyNew", "/parties/new"],
  ["PartyDetail", "/parties/:party"],
  ["PartyEdit", "/parties/:party/edit"],
  ["Payments", "/payments"],
  ["PaymentNew", "/payments/new"],
  ["PaymentDetail", "/payments/:payment"],
  ["Invoices", "/invoices"],
  ["InvoiceNew", "/invoices/new"],
  ["InvoiceDetail", "/invoices/:invoice"],
  ["Reports", "/reports"],
  ["ReportDaily", "/reports/daily"],
  ["ReportOutstanding", "/reports/outstanding"],
  ["ReportStation", "/reports/station"],
  ["ReportGst", "/reports/gst"],
  ["Settings", "/settings"],
  ["SettingsBusiness", "/settings/business"],
  ["SettingsBranding", "/settings/branding"],
  ["Team", "/settings/team"],
  ["Branches", "/settings/branches"],
  ["Stations", "/settings/stations"],
  ["Rates", "/settings/rates"],
  ["Plan", "/settings/plan"],
  ["Activity", "/settings/activity"],
  ["Privacy", "/settings/privacy"],
  ["More", "/more"],
];

async function liveIds(ctx, token) {
  const first = async (url) => (await ctx.api("GET", url, { token }))?.[0]?.id;
  return {
    consignment: await first("/consignments?limit=1"),
    pod: await first("/pods?limit=1"),
    party: await first("/parties?limit=1"),
    payment: await first("/payments?limit=1"),
    invoice: await first("/invoices?limit=1"),
  };
}

/** Pick from a Combobox: open, type, click first matching option. */
async function pick(ctx, testId, query, optionValue) {
  const { page } = ctx;
  await page.click(`[data-testid="${testId}"]`);
  if (query) await page.fill(`[data-testid="${testId}-search"]`, query);
  const sel = optionValue
    ? `[data-testid="${testId}-option-${optionValue}"]`
    : `[data-testid^="${testId}-option-"]`;
  await page.locator(sel).first().waitFor({ timeout: 10000 });
  await page.locator(sel).first().click();
}

const businessFlow = {
  name: "Owner: core business flows through the UI",
  async run(ctx) {
    const { page } = ctx;
    await ctx.login(ctx.CREDS.owner);

    await ctx.check("quick entry parses a one-line booking", async () => {
      await ctx.visit("/bookings");
      await page.fill('[data-testid="quick-entry-input"]', "NDLS 3pkg 60kg Ramesh topay");
      await ctx.expectVisible("quick-entry-chip-destination");
      await ctx.expectVisible("quick-entry-chip-packages");
      await ctx.expectVisible("quick-entry-chip-weight");
      await ctx.expectVisible("quick-entry-chip-party");
      await ctx.expectVisible("quick-entry-chip-paymentMode");
    });
    await ctx.check("quick entry opens a pre-filled booking form", async () => {
      await page.click('[data-testid="quick-entry-continue"]');
      await page.waitForURL(/\/bookings\/new/, { timeout: 10000 });
      await ctx.expectVisible("booking-save");
      await ctx.expectText("Ramesh Traders");
    });
    await ctx.check("rate card suggests NDLS charges (15/kg + hamali + docket = ₹950)", async () => {
      await page.click('[data-testid="booking-suggest"]');
      await ctx.expectVisible("booking-quote-lines");
      await page.getByTestId("booking-total").getByText("950", { exact: false }).first().waitFor({ timeout: 10000 });
    });
    await ctx.check("booking saves and opens its detail", async () => {
      await page.click('[data-testid="booking-save"]');
      await page.waitForURL(/\/bookings\/[a-f0-9]{24}$/, { timeout: 15000 });
      await ctx.expectVisible("booking-route");
    });
    await ctx.check("delivery status can be advanced to Loaded", async () => {
      await page.click('[data-testid="booking-status-step-loaded"]');
      await ctx.expectVisible("toast-success");
    });

    await ctx.check("new bilti with prefix SG/ and status change", async () => {
      await ctx.visit("/bilti/new");
      await page.fill('[data-testid="bilti-consignorName"]', "Verify Sender");
      await page.fill('[data-testid="bilti-consigneeName"]', "Verify Receiver");
      await page.fill('[data-testid="bilti-packages"]', "2");
      await page.fill('[data-testid="bilti-chargeableWeight"]', "25");
      await pick(ctx, "bilti-destinationStation", "LKO", "LKO");
      await page.click('[data-testid="bilti-save"]');
      await ctx.expectVisible("bilti-number", 20000);
      await ctx.expectText("SG/");
      await page.click('[data-testid="bilti-step-loaded"]');
      await ctx.expectVisible("bilti-sms-result");
    });

    await ctx.check("payment shows a FIFO allocation preview and saves", async () => {
      await ctx.visit("/payments/new");
      await pick(ctx, "payment-party", "Ramesh");
      await page.fill('[data-testid="payment-amount"]', "500");
      await ctx.expectVisible("payment-preview");
      await page.click('[data-testid="payment-save"]');
      await ctx.expectVisible("payment-saved", 20000);
    });

    await ctx.check("invoice PDF opens", async () => {
      const token = await ctx.tokenFor(ctx.CREDS.owner);
      const inv = (await ctx.api("GET", "/invoices?status=sent&limit=1", { token }))[0];
      await ctx.visit(`/invoices/${inv.id}`);
      await ctx.expectVisible("invoice-pdf");
      const [popup] = await Promise.all([page.waitForEvent("popup", { timeout: 15000 }), page.click('[data-testid="invoice-pdf"]')]);
      await popup.close();
    });
  },
};

const billingFlow = {
  name: "Online billing (simulated Razorpay)",
  async run(ctx) {
    const { page } = ctx;
    await ctx.login(ctx.CREDS.owner);
    const token = await ctx.tokenFor(ctx.CREDS.owner);

    await ctx.check("plan cards list each limit once", async () => {
      await ctx.visit("/settings/plan");
      const text = await page.locator('[data-testid="plan-card-starter"] >> visible=true').first().innerText();
      const n = (text.match(/3 users/g) || []).length;
      if (n !== 1) throw new Error(`"3 users" appears ${n} times`);
      if (/1 branches/.test(text)) throw new Error("plural typo: 1 branches");
    });

    await ctx.check("plan screen offers online payment with GST breakdown", async () => {
      await ctx.visit("/settings/plan");
      await ctx.expectVisible("plan-pay-pro");
      await page.click('[data-testid="plan-pay-pro"]');
      await ctx.expectVisible("pay-dialog");
      await page.click('[data-testid="pay-cycle-yearly"]');
      await ctx.expectVisible("pay-breakdown");
      await ctx.expectText("CGST 9%");
    });

    let popup;
    await ctx.check("a declined payment is shown and can be retried", async () => {
      [popup] = await Promise.all([page.waitForEvent("popup"), page.click('[data-testid="pay-start"]')]);
      await popup.waitForSelector('[data-testid="fake-fail"]');
      await popup.click('[data-testid="fake-fail"]');
      await popup.close();
      await ctx.expectVisible("pay-failed", 20000);
    });

    await ctx.check("paying on retry activates Pro instantly", async () => {
      [popup] = await Promise.all([page.waitForEvent("popup"), page.click('[data-testid="pay-reopen"]')]);
      await popup.waitForSelector('[data-testid="fake-success"]');
      await popup.click('[data-testid="fake-success"]');
      await popup.close();
      await ctx.expectVisible("pay-success", 20000);
      const me = await ctx.api("GET", "/auth/me", { token });
      if (me.subscription.planCode !== "pro" || me.subscription.status !== "active") {
        throw new Error(`plan is ${me.subscription.planCode}/${me.subscription.status}`);
      }
    });

    await ctx.check("GST invoice appears in billing history and opens as PDF", async () => {
      await page.click('[data-testid="pay-done"]');
      await ctx.expectVisible("billing-history");
      const btn = page.locator('[data-testid^="billing-invoice-pdf-"] >> visible=true').first();
      await btn.waitFor({ timeout: 15000 });
      const [pdf] = await Promise.all([page.waitForEvent("popup"), btn.click()]);
      await pdf.close();
    });

    let autopayCheckout;
    await ctx.check("autopay can be set up", async () => {
      await ctx.visit("/settings/plan");
      await page.click('[data-testid="plan-pay-growth"]');
      await page.click('[data-testid="pay-mode-autopay"]');
      [popup] = await Promise.all([page.waitForEvent("popup"), page.click('[data-testid="pay-start"]')]);
      autopayCheckout = new URL(popup.url()).pathname;
      await popup.click('[data-testid="fake-success"]');
      await popup.close();
      await ctx.expectVisible("pay-success", 20000);
      await page.click('[data-testid="pay-done"]');
      await ctx.expectVisible("autopay-card");
    });

    await ctx.check("a failed renewal shows Payment due; a successful one clears it", async () => {
      const origin = new URL(ctx.API).origin;
      await fetch(`${origin}${autopayCheckout}/renewal_fail`, { method: "POST", redirect: "manual" });
      await ctx.visit("/settings/plan");
      await ctx.expectText("Payment due");
      await fetch(`${origin}${autopayCheckout}/renewal_success`, { method: "POST", redirect: "manual" });
      const me = await ctx.api("GET", "/auth/me", { token });
      if (me.subscription.status !== "active") throw new Error("still " + me.subscription.status);
    });

    await ctx.check("owner can stop autopay", async () => {
      await ctx.visit("/settings/plan");
      await page.click('[data-testid="autopay-stop"]');
      await page.click('[data-testid="confirm-ok"]');
      await ctx.expectVisible("toast-success");
      await page.waitForTimeout(800);
      if (await page.locator('[data-testid="autopay-card"] >> visible=true').count()) throw new Error("autopay still on");
    });
  },
};

/** Phase 7: activity log, a customer's DPDP requests, the owner's export + account deletion. */
const privacyFlow = {
  name: "Activity log + privacy (DPDP)",
  async run(ctx) {
    const { page } = ctx;
    const token = await ctx.tokenFor(ctx.CREDS.owner);
    await ctx.login(ctx.CREDS.owner);

    await ctx.check("activity log lists who did what", async () => {
      await ctx.expectVisible("nav-Activity");
      await page.click('[data-testid="nav-Activity"]');
      await ctx.expectVisible("activity-list");
      await ctx.expectText("Signed in");
      await ctx.expectText("Created a");
      await ctx.expectNoPlaceholder();
    });
    await ctx.check("activity log filters by kind of action", async () => {
      await page.click('[data-testid="activity-group-auth"]');
      await page.waitForTimeout(600);
      if (await page.getByText("Created a booking").count()) throw new Error("filter did not apply");
      await ctx.expectText("Signed in");
      await page.click('[data-testid="activity-group-all"]');
    });

    await ctx.check("a customer's data downloads from the party page", async () => {
      const party = (await ctx.api("GET", "/parties?limit=1", { token }))[0];
      await ctx.visit(`/parties/${party.id}`);
      await ctx.expectVisible("party-privacy");
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 15000 }),
        page.click('[data-testid="party-privacy-export"]'),
      ]);
      if (!/^customer-data-.*.json$/.test(download.suggestedFilename())) throw new Error(download.suggestedFilename());
    });
    await ctx.check("erasing a customer needs ERASE typed, then shows the erased banner", async () => {
      const p = await ctx.api("POST", "/parties", { token, body: { name: "Walk-in Privacy Test", mobile: "9844444444" } });
      await ctx.visit(`/parties/${p.id}`);
      await page.click('[data-testid="party-privacy-erase"]');
      await ctx.expectVisible("party-erase-dialog");
      if (await page.locator('[data-testid="party-erase-confirm"]').isEnabled()) throw new Error("erase enabled before typing");
      await page.fill('[data-testid="party-erase-type"]', "erase");
      await page.click('[data-testid="party-erase-confirm"]');
      await ctx.expectVisible("toast-success");
      await ctx.expectVisible("party-erased-banner");
      const after = await ctx.api("GET", `/parties/${p.id}`, { token });
      if (after.mobile || after.erasureMode !== "anonymised") throw new Error(JSON.stringify(after));
    });

    await ctx.check("owner downloads all agency data", async () => {
      await ctx.visit("/settings");
      await page.click('[data-testid="settings-card-privacy"]');
      await ctx.expectVisible("privacy-consent");
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 30000 }),
        page.click('[data-testid="privacy-export"]'),
      ]);
      if (!download.suggestedFilename().endsWith(".zip")) throw new Error(download.suggestedFilename());
    });
    await ctx.check("owner requests account deletion (password + confirm)", async () => {
      await page.fill('[data-testid="privacy-deletion-password"]', ctx.CREDS.owner.password);
      await page.fill('[data-testid="privacy-deletion-reason"]', "Verify run");
      await page.click('[data-testid="privacy-deletion-request"]');
      await page.click('[data-testid="confirm-ok"]');
      await ctx.expectVisible("privacy-deletion-banner");
    });
    await ctx.check("the request shows in the activity log", async () => {
      await ctx.visit("/settings/activity");
      await ctx.expectText("Requested account deletion");
    });

    await ctx.check("platform admin sees the deletion request; purge waits for the grace period", async () => {
      await ctx.logout();
      await ctx.visit("/admin");
      await page.fill('[data-testid="admin-email"]', ctx.CREDS.admin.email);
      await page.fill('[data-testid="admin-password"]', ctx.CREDS.admin.password);
      await page.click('[data-testid="admin-login-submit"]');
      await ctx.expectVisible("admin-nav-AdminOrgs");
      await page.click('[data-testid="admin-nav-AdminOrgs"]');
      await page.click('[data-testid="admin-orgs-filter-deletion"]');
      await ctx.expectText("Shree Ganesh Parcel Services");
      const me = await ctx.api("GET", "/auth/me", { token });
      await ctx.visit(`/admin/organizations/${me.organization.id}`);
      await ctx.expectVisible("admin-org-deletion-banner");
      if (await page.locator('[data-testid="admin-org-purge"]').isEnabled()) throw new Error("purge enabled inside the grace period");
    });

    await ctx.check("owner cancels the deletion", async () => {
      await ctx.visit("/admin");
      await ctx.login(ctx.CREDS.owner);
      await ctx.visit("/settings/privacy");
      await page.click('[data-testid="privacy-deletion-cancel"]');
      await ctx.expectVisible("toast-success");
      await ctx.expectVisible("privacy-deletion-card");
      const status = await ctx.api("GET", "/privacy/account", { token });
      if (status.deletion.requestedAt) throw new Error("still requested");
    });

    await ctx.check("staff see neither the activity log nor privacy settings", async () => {
      await ctx.logout();
      await ctx.login(ctx.CREDS.staff);
      await ctx.visit("/settings");
      await ctx.expectVisible("screen-title");
      for (const id of ["nav-Activity", "settings-card-activity", "settings-card-privacy"]) {
        if (await page.locator(`[data-testid="${id}"] >> visible=true`).count()) throw new Error(`${id} visible to staff`);
      }
    });
  },
};

export const flows = [
  {
    name: "Auth: sign in, errors, signup → review queue",
    async run(ctx) {
      const { page } = ctx;
      await ctx.check("login page with departure board", async () => {
        await ctx.visit("/login");
        await ctx.expectVisible("login-email");
        await ctx.expectText("DEPARTURES");
      });
      await ctx.check("wrong password shows an error", async () => {
        await page.fill('[data-testid="login-email"]', ctx.CREDS.owner.email);
        await page.fill('[data-testid="login-password"]', "wrong-password");
        await page.click('[data-testid="login-submit"]');
        await ctx.expectVisible("login-error");
      });
      await ctx.check("signup validates required fields and GSTIN", async () => {
        await page.click('[data-testid="go-signup"]');
        await ctx.expectVisible("signup-businessName");
        await page.fill('[data-testid="signup-gstin"]', "BADGSTIN");
        await page.click('[data-testid="signup-submit"]');
        await ctx.expectText("Enter your agency name");
        await ctx.expectText("valid 15-character GSTIN");
      });
      await ctx.check("signup succeeds and lands on the review screen", async () => {
        await page.fill('[data-testid="signup-businessName"]', "Verify Parcel Co");
        await page.fill('[data-testid="signup-gstin"]', "27ABCDE1234F1Z5");
        await page.fill('[data-testid="signup-officeAddress"]', "Station Road, Pune");
        await page.fill('[data-testid="signup-name"]', "Verify Owner");
        await page.fill('[data-testid="signup-email"]', "verify@parcel.test");
        await page.fill('[data-testid="signup-password"]', "Verify#2026");
        await page.click('[data-testid="signup-submit"]');
        await ctx.expectVisible("signup-acceptTerms-error");
        await ctx.expectText("Please accept the Terms and Privacy Policy");
        await page.click('[data-testid="signup-acceptTerms"]');
        await page.click('[data-testid="signup-submit"]');
        await ctx.expectVisible("pending-card");
      });
      await ctx.check("pending agency login goes to the review screen", async () => {
        await ctx.visit("/login");
        await page.fill('[data-testid="login-email"]', "verify@parcel.test");
        await page.fill('[data-testid="login-password"]', "Verify#2026");
        await page.click('[data-testid="login-submit"]');
        await ctx.expectVisible("pending-card");
      });
    },
  },
  {
    name: "Owner (desktop): every screen renders with live data",
    async run(ctx) {
      await ctx.login(ctx.CREDS.owner);
      const token = await ctx.tokenFor(ctx.CREDS.owner);
      const ids = await liveIds(ctx, token);
      for (const [name, pattern] of ROUTES) {
        const url = pattern.replace(/:(\w+)/g, (_, k) => ids[k] || "missing");
        await ctx.check(`owner · ${name}`, async () => {
          if (url.includes("missing")) throw new Error(`no fixture id for ${pattern}`);
          await ctx.visit(url);
          await ctx.expectVisible("screen-title", 20000);
          await ctx.expectNoPlaceholder();
          const failed = await ctx.page.locator('[data-testid="empty-state"]').getByText("Could not load this").count();
          if (failed) throw new Error("screen shows a load error");
        });
      }
    },
  },
  businessFlow,
  {
    name: "Command palette + branch switcher",
    async run(ctx) {
      const { page } = ctx;
      await ctx.login(ctx.CREDS.owner);
      await ctx.check("Ctrl+K finds a party by name", async () => {
        await page.keyboard.press("Control+k");
        await ctx.expectVisible("command-input");
        await page.fill('[data-testid="command-input"]', "ramesh");
        await ctx.expectText("Ramesh Traders");
      });
      await ctx.check("Ctrl+K runs an action (New bilti)", async () => {
        await page.fill('[data-testid="command-input"]', "new bilti");
        await page.keyboard.press("Enter");
        await page.waitForURL(/\/bilti\/new/, { timeout: 10000 });
      });

      // A Delhi-only booking, created straight through the API with the branch header.
      const token = await ctx.tokenFor(ctx.CREDS.owner);
      const branches = await ctx.api("GET", "/branches", { token });
      const delhi = branches.find((b) => b.code === "DEL");
      const party = await ctx.api("POST", "/parties", { token, body: { name: "Delhi Only Party" } });
      await fetch(`${ctx.API}/consignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Branch-Id": delhi.id },
        body: JSON.stringify({
          date: TODAY,
          party: party.id,
          packages: 4,
          chargeableWeight: 48,
          destinationStation: "NDLS",
          type: "railway_booking",
          freightAmount: 720,
          paymentMode: "to_pay",
        }),
      });

      await ctx.check("switching to the Delhi branch filters every list", async () => {
        await ctx.visit("/bookings");
        await page.click('[data-testid="branch-switcher"]');
        await page.click(`[data-testid="branch-switcher-option-${delhi.id}"]`);
        await page.waitForTimeout(1200);
        await ctx.expectText("Delhi Only Party");
        const ho = await page.getByText("Ramesh Traders").count();
        if (ho) throw new Error("head-office bookings still visible after picking Delhi");
      });
      await ctx.check("back to all branches", async () => {
        await page.click('[data-testid="branch-switcher"]');
        await page.click('[data-testid="branch-switcher-option-all"]');
        await page.waitForTimeout(1200);
        await ctx.expectText("Ramesh Traders");
      });
    },
  },
  {
    name: "Branch staff: sees only their branch, no admin areas",
    async run(ctx) {
      const { page } = ctx;
      await ctx.login(ctx.CREDS.staff);
      await ctx.check("staff sidebar hides Branches", async () => {
        await ctx.expectVisible("sidebar");
        if (await page.locator('[data-testid="nav-Branches"]').count()) throw new Error("Branches visible to staff");
      });
      await ctx.check("staff bookings list shows only Delhi bookings", async () => {
        await ctx.visit("/bookings");
        await ctx.expectVisible("screen-title");
        await page.waitForTimeout(800);
        if (await page.getByText("Ramesh Traders").count()) throw new Error("head-office booking leaked to Delhi staff");
      });
      await ctx.check("staff departure board renders", async () => {
        await ctx.visit("/");
        await ctx.expectVisible("screen-title");
        await ctx.expectNoPlaceholder();
      });
    },
  },
  {
    name: "Phone (390×844)",
    viewport: { width: 390, height: 844 },
    async run(ctx) {
      const { page } = ctx;
      await ctx.login(ctx.CREDS.owner);
      await ctx.check("phone: departure board + tab bar", async () => {
        await ctx.expectVisible("tabbar");
        await ctx.expectVisible("screen-title");
      });
      await ctx.check("phone: bookings as cards", async () => {
        await page.click('[data-testid="tab-Bookings"]');
        await ctx.expectVisible("screen-title");
        await page.waitForTimeout(600);
      });
      await ctx.check("phone: bilti list", async () => {
        await page.click('[data-testid="tab-Bilti"]');
        await ctx.expectVisible("screen-title");
      });
      await ctx.check("phone: More menu", async () => {
        await page.click('[data-testid="tab-More"]');
        await ctx.expectVisible("more-Settings");
      });
      await ctx.check("phone: new booking form fits", async () => {
        await ctx.visit("/bookings/new");
        await ctx.expectVisible("screen-title");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        if (overflow) throw new Error("horizontal overflow on phone");
      });
    },
  },
  {
    name: "Dark theme",
    async run(ctx) {
      const { page } = ctx;
      await ctx.login(ctx.CREDS.owner);
      await ctx.check("dark: departure board", async () => {
        await page.click('[data-testid="theme-toggle"]');
        await page.waitForTimeout(500);
        await ctx.expectVisible("screen-title");
      });
      await ctx.check("dark: bookings", async () => {
        await ctx.visit("/bookings");
        await ctx.expectVisible("screen-title");
      });
      await ctx.check("dark: invoice detail", async () => {
        const token = await ctx.tokenFor(ctx.CREDS.owner);
        const inv = (await ctx.api("GET", "/invoices?limit=1", { token }))[0];
        await ctx.visit(`/invoices/${inv.id}`);
        await ctx.expectVisible("screen-title");
      });
    },
  },
  {
    name: "Platform admin console",
    async run(ctx) {
      const { page } = ctx;
      await ctx.check("admin login", async () => {
        await ctx.visit("/admin");
        await ctx.expectVisible("admin-email");
        await page.fill('[data-testid="admin-email"]', ctx.CREDS.admin.email);
        await page.fill('[data-testid="admin-password"]', ctx.CREDS.admin.password);
        await page.click('[data-testid="admin-login-submit"]');
        await ctx.expectVisible("admin-nav-AdminOrgs");
      });
      await ctx.check("admin overview", async () => {
        await ctx.expectVisible("screen-title");
        await ctx.expectNoPlaceholder();
      });
      await ctx.check("admin agencies list shows the pending signup", async () => {
        await page.click('[data-testid="admin-nav-AdminOrgs"]');
        await ctx.expectText("Maa Durga Roadlines");
      });
      await ctx.check("admin agency detail", async () => {
        const token = await ctx.adminToken();
        const res = await fetch(`${ctx.API}/admin/organizations?search=Maa`, { headers: { Authorization: `Bearer ${token}` } });
        const org = (await res.json()).data[0];
        await ctx.visit(`/admin/organizations/${org.id}`);
        await ctx.expectText("Maa Durga Roadlines");
        await ctx.expectNoPlaceholder();
      });
      await ctx.check("admin approves the pending agency", async () => {
        await ctx.expectVisible("admin-org-approve");
        await ctx.page.click('[data-testid="admin-org-approve"]');
        await ctx.expectVisible("confirm-ok");
        await ctx.page.click('[data-testid="confirm-ok"]');
        await ctx.expectVisible("toast-success");
        const t = await ctx.adminToken();
        const r = await fetch(`${ctx.API}/admin/organizations?search=Maa`, { headers: { Authorization: `Bearer ${t}` } });
        const o = (await r.json()).data[0];
        if (o.approvalStatus !== "approved") throw new Error("still " + o.approvalStatus);
      });
      await ctx.check("admin plans", async () => {
        await page.click('[data-testid="admin-nav-AdminPlans"]');
        await ctx.expectText("Growth");
      });
      await ctx.check("admin audit log", async () => {
        await page.click('[data-testid="admin-nav-AdminAudit"]');
        await ctx.expectVisible("screen-title");
        await ctx.expectNoPlaceholder();
      });
    },
  },
  billingFlow,
  {
    name: "Backups (agency + platform)",
    async run(ctx) {
      const { page } = ctx;
      await ctx.login(ctx.CREDS.owner);
      await ctx.check("owner saves a backup email and emails a backup", async () => {
        await ctx.visit("/settings");
        await ctx.expectVisible("backup-card");
        await page.fill('[data-testid="backup-email"]', "vault@ganesh.test");
        await page.click('[data-testid="backup-email-save"]');
        await ctx.expectVisible("toast-success");
        const token = await ctx.tokenFor(ctx.CREDS.owner);
        const profile = await ctx.api("GET", "/business-profile", { token });
        if (profile.backupEmail !== "vault@ganesh.test") throw new Error("backup email not saved");
        await page.click('[data-testid="backup-send"]');
        await ctx.expectVisible("toast-info", 20000);
      });
      await ctx.check("staff do not see the backup card", async () => {
        await ctx.logout();
        await ctx.login(ctx.CREDS.staff);
        await ctx.visit("/settings");
        await ctx.expectVisible("screen-title");
        if (await page.locator('[data-testid="backup-card"] >> visible=true').count()) throw new Error("staff can email backups");
      });
      await ctx.check("platform admin runs a backup and sees it in history", async () => {
        await ctx.logout();
        await ctx.visit("/admin");
        await page.fill('[data-testid="admin-email"]', ctx.CREDS.admin.email);
        await page.fill('[data-testid="admin-password"]', ctx.CREDS.admin.password);
        await page.click('[data-testid="admin-login-submit"]');
        await ctx.expectVisible("admin-nav-AdminBackups");
        await page.click('[data-testid="admin-nav-AdminBackups"]');
        await ctx.expectVisible("admin-backup-drive-warning");
        await page.click('[data-testid="admin-backup-run"]');
        await page.click('[data-testid="confirm-ok"]');
        await ctx.expectVisible("toast-success", 30000);
        await ctx.expectText("email (SMTP not configured");
      });
    },
  },
  privacyFlow,
  {
    name: "Expired subscription → read-only banner",
    async run(ctx) {
      const admin = await ctx.adminToken();
      const token = await ctx.tokenFor(ctx.CREDS.owner);
      const me = await ctx.api("GET", "/auth/me", { token });
      const patch = (body) =>
        fetch(`${ctx.API}/admin/organizations/${me.organization.id}/subscription`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin}` },
          body: JSON.stringify(body),
        });
      await patch({ status: "trial", trialEndsAt: new Date(Date.now() - 20 * 864e5).toISOString() });
      await ctx.login(ctx.CREDS.owner);
      await ctx.check("read-only banner is shown", async () => {
        await ctx.expectVisible("banner-readonly");
      });
      await ctx.check("data is still viewable while read-only", async () => {
        await ctx.visit("/bookings");
        await ctx.expectText("Ramesh Traders");
      });
      await patch({ status: "active", periodDays: 30 });
    },
  },
];
