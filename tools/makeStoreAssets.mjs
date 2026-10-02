/**
 * Composes the store listing images from the raw captures made by
 * captureStoreScreens.mjs.
 *
 *   node tools/makeStoreAssets.mjs
 *
 * Output (store-assets/):
 *   play-icon-512.png                 512×512, full-bleed, no alpha
 *   feature-graphic-1024x500.png      the banner at the top of the listing
 *   screenshots/01…08.png             phone, 1080×1920
 *   screenshots-tablet7/01…08.png     1200×1920
 *   screenshots-tablet10/01…08.png    1600×2560
 *
 * Design rules (from published Play listing research, not taste):
 *  - The first two shots carry the pitch — most people see only those in search.
 *  - One message per shot, six words or fewer, in the top third, large enough
 *    to read at thumbnail size (~88px on a 1080 canvas).
 *  - Real screens with realistic data; the UI is never cropped left/right.
 *  - One background, one type system, one accent across the set.
 *  - Play: 24-bit PNG without alpha, longest side ≤ 2× the shortest.
 */
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const FRONT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(FRONT, "store-assets");

const INK = "#111317";
const CELL = "#1C1F26";
const AMBER = "#FFC940";

/** file → [headline (use *word* for the amber word), sub-line, station code]. */
const SHOTS = [
  ["board", "Every parcel on *one board*", "Bookings, dues and deliveries — live", "NDLS"],
  ["quick-entry", "Book a parcel in *one line*", "Type it. The form fills itself.", "CSTM"],
  ["bilti", "Bilti made, *tracked*, shared", "Print or WhatsApp in one tap", "BPL"],
  ["ledger", "Know who *owes* what", "Every party's ledger, always up to date", "ADI"],
  ["invoice", "*GST bills* done right", "Reimbursement kept out of tax", "HWH"],
  ["bookings", "Find any booking *fast*", "Search by RR, station or party", "SBC"],
  ["reports", "Reports your *CA* wants", "Daily, outstanding, station, GST — to Excel", "LKO"],
  ["board-dark", "Easy on the eyes *at night*", "Dark mode for the godown", "MAS"],
];

const TARGETS = [
  { key: "phone", raw: "raw-screens", out: "screenshots", w: 1080, h: 1920, frameW: 0.8, radius: 0.085, k: 1 },
  { key: "tab7", raw: "raw-screens-tablet", out: "screenshots-tablet7", w: 1200, h: 1920, frameW: 0.84, radius: 0.045, k: 1.02 },
  { key: "tab10", raw: "raw-screens-tablet", out: "screenshots-tablet10", w: 1600, h: 2560, frameW: 0.84, radius: 0.045, k: 1.36 },
];

const dataUri = (file) => `data:image/png;base64,${readFileSync(file).toString("base64")}`;
const headline = (t) => t.replace(/\*(.+?)\*/g, `<em>$1</em>`);
const flaps = (text, size) =>
  text
    .split("")
    .map(
      (c) =>
        `<span style="position:relative;display:inline-grid;place-items:center;width:${size * 0.74}px;height:${size}px;border-radius:${size * 0.1}px;background:${CELL};color:${AMBER};font:800 ${size * 0.62}px 'JetBrains Mono',monospace"><i style="position:absolute;left:0;right:0;top:50%;height:${Math.max(2, size * 0.03)}px;background:rgba(0,0,0,.6)"></i>${c}</span>`,
    )
    .join("");

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&family=JetBrains+Mono:wght@600;700;800&display=swap" rel="stylesheet">`;

/** The shared backdrop: ink, a soft amber glow behind the device, faint board lines. */
const backdrop = `
  background:
    radial-gradient(ellipse 70% 38% at 50% 62%, rgba(255,201,64,.16), transparent 70%),
    repeating-linear-gradient(180deg, rgba(255,255,255,.022) 0 1px, transparent 1px 64px),
    ${INK};`;

