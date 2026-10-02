/**
 * Renders the app icons into assets/ — the split-flap "B" in brand amber on the
 * departure-board ink. Run after changing the mark:  node tools/makeIcons.mjs
 *
 *   icon.png           1024  full-bleed square (iOS rounds it itself)
 *   adaptive-icon.png  1024  Android foreground, mark inside the 66% safe zone
 *   splash-icon.png    1024  mark on transparent, shown on the ink background
 *   favicon.png          64  browser tab
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "assets");
const INK = "#111317";

const flap = (h) => `
  <div style="position:relative;width:${h * 0.81}px;height:${h}px;border-radius:${h * 0.075}px;background:#1B1E24;display:flex;align-items:center;justify-content:center;overflow:hidden">
    <span style="font:800 ${h * 1.15}px/1 'Courier New',monospace;color:#FFC940;transform:translateY(${h * 0.03}px)">B</span>
    <div style="position:absolute;left:0;right:0;top:50%;height:${h * 0.027}px;margin-top:-${h * 0.0135}px;background:${INK}"></div>
  </div>`;

const page = (size, bg, markHeight) => `<html><body style="margin:0;background:transparent">
<div style="width:${size}px;height:${size}px;background:${bg};display:flex;align-items:center;justify-content:center">${flap(markHeight)}</div></body></html>`;

const FILES = [
  ["icon.png", 1024, INK, 700, false],
  ["adaptive-icon.png", 1024, "transparent", 470, true],
  ["splash-icon.png", 1024, "transparent", 520, true],
  ["favicon.png", 64, INK, 50, false],
];

const browser = await chromium.launch();
for (const [file, size, bg, mark, transparent] of FILES) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(page(size, bg, mark));
  await p.screenshot({ path: path.join(OUT, file), omitBackground: transparent });
  await p.close();
  console.log(`assets/${file}`);
}
await browser.close();
