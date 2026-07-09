import { defineConfig } from "@playwright/test";

const baseURL = process.env.MILLRACE_BASE_URL ?? "http://127.0.0.1:7713";
const port = new URL(baseURL).port || "7713";

/** Starts Millrace when needed for doc screenshots; reuses an existing server locally. */
export default defineConfig({
  testDir: "tests/playwright",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    /** 16:10 laptop-ish frame for doc screenshots (not full 1440p, but not legacy 4:3). */
    viewport: { width: 1280, height: 800 },
    /** Avoid 2× bitmaps on Retina; full-page PNGs can exceed Chromium capture limits. */
    deviceScaleFactor: 1,
  },
  webServer: {
    command: `node server.js ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
