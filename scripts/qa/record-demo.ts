// Records the launch demo from the real running app (no mockups):
//   npx tsx scripts/qa/record-demo.ts http://127.0.0.1:3918 launch/media
// Part A: landing -> pick interests -> feed -> player + HN provenance -> share.
// Part B: a fresh, independent browser opens the share link.
import { chromium, type Page } from "@playwright/test";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

const [base = "http://127.0.0.1:3918", outDir = "launch/media"] = process.argv.slice(2);
const size = { width: 1280, height: 720 };
const tmp = join(outDir, ".rec");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

// A visible cursor, since recordings don't include the OS pointer.
const CURSOR = `(() => {
  const c = document.createElement('div');
  c.style.cssText = 'position:fixed;z-index:2147483647;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(21,19,15,.85);box-shadow:0 0 0 3px rgba(241,224,90,.9);pointer-events:none;transition:transform .12s;left:-50px;top:-50px';
  const add = () => document.body && !c.isConnected && document.body.appendChild(c);
  document.addEventListener('mousemove', e => { add(); c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
  document.addEventListener('mousedown', () => { c.style.transform = 'scale(.7)'; }, true);
  document.addEventListener('mouseup', () => { c.style.transform = 'scale(1)'; }, true);
})();`;

async function glide(page: Page, selector: string, opts: { click?: boolean; pause?: number } = {}) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  const box = (await el.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
  if (opts.click !== false) {
    await page.waitForTimeout(120);
    await page.mouse.down();
    await page.mouse.up();
  }
  await page.waitForTimeout(opts.pause ?? 600);
}

const browser = await chromium.launch();

// Part A
const ctxA = await browser.newContext({ viewport: size, recordVideo: { dir: join(tmp, "a"), size } });
await ctxA.addInitScript(CURSOR);
const page = await ctxA.newPage();
const t0 = Date.now();
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.mouse.move(640, 300);
await page.waitForTimeout(1600);
await page.evaluate(() => document.querySelector("#build")?.scrollIntoView({ behavior: "smooth" }));
await page.waitForTimeout(900);
const marks: Record<string, number> = { interests: (Date.now() - t0) / 1000 };
for (const name of ["Machine learning & deep learning", "Functional programming", "Fundamental physics"]) {
  await glide(page, `#build button:has-text("${name}")`, { pause: 1350 });
}
await glide(page, `#build button:has-text("Make my Tube")`, { pause: 200 });
await page.locator("[data-card]").first().waitFor();
marks.feed = (Date.now() - t0) / 1000;
await page.waitForTimeout(1300);
await glide(page, "[data-card] button", { pause: 1800 });
await page.getByRole("heading", { name: "Recommended by the HN community" }).waitFor();
const dialog = page.getByRole("dialog");
for (let i = 0; i < 5; i++) { await dialog.evaluate((d) => d.scrollBy({ top: 190, behavior: "smooth" })); await page.waitForTimeout(330); }
await page.waitForTimeout(900);
marks.provenance = (Date.now() - t0) / 1000;
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await glide(page, "button:has-text('Share & export')", { pause: 700 });
const nameBox = page.getByLabel("Name", { exact: true });
await nameBox.fill("");
await nameBox.pressSequentially("Lambdas & Physics", { delay: 35 });
await page.waitForTimeout(400);
const link = await page.getByLabel("Share link").inputValue();
await glide(page, "button:has-text('Copy')", { pause: 1000 });
marks.share = (Date.now() - t0) / 1000;
await ctxA.close();

// Part B: someone else opens the link.
const ctxB = await browser.newContext({ viewport: size, recordVideo: { dir: join(tmp, "b"), size } });
await ctxB.addInitScript(CURSOR);
const p2 = await ctxB.newPage();
await p2.goto(link, { waitUntil: "networkidle" });
await p2.mouse.move(400, 260);
await p2.waitForTimeout(1800);
await p2.evaluate(() => window.scrollBy({ top: 380, behavior: "smooth" }));
await p2.waitForTimeout(1500);
await ctxB.close();
await browser.close();

const pick = (d: string) => join(tmp, d, readdirSync(join(tmp, d)).find((f) => f.endsWith(".webm"))!);
renameSync(pick("a"), join(tmp, "a.webm"));
renameSync(pick("b"), join(tmp, "b.webm"));
console.log(JSON.stringify({ link, marks }));
