import { defineConfig } from "@playwright/test";

/** Assumes Millrace is already running (`pnpm start`). Override with MILLRACE_BASE_URL. */
export default defineConfig({
  testDir: "tests/playwright",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.MILLRACE_BASE_URL ?? "http://127.0.0.1:7713",
    /** 16:10 laptop-ish frame for doc screenshots (not full 1440p, but not legacy 4:3). */
    viewport: { width: 1280, height: 800 },
    /** Avoid 2× bitmaps on Retina; full-page PNGs can exceed Chromium capture limits. */
    deviceScaleFactor: 1,
  },
});
