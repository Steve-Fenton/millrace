import { defineConfig } from "@playwright/test";

/** Assumes Millrace is already running (`pnpm start`). Override with MILLRACE_BASE_URL. */
export default defineConfig({
  testDir: "tests/playwright",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.MILLRACE_BASE_URL ?? "http://127.0.0.1:7713",
    viewport: { width: 1024, height: 768 },
    /** Avoid 2× bitmaps on Retina; full-page PNGs can exceed Chromium capture limits. */
    deviceScaleFactor: 1,
  },
});
