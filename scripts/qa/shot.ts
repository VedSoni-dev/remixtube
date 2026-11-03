// Dev helper: npx tsx scripts/qa/shot.ts <url> <out.png> [width] [height] [fullPage] [actions-json]
import { chromium } from "@playwright/test";

const [url, out, w = "1440", h = "900", full = "0", actionsJson = "[]"] = process.argv.slice(2);
if (!url || !out) throw new Error("usage: shot.ts <url> <out.png> [w] [h] [full] [actions]");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
const logs: string[] = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(url, { waitUntil: "networkidle" });
for (const a of JSON.parse(actionsJson) as { click?: string; wait?: number; press?: string; fill?: [string, string]; scroll?: number }[]) {
  if (a.click) await page.click(a.click);
  if (a.fill) await page.fill(a.fill[0], a.fill[1]);
  if (a.press) await page.keyboard.press(a.press);
  if (a.scroll) await page.mouse.wheel(0, a.scroll);
  await page.waitForTimeout(a.wait ?? 400);
}
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: full === "1" });
console.log(logs.join("\n") || "no console errors");
await browser.close();
