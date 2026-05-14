import { test, expect } from "@playwright/test";

test.describe("App routes", () => {
  test("renders the synthesize page", async ({ page }) => {
    await page.goto("/synthesize");
    await expect(page).toHaveURL(/synthesize/);
  });

  test("renders the library page", async ({ page }) => {
    await page.goto("/library");
    await expect(page).toHaveURL(/library/);
  });

  test("renders the dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });
});
