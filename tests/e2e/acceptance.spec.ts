// Launch-blocking acceptance: open without signup -> choose interests -> real feed -> watch ->
// provenance -> like/save -> customize -> share -> open in an independent session -> export.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { readZip } from "../../src/pipeline/unzip";

test("a new visitor builds, watches, shares and exports a Tube", async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== "desktop", "full journey runs once, on desktop");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Make your own HackerTube.");

  // Pick three interests on the landing page; the preview re-ranks from real data.
  const firstBefore = await page.locator("#build ol li").first().getAttribute("data-flip");
  for (const name of ["Functional programming", "Distributed systems", "Space exploration"]) {
    const chip = page.locator("#build").getByRole("button", { name: new RegExp(`^${name}`) });
    if (!(await chip.count())) await page.getByRole("button", { name: /Browse all/ }).click();
    await page.locator("#build").getByRole("button", { name: new RegExp(`^${name}`) }).first().click();
  }
  await expect(page.locator("#build")).toContainText(/Your top 12 from \d+ videos/);
  await expect.poll(async () => page.locator("#build ol li").first().getAttribute("data-flip")).not.toBe(firstBefore);

  await page.getByRole("button", { name: "Make my Tube" }).click();
  await expect(page).toHaveURL(/\/tube/);
  const cards = page.locator("[data-card]");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(8);

  // Watch: official embed, lazy-created on click.
  const firstTitle = (await cards.first().locator("h3").textContent())!.trim();
  await cards.first().locator("button").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("iframe[src*='youtube-nocookie.com/embed/']")).toHaveCount(1, { timeout: 20_000 });

  // Provenance: real HN comments with links to the threads.
  await expect(dialog.getByRole("heading", { name: "Recommended by the HN community" })).toBeVisible();
  const hnLinks = dialog.locator("a[href^='https://news.ycombinator.com/item?id=']");
  expect(await hnLinks.count()).toBeGreaterThan(0);

  // Like + save.
  await dialog.getByRole("button", { name: /^Like/ }).click();
  await dialog.getByRole("button", { name: /Watch later/ }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("link", { name: /^Liked/ }).first().click();
  await expect(page.getByText(firstTitle).first()).toBeVisible();
  await page.getByRole("link", { name: /^Watch Later/ }).first().click();
  await expect(page.getByText(firstTitle).first()).toBeVisible();

  // Customize: name it and add more surprise.
  await page.getByRole("link", { name: /^Customize/ }).first().click();
  const name = page.getByLabel("Tube name");
  await name.fill("Lambda & Rockets");
  await name.blur();
  await page.getByRole("button", { name: "Lots", exact: true }).click();

  // Share.
  await page.getByRole("button", { name: /Share & export/ }).click();
  const link = await page.getByLabel("Share link").inputValue();
  expect(link).toMatch(/\/r\/lambda-rockets--1\./);
  const shareImg = page.locator("img[alt^='Preview of the card']");
  await expect(shareImg).toBeVisible();

  // Export the config.
  const [cfgDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Config/ }).click()]);
  const cfg = JSON.parse(readFileSync((await cfgDl.path())!, "utf8"));
  expect(cfg.tuberemix).toBe(1);
  expect(cfg.name).toBe("Lambda & Rockets");
  expect(Object.keys(cfg.topics)).toHaveLength(3);
  expect(cfg.source.zip_sha256).toMatch(/^[0-9a-f]{64}$/);

  // Starter ZIP with this config inside.
  const [zipDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Starter project/ }).click()]);
  const entries = readZip(readFileSync((await zipDl.path())!));
  const names = entries.map((e) => e.name);
  expect(names).toEqual(expect.arrayContaining(["lambda-rockets/build.mjs", "lambda-rockets/README.md", "lambda-rockets/lib/tuberemix.mjs", "lambda-rockets/tuberemix.config.json"]));
  expect(JSON.parse(entries.find((e) => e.name.endsWith("tuberemix.config.json"))!.data.toString("utf8")).name).toBe("Lambda & Rockets");

  // Playlist.
  const [mdDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Top \d+ as Markdown/ }).click()]);
  expect(readFileSync((await mdDl.path())!, "utf8")).toMatch(/^# Lambda & Rockets/);

  // Open the share link as a second, independent person.
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(link);
  await expect(p2.getByRole("heading", { level: 1 })).toHaveText("Lambda & Rockets");
  await expect(p2.getByRole("list", { name: "Interests" })).toContainText("Functional programming");
  const sharedCards = p2.locator("[data-card]");
  expect(await sharedCards.count()).toBeGreaterThanOrEqual(12);
  // The page is server-rendered: the same feed exists in the HTML without JavaScript.
  const html = await (await p2.request.get(link)).text();
  expect(html).toContain("Lambda &amp; Rockets");
  expect(html).toContain("i.ytimg.com/vi/");
  // Remix it.
  await p2.getByRole("button", { name: "Remix this Tube" }).click();
  await expect(p2).toHaveURL(/\/tube\/customize/);
  await expect(p2.getByLabel("Tube name")).toHaveValue("Lambda & Rockets (remix)");
  await other.close();
  expect(baseURL).toBeTruthy();
});
