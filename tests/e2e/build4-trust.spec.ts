import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

async function selectScenario(page: Page, request: APIRequestContext, scenarioId: string) {
  await page.goto("/demo");
  await expect(page.getByLabel("Demo scenario")).toBeEnabled();
  await page.getByLabel("Demo scenario").selectOption(scenarioId);
  // Selecting the already-selected option is also a reset command through the API.
  expect((await request.post("/api/demo/scenario", { data: { scenarioId } })).ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByLabel("Demo scenario")).toHaveValue(scenarioId);
  await expect(page.getByTestId("demo-time")).toHaveText(/10:00 am/i);
  expect((await request.patch("/api/watch-intents/intent%3Ahdfcbank%3Aprice", { data: {
    type: "PRICE_LEVEL", originalText: "Watching near ₹1,550",
    structuredPayload: { targetPricePaise: 155000, mode: "NEAR", proximityBps: 100 }, provenanceSource: "MANUAL",
  } })).ok()).toBeTruthy();
}
async function advance(request: APIRequestContext, steps = 1) {
  for (let step = 0; step < steps; step++) expect((await request.post("/api/demo/advance")).ok()).toBeTruthy();
}

test("stale price is withheld and the later fresh quote confirms the saved range", async ({ page }) => {
  const request = page.request;
  await page.setViewportSize({ width: 390, height: 844 });
  await selectScenario(page, request, "data-quality");
  await page.getByRole("button", { name: "Advance market 30 minutes" }).click();
  await expect(page.getByTestId("demo-time")).toHaveText(/10:30 am/i);
  await page.getByRole("link", { name: "View Catch Up" }).click();
  await expect(page.getByTestId("trust-STALE_FEED-HDFCBANK")).toContainText("has not been confirmed");
  await expect(page.getByTestId("attention-HDFCBANK")).toHaveCount(0);
  await advance(request);
  await page.reload();
  await expect(page.getByTestId("attention-HDFCBANK")).toContainText("Entered your ₹1,550 watch range");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("previously acknowledged results receive a correction notice without repeating the original", async ({ page }) => {
  const request = page.request;
  await selectScenario(page, request, "data-quality");
  expect((await request.patch("/api/watch-intents/intent%3Atcs%3Aearnings", { data: {
    type: "EARNINGS", originalText: "Watching Q2 margins",
    structuredPayload: { focus: ["MARGINS"], quarterLabel: "Q2" }, provenanceSource: "RESULTS_CALENDAR",
  } })).ok()).toBeTruthy();
  await advance(request, 5);
  await page.goto("/");
  await page.getByTestId("attention-TCS").getByRole("button", { name: "Mark seen" }).click();
  await expect(page.getByTestId("attention-TCS")).toHaveCount(0);
  await advance(request);
  await page.reload();
  const correction = page.getByTestId("trust-CORRECTED_INFORMATION-TCS");
  await expect(correction).toContainText("Information you previously viewed was corrected");
  await expect(correction).toContainText("2480 → 2410");
  await expect(page.getByTestId("attention-TCS")).toHaveCount(0);
  await correction.getByRole("button", { name: "Mark correction seen" }).click();
  await expect(correction).toHaveCount(0);
});

test("Calm Mode groups broad moves, keeps an explicit condition, and surfaces the later residual", async ({ page }) => {
  const request = page.request;
  await selectScenario(page, request, "market-shock");
  await advance(request);
  await page.goto("/");
  await expect(page.getByTestId("calm-mode")).toContainText("Markets are moving broadly today");
  await expect(page.getByTestId("calm-mode")).toContainText("5 of 5");
  await expect(page.getByTestId("attention-HDFCBANK")).toBeVisible();
  await expect(page.locator("[data-testid^='attention-']")).toHaveCount(1);
  await page.getByText("Show grouped market moves (4)").click();
  await expect(page.getByTestId("calm-mode").getByRole("link", { name: "RELIANCE", exact: true })).toBeVisible();
  await advance(request);
  await page.reload();
  await expect(page.getByTestId("attention-RELIANCE")).toContainText("relative to the broader market");
});

test("a split creates review instead of a false target hit and adjustment creates history", async ({ page }) => {
  const request = page.request;
  await selectScenario(page, request, "corporate-action");
  const before = await (await request.get("/api/watch-intents?instrumentId=NSE%3AHDFCBANK")).json();
  await advance(request);
  await page.goto("/");
  await expect(page.getByTestId("attention-HDFCBANK")).toHaveCount(0);
  const review = page.getByTestId("trust-CORPORATE_ACTION_REVIEW-HDFCBANK");
  await expect(review).toContainText("1:2 stock split");
  await review.getByRole("button", { name: "Update to ₹775", exact: true }).click();
  await expect(review).toHaveCount(0);
  await page.goto("/stock/HDFCBANK");
  await expect(page.getByRole("heading", { name: /near ₹775/ })).toBeVisible();
  await page.getByText("Reason history", { exact: true }).click();
  await expect(page.getByText("near ₹1,550", { exact: true }).first()).toBeVisible();
  const after = await (await request.get("/api/watch-intents?instrumentId=NSE%3AHDFCBANK")).json();
  expect(after.intents.length).toBe(before.intents.length + 1);
  expect(after.intents.find((intent: { status: string }) => intent.status === "ACTIVE").structuredPayload.targetPricePaise).toBe(77500);
});

test.afterAll(async ({ request }) => {
  expect((await request.post("/api/demo/scenario", { data: { scenarioId: "groww-delta-default" } })).ok()).toBeTruthy();
  expect((await request.patch("/api/watch-intents/intent%3Ahdfcbank%3Aprice", { data: {
    type: "PRICE_LEVEL", originalText: "Watching near ₹1,550",
    structuredPayload: { targetPricePaise: 155000, mode: "NEAR", proximityBps: 100 }, provenanceSource: "MANUAL",
  } })).ok()).toBeTruthy();
});
