import path from "path";
import { test } from "@playwright/test";

const ACTIVE_BOARD_KEY = "flow:active-board-slug";

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
});
