import path from "path";
import { expect, test } from "@playwright/test";

const ACTIVE_BOARD_KEY = "flow:active-board-slug";

/** Matches chart cards in {@link renderChartsShell} (`assets/js/pages/charts.js`). */
const CHART_EXPAND_SHOTS = [
  {
    file: "demo-chart-expand-completions.png", 
    title: "Completions" 
  },{
    file: "demo-chart-expand-swimlane.png",
    title: "Completions by swimlane",
  },{
    file: "demo-chart-expand-cumulative-flow.png",
    title: "Cumulative flow",
  },{
    file: "demo-chart-expand-cycle-time.png",
    title: "Cycle time (created → closed)",
  },{
    file: "demo-chart-expand-column-stack.png",
    title: "Open cards by column",
  },{
    file: "demo-chart-expand-card-age.png",
    title: "Age of open cards",
  },
];

test.describe("doc screenshots", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript((key) => {
      localStorage.setItem(key, "demo");
    }, ACTIVE_BOARD_KEY);
  });

  test("demo board — full page", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".board-shell", { timeout: 30_000 });
    const out = path.join(
      process.cwd(),
      "docs/screenshots/demo-board-full.png"
    );
    await page.screenshot({
      path: out,
      fullPage: true,
      /** 1 CSS px per image px; default "device" scales with DPR and can break full-page shots. */
      scale: "css",
    });
  });

  test("demo board — single card with move icons", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".board-shell", { timeout: 30_000 });

    const firstTitle = page.locator(".column-card .column-card-title").first();
    await expect(firstTitle).toBeVisible({ timeout: 15_000 });
    await firstTitle.click();

    const openCard = page.locator(".column-card--compass-open").first();
    await expect(openCard).toBeVisible();

    const out = path.join(
      process.cwd(),
      "docs/screenshots/demo-card-move-icons.png"
    );
    await openCard.screenshot({ path: out, scale: "css" });
  });

  test("demo board — edit card dialog", async ({ page }) => {
    /** The dialog caps at `calc(100dvh - 2rem)` and starts scrolling on the default
     *  1280×800 viewport, which crops the Links row in the screenshot. Give the page
     *  a tall viewport so the full dialog fits without internal scrolling. */
    await page.setViewportSize({ width: 1280, height: 1400 });

    await page.goto("/");
    await page.waitForSelector(".board-shell", { timeout: 30_000 });

    const editBtn = page.locator(".flow-card-edit-btn").first();
    await expect(editBtn).toBeVisible({ timeout: 15_000 });
    await editBtn.click();

    const dialog = page.locator("dialog.flow-modal--edit-card");
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    const out = path.join(
      process.cwd(),
      "docs/screenshots/demo-edit-card-dialog.png"
    );
    await dialog.screenshot({ path: out, scale: "css" });
  });

  test("demo board — completed page full page", async ({ page }) => {
    await page.goto("/complete/");
    await page.waitForSelector(".complete-shell", { timeout: 30_000 });
    const out = path.join(
      process.cwd(),
      "docs/screenshots/demo-completed-full.png"
    );
    await page.screenshot({
      path: out,
      fullPage: true,
      scale: "css",
    });
  });

  test("demo board — charts page full page", async ({ page }) => {
    /** Pin "Group by" to Weekly so screenshots are deterministic regardless of saved profile. */
    await page.goto("/charts/?g=weekly");
    await page.waitForSelector(".charts-shell", { timeout: 30_000 });
    await expect(page.locator("#flow-chart-granularity")).toHaveValue("weekly");
    const out = path.join(
      process.cwd(),
      "docs/screenshots/demo-charts-full.png"
    );
    await page.screenshot({
      path: out,
      fullPage: true,
      scale: "css",
    });
  });

  test("demo board — preferences page full page", async ({ page }) => {
    await page.goto("/preferences/");
    await page.waitForSelector(".preferences-shell", { timeout: 30_000 });
    const out = path.join(
      process.cwd(),
      "docs/screenshots/demo-preferences-full.png"
    );
    await page.screenshot({
      path: out,
      fullPage: true,
      scale: "css",
    });
  });

  test("demo board — boards page full page", async ({ page }) => {
    await page.goto("/admin/");
    /** Boards uses `admin-shell` without `preferences-shell` (preferences adds that class). */
    await page.waitForSelector(".board-shell.admin-shell:not(.preferences-shell)", {
      timeout: 30_000,
    });
    const out = path.join(
      process.cwd(),
      "docs/screenshots/demo-boards-full.png"
    );
    await page.screenshot({
      path: out,
      fullPage: true,
      scale: "css",
    });
  });

  test("demo board — users page full page", async ({ page }) => {
    await page.goto("/users/");
    await page.waitForSelector(".users-shell", { timeout: 30_000 });
    const out = path.join(
      process.cwd(),
      "docs/screenshots/demo-users-full.png"
    );
    await page.screenshot({
      path: out,
      fullPage: true,
      scale: "css",
    });
  });

  test("demo board — users page with empty catalog", async ({ page }) => {
    await page.route("**/api/millrace-users", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ users: [] }),
      });
    });

    await page.goto("/users/");
    await page.waitForSelector(".users-shell", { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(page.locator(".flow-nav-menu__trigger")).toBeVisible();
  });

  test("demo board — boards edit board dialog (Demo row)", async ({ page }) => {
    await page.goto("/admin/");
    await page.waitForSelector(".board-shell.admin-shell:not(.preferences-shell)", {
      timeout: 30_000,
    });

    await page
      .getByRole("button", { name: "Edit board Demo", exact: true })
      .click();

    const dialog = page.locator("dialog.flow-modal--edit-board");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.locator(".flow-board-user-access-loading")).toHaveCount(0);
    await expect(
      dialog.locator(".flow-board-user-access-list .flow-board-user-access-option").first()
    ).toBeVisible({ timeout: 15_000 });

    const out = path.join(
      process.cwd(),
      "docs/screenshots/demo-boards-edit-board-dialog.png"
    );
    await dialog.screenshot({ path: out, scale: "css" });

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator("dialog.flow-modal--edit-board")).toHaveCount(0);
  });

  test("demo board — each chart expanded (dialog only)", async ({ page }) => {
    /** Pin "Group by" to Weekly so screenshots are deterministic regardless of saved profile. */
    await page.goto("/charts/?g=weekly");
    await page.waitForSelector(".charts-shell", { timeout: 30_000 });
    await expect(page.locator("#flow-chart-granularity")).toHaveValue("weekly");

    for (const { file, title } of CHART_EXPAND_SHOTS) {
      const card = page.locator("section.charts-chart-card").filter({
        has: page.getByRole("heading", {
          level: 2,
          name: title,
          exact: true,
        }),
      });
      await expect(card).toBeVisible();
      await card.getByRole("button", { name: "Expand chart" }).click();

      const dialog = page.locator("dialog.flow-modal--chart-expand");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(title);
      await expect(dialog.locator(".charts-svg-wrap--expanded svg")).toBeVisible();

      const out = path.join(process.cwd(), "docs/screenshots", file);
      await dialog.screenshot({ path: out, scale: "css" });

      await dialog.getByRole("button", { name: "Close" }).click();
      await expect(
        page.locator("dialog.flow-modal--chart-expand")
      ).toHaveCount(0);
    }
  });
});
