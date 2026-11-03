import { expect, test } from "@playwright/test";

test("invalid and tampered share links show a helpful 404", async ({ page }) => {
  for (const path of ["/r/nope", "/r/x--1.zzz2.-.a10.1.-.-.0000", "/r/x--%3Cscript%3Ealert(1)%3C%2Fscript%3E", `/r/a--${"1".repeat(900)}`]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This Tube link doesn’t work.");
  }
});

test("a fresh visitor to /tube gets the topic picker, not an empty page", async ({ page }) => {
  await page.goto("/tube");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Start with a few");
  await page.getByRole("button", { name: /^Compilers/ }).first().click();
  await page.getByRole("button", { name: "Make my Tube" }).click();
  await expect(page.locator("[data-card]").first()).toBeVisible();
});

test("odd combinations still produce a feed", async ({ page }) => {
  await page.goto("/tube");
  for (const n of [/^Ships/, /^Chess/, /^Climate/]) await page.getByRole("button", { name: n }).first().click();
  await page.getByRole("button", { name: "Make my Tube" }).click();
  await expect(page.locator("[data-card]").first()).toBeVisible();
  expect(await page.locator("[data-card]").count()).toBeGreaterThanOrEqual(8);
});

test("slow network shows skeletons, then real videos", async ({ page }) => {
  await page.route("**/data/**", async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue(); });
  await page.goto("/");
  await expect(page.locator("#build .skeleton").first()).toBeVisible();
  await expect(page.locator("#build [data-card]").first()).toBeVisible({ timeout: 20_000 });
});

test("a missing thumbnail falls back to a typographic card", async ({ page }) => {
  await page.route("https://i.ytimg.com/**", (route) => route.fulfill({ status: 404, body: "" }));
  await page.goto("/");
  await expect(page.locator("#build").getByText("No thumbnail").first()).toBeVisible();
});

test("a removed video is explained and dropped from the feed", async ({ page }) => {
  // Stand in for YouTube's IFrame API reporting error 100 (video not found / private).
  await page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({
    contentType: "text/javascript",
    body: "window.YT={Player:function(el,o){setTimeout(function(){o.events.onError({data:100})},50);this.destroy=function(){}}};window.onYouTubeIframeAPIReady&&window.onYouTubeIframeAPIReady();",
  }));
  await page.goto("/tube");
  await page.getByRole("button", { name: /^Compilers/ }).first().click();
  await page.getByRole("button", { name: "Make my Tube" }).click();
  const first = page.locator("[data-card]").first();
  const id = await first.getAttribute("data-card");
  await first.locator("button").first().click();
  await expect(page.getByText("This video is no longer on YouTube.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect.poll(async () => Object.keys((await page.evaluate(() => JSON.parse(localStorage.getItem("tuberemix:v1") ?? "{}"))).unavailable ?? {})).toContain(id);
  await page.getByRole("link", { name: /^For You/ }).first().click();
  await expect(page.locator("[data-card]").first()).toBeVisible();
  expect(await page.locator(`[data-card="${id}"]`).count()).toBe(0);
});

test("keyboard: ? opens shortcuts, j moves focus, Enter plays", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "keyboard test on desktop");
  await page.goto("/tube");
  await page.getByRole("button", { name: /^Compilers/ }).first().click();
  await page.getByRole("button", { name: "Make my Tube" }).click();
  await expect(page.locator("[data-card]").first()).toBeVisible();
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("j");
  await page.keyboard.press("j");
  const focused = await page.evaluate(() => document.activeElement?.closest("[data-card]")?.getAttribute("data-card"));
  expect(focused).toBeTruthy();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("share card image is a real 1200x630 PNG", async ({ request }) => {
  const res = await request.get("/opengraph-image");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
  const b = await res.body();
  expect(b.readUInt32BE(16)).toBe(1200);
  expect(b.readUInt32BE(20)).toBe(630);
});

test("no horizontal scroll on small screens", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ["/", "/tube", "/build-your-own"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("analytics accepts only whitelisted, coarse events", async ({ request }) => {
  expect((await request.post("/api/e", { data: { e: "feed_generated", s: "0123456789abcdef", p: { ms: 1234, source: "landing" } } })).status()).toBe(204);
  expect((await request.post("/api/e", { data: { e: "watched_video_xyz", s: "x" } })).status()).toBe(400);
  expect((await request.post("/api/e", { data: "x".repeat(5000) })).status()).toBe(413);
});

test("ChatGPT plan sign-in is refused on a non-local server", async ({ request }) => {
  const status = await (await request.get("/api/ai/chatgpt/status")).json();
  expect(status.local).toBe(false);
  expect((await request.post("/api/ai/chatgpt/start")).status()).toBe(403);
  expect((await request.get("/auth/callback?code=x&state=y")).status()).toBe(404);
});