function screenshotHtml(t, [file, head, sub, code], index) {
  const k = t.k;
  const frame = Math.round(t.w * t.frameW);
  const bezel = Math.round(14 * k);
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
    *{box-sizing:border-box;margin:0}
    body{width:${t.w}px;height:${t.h}px;overflow:hidden;font-family:Inter,sans-serif;color:#fff;${backdrop}}
    .top{position:absolute;left:0;right:0;top:${84 * k}px;display:flex;align-items:center;justify-content:space-between;padding:0 ${84 * k}px}
    .brand{font:700 ${26 * k}px 'JetBrains Mono',monospace;letter-spacing:.26em;color:${AMBER}}
    .plat{display:flex;gap:${6 * k}px;align-items:center}
    .plat b{font:600 ${20 * k}px 'JetBrains Mono',monospace;letter-spacing:.2em;color:#8A7433;margin-right:${10 * k}px}
    .head{position:absolute;left:${84 * k}px;right:${84 * k}px;top:${186 * k}px}
    h1{font-weight:800;font-size:${92 * k}px;line-height:1.04;letter-spacing:-.035em}
    h1 em{font-style:normal;color:${AMBER}}
    p{margin-top:${22 * k}px;font-size:${38 * k}px;font-weight:500;color:#B9BDC7;letter-spacing:-.01em}
    .device{position:absolute;left:50%;top:${560 * k}px;width:${frame}px;margin-left:-${frame / 2}px;border-radius:${frame * t.radius}px;padding:${bezel}px;background:linear-gradient(160deg,#3a3f4a,#16181d 40%);box-shadow:0 ${50 * k}px ${120 * k}px rgba(0,0,0,.6),0 0 0 ${2 * k}px rgba(255,255,255,.06)}
    .device img{display:block;width:100%;border-radius:${frame * t.radius - bezel}px}
  </style></head><body>
    <div class="top"><div class="brand">BHARATRAILGO</div><div class="plat"><b>${String(index + 1).padStart(2, "0")}</b>${flaps(code, 44 * k)}</div></div>
    <div class="head"><h1>${headline(head)}</h1><p>${sub}</p></div>
    <div class="device"><img src="${dataUri(path.join(OUT, t.raw, `${file}.png`))}"></div>
  </body></html>`;
}

function featureHtml() {
  const phone = (file, style) =>
    `<div style="position:absolute;width:250px;border-radius:30px;padding:7px;background:linear-gradient(160deg,#3a3f4a,#16181d 40%);box-shadow:0 30px 70px rgba(0,0,0,.6);${style}"><img style="display:block;width:100%;border-radius:24px" src="${dataUri(path.join(OUT, "raw-screens", `${file}.png`))}"></div>`;
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
    *{box-sizing:border-box;margin:0}
    body{width:1024px;height:500px;overflow:hidden;font-family:Inter,sans-serif;color:#fff;
      background:radial-gradient(ellipse 46% 80% at 78% 55%, rgba(255,201,64,.2), transparent 70%),
        repeating-linear-gradient(180deg, rgba(255,255,255,.025) 0 1px, transparent 1px 50px), ${INK};}
    .l{position:absolute;left:84px;top:86px;width:520px}
    .brand{display:flex;align-items:center;gap:14px;font:700 17px 'JetBrains Mono',monospace;letter-spacing:.26em;color:${AMBER};margin-bottom:26px}
    h1{font-weight:800;font-size:54px;line-height:1.05;letter-spacing:-.035em}
    h1 em{font-style:normal;color:${AMBER}}
    .chips{display:flex;gap:8px;margin-top:28px}
    .chips span{font:600 13px 'JetBrains Mono',monospace;letter-spacing:.12em;color:${AMBER};background:${CELL};border-radius:6px;padding:8px 11px}
  </style></head><body>
    <div class="l">
      <div class="brand">${flaps("B", 40)} BHARATRAILGO</div>
      <h1>Every parcel,<br>every train,<br><em>every rupee.</em></h1>
      <div class="chips"><span>BOOKING</span><span>BILTI</span><span>GST</span><span>COLLECTIONS</span></div>
    </div>
    ${phone("bilti", "left:770px;top:96px;transform:rotate(7deg)")}
    ${phone("board", "left:598px;top:44px;transform:rotate(-5deg)")}
  </body></html>`;
}

const iconHtml = `<!doctype html><html><body style="margin:0;width:512px;height:512px;background:${INK};display:flex;align-items:center;justify-content:center">
  <img style="width:512px;height:512px" src="${dataUri(path.join(FRONT, "assets", "icon.png"))}"></body></html>`;

const browser = await chromium.launch();
async function render(html, w, h, file) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file }); // opaque: no alpha channel
  await page.close();
}

await render(iconHtml, 512, 512, path.join(OUT, "play-icon-512.png"));
await render(featureHtml(), 1024, 500, path.join(OUT, "feature-graphic-1024x500.png"));
console.log("play-icon-512.png, feature-graphic-1024x500.png");

for (const t of TARGETS) {
  mkdirSync(path.join(OUT, t.out), { recursive: true });
  for (const [i, s] of SHOTS.entries()) {
    const name = `${String(i + 1).padStart(2, "0")}-${s[0]}.png`;
    await render(screenshotHtml(t, s, i), t.w, t.h, path.join(OUT, t.out, name));
  }
  console.log(`${t.out}/ (${SHOTS.length})`);
}
await browser.close();
