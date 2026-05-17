// Optional dev helper. Loads the running dev server in headless Chromium and
// captures full-page + per-day-card screenshots at common widths.
//
//   npm run dev &
//   npx playwright install chromium   # one-time
//   node scripts/screenshot.mjs       # writes tmp/screenshots/*.png
//
// Playwright is not a project dependency on purpose — install it locally
// when you want to use this.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const URL = process.env.SHOT_URL || "http://localhost:5173/tides/";
const OUT = "tmp/screenshots";
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "tablet-768", width: 768, height: 1100 },
  { name: "mobile-390", width: 390, height: 1400 },
  { name: "mobile-320", width: 320, height: 1400 },
];

const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
    });
    await page.goto(URL, { waitUntil: "networkidle", timeout: 20_000 });
    await page
      .waitForSelector(".tide-chart__plot svg", { timeout: 5_000 })
      .catch(() => {});

    const full = `${OUT}/${vp.name}.png`;
    await page.screenshot({ path: full, fullPage: true });

    const card = await page.$(".day-card");
    if (card) {
      const cardFile = `${OUT}/card-${vp.name}.png`;
      await card.screenshot({ path: cardFile });
    }

    console.log(`saved ${full} (${errors.length} runtime issues)`);
    for (const e of errors) console.log(`  ${e}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
