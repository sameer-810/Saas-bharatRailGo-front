/**
 * Local end-to-end stack for UI verification — never touches a real database.
 *
 *   in-memory MongoDB → backend seed scripts → `node server.js` (API :5099)
 *   → extra fixtures over HTTP (branch, staff, rates, invoice, pending signup)
 *   → static server for the exported web app (dist/, SPA fallback) on :8099
 *
 * CLI:  node tools/devStack.mjs          (keeps running until Ctrl+C)
 * Lib:  const stack = await startStack(); ... await stack.stop();
 *
 * The web build must be exported with EXPO_PUBLIC_API_URL=http://localhost:5099/api
 * (tools/verifyAll.mjs does that).
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONT = path.resolve(HERE, "..");
const BACK = path.resolve(FRONT, "..", "bharatrailgo-back");
const requireBack = createRequire(path.join(BACK, "package.json"));
const { MongoMemoryServer } = requireBack("mongodb-memory-server");

export const API_PORT = 5099;
export const WEB_PORT = 8099;
export const API = `http://localhost:${API_PORT}/api`;
export const WEB = `http://localhost:${WEB_PORT}`;

// Demo credentials for the local stack only (in-memory DB, destroyed on exit).
export const CREDS = {
  owner: { email: "owner@demo-parcel.test", password: "DemoOwner#2026" },
  staff: { email: "branchstaff@demo-parcel.test", password: "DemoStaff#2026" },
  admin: { email: "root@platform.test", password: "RootAdmin#2026" },
};

function run(args, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, args, { cwd: BACK, env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${args.join(" ")} failed:\n${out}`))));
  });
}

async function call(method, url, { token, body, admin } = {}) {
  const res = await fetch((admin ? `${API}/admin` : API) + url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(json)}`);
  return json?.data;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
};

function serveDist(dir, port) {
  const server = createServer(async (req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = path.join(dir, urlPath);
    try {
      if (!(await stat(file)).isFile()) throw new Error("dir");
    } catch {
      file = path.join(dir, "index.html"); // SPA fallback
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

export async function startStack({ log = console.log } = {}) {
  const mongod = await MongoMemoryServer.create();
  const env = {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(API_PORT),
    MONGODB_URI: mongod.getUri("bharatrailgo_ui"),
    JWT_ACCESS_SECRET: "ui-verify-secret",
    JWT_ADMIN_SECRET: "ui-verify-admin-secret",
    JWT_ACCESS_EXPIRES_IN: "2h",
    SIGNUP_REQUIRES_APPROVAL: "true",
    AUTH_RATE_LIMIT_MAX: "10000",
    CORS_ORIGIN: "",
    DEMO_PASSWORD: CREDS.owner.password,
    DEMO_OWNER_EMAIL: CREDS.owner.email,
    DEMO_BUSINESS_NAME: "Shree Ganesh Parcel Services",
    PLATFORM_ADMIN_EMAIL: CREDS.admin.email,
    PLATFORM_ADMIN_PASSWORD: CREDS.admin.password,
    MSG91_AUTH_KEY: "",
    // Online billing through the built-in fake Razorpay (signed webhooks, no keys needed).
    BILLING_PROVIDER: "fake",
    RAZORPAY_WEBHOOK_SECRET: "ui-verify-webhook-secret",
    PUBLIC_APP_URL: WEB,
    PUBLIC_API_URL: `http://localhost:${API_PORT}`,
    PLATFORM_STATE_CODE: "27",
    // Backups: no Drive locally → email fallback (SMTP unset → logged, not sent). No nightly cron.
    BACKUP_ENABLED: "false",
    BACKUP_EMAIL: "backups@platform.test",
  };

  log("• seeding (admin, demo tenant, demo data)…");
  await run(["scripts/createPlatformAdmin.mjs"], env);
  await run(["scripts/seedDemoTenant.js"], env);
  await run(["scripts/seedDemoData.js"], env);

  log("• starting API on", API_PORT);
  const api = spawn(process.execPath, ["server.js"], { cwd: BACK, env, stdio: "ignore" });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`http://localhost:${API_PORT}/health`)).ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  log("• extra fixtures…");
  const adminToken = (await call("POST", "/auth/login", { admin: true, body: CREDS.admin })).accessToken;
  let owner = await call("POST", "/auth/login", { body: CREDS.owner });
  await call("PATCH", `/organizations/${owner.organization.id}/subscription`, {
    admin: true,
    token: adminToken,
    body: { planCode: "growth", status: "active", billingCycle: "monthly", periodDays: 30 },
  });
  owner = await call("POST", "/auth/login", { body: CREDS.owner });
  const token = owner.accessToken;

  const delhi = await call("POST", "/branches", {
    token,
    body: { name: "Delhi Godown", code: "DEL", stationCode: "NDLS", address: "Paharganj, New Delhi" },
  });
  await call("POST", "/auth/users", {
    token,
    body: { name: "Ravi (Delhi)", email: CREDS.staff.email, password: CREDS.staff.password, branches: [delhi.id] },
  });
  await call("POST", "/auth/users", {
    token,
    body: { name: "Meena Manager", email: "manager@demo-parcel.test", password: "DemoManager#2026", role: "manager" },
  });
  for (const h of [
    { name: "Freight", appliesTo: "freight", basis: "per_kg", rate: 12 },
    { name: "Freight", appliesTo: "freight", basis: "per_kg", rate: 15, stationCode: "NDLS" },
    { name: "Hamali", appliesTo: "hamali", basis: "per_package", rate: 10 },
    { name: "Docket", appliesTo: "other", basis: "flat", rate: 20 },
  ]) {
    await call("POST", "/charge-heads", { token, body: h });
  }
  await call("PATCH", "/business-profile", {
    token,
    body: { paymentReceivers: ["Ramesh", "Suresh", "Iqbal"], podNumberPrefix: "SG/", brandColor: "#1F4FD6" },
  });

  // One finalised GST invoice from an on_bill party's open consignments.
  const cons = await call("GET", "/consignments?limit=200", { token });
  const byParty = new Map();
  for (const c of cons) {
    if (c.paymentMode === "on_bill" && !c.invoice) {
      const pid = c.party?.id || c.party;
      byParty.set(pid, [...(byParty.get(pid) || []), c.id]);
    }
  }
  const [partyId, ids] = [...byParty.entries()].sort((a, b) => b[1].length - a[1].length)[0] || [];
  if (partyId) {
    const inv = await call("POST", "/invoices", {
      token,
      body: { party: partyId, date: new Date().toISOString().slice(0, 10), consignmentIds: ids.slice(0, 3) },
    });
    await call("POST", `/invoices/${inv.id}/finalize`, { token });
    if (ids.length > 3) {
      await call("POST", "/invoices", {
        token,
        body: { party: partyId, date: new Date().toISOString().slice(0, 10), consignmentIds: [ids[3]] },
      });
    }
  }

  // A signup waiting in the admin queue.
  await call("POST", "/auth/signup", {
    body: {
      businessName: "Maa Durga Roadlines",
      gstin: "19ABCDE1234F1Z5",
      officeAddress: "Burrabazar, Kolkata",
      city: "Kolkata",
      name: "Subhash Das",
      email: "subhash@maadurga.test",
      password: "Pending#2026",
      acceptTerms: true,
    },
  });

  log("• serving web build on", WEB_PORT);
  const web = await serveDist(path.join(FRONT, "dist"), WEB_PORT);

  return {
    mongod,
    api,
    web,
    async stop() {
      web.close();
      api.kill();
      await mongod.stop();
    },
  };
}

// CLI
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const stack = await startStack();
  console.log(`\nReady:\n  web   ${WEB}\n  api   ${API}\n  owner ${CREDS.owner.email} / ${CREDS.owner.password}\n  staff ${CREDS.staff.email} / ${CREDS.staff.password}\n  admin ${WEB}/admin  ${CREDS.admin.email} / ${CREDS.admin.password}\n`);
  const shutdown = async () => {
    await stack.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
