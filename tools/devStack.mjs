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
    const p = spawn(process.execPath, args, {
      cwd: BACK,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) =>
      code === 0
        ? resolve(out)
        : reject(new Error(`${args.join(" ")} failed:\n${out}`)),
    );
  });
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
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
      });
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
  const api = spawn(process.execPath, ["server.js"], {
    cwd: BACK,
    env,
    stdio: "ignore",
  });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`http://localhost:${API_PORT}/health`)).ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  log("• extra fixtures…");
  // Same fixtures the real showcase seed uses (bharatrailgo-back/scripts/seedShowcase.mjs).
  const { applyShowcaseFixtures } = await import(
    pathToFileURL(path.join(BACK, "scripts", "seedShowcase.mjs")).href
  );
  await applyShowcaseFixtures({
    apiBase: API,
    creds: {
      admin: CREDS.admin,
      owner: CREDS.owner,
      staff: CREDS.staff,
      manager: {
        email: "manager@demo-parcel.test",
        password: "DemoManager#2026",
      },
      pending: { email: "subhash@maadurga.test", password: "Pending#2026" },
    },
    log: () => {},
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
  console.log(
    `\nReady:\n  web   ${WEB}\n  api   ${API}\n  owner ${CREDS.owner.email} / ${CREDS.owner.password}\n  staff ${CREDS.staff.email} / ${CREDS.staff.password}\n  admin ${WEB}/admin  ${CREDS.admin.email} / ${CREDS.admin.password}\n`,
  );
  const shutdown = async () => {
    await stack.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
