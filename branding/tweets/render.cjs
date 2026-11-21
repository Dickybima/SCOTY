// Renders the five tweet images (1200×675, plus @2x) from card.html.
//   node branding/tweets/render.cjs
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 2 });
  for (let n = 1; n <= 5; n++) {
    await page.goto("file://" + path.join(__dirname, "card.html") + "?n=" + n, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(__dirname, `tweet-${n}.png`), clip: { x: 0, y: 0, width: 1200, height: 675 } });
  }
  await browser.close();
  console.log("rendered tweet-1.png … tweet-5.png");
})();
