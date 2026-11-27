// Renders update.html to update.png (1200×675) and update@2x.png.
//   node branding/tweets/render-update.cjs
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
  for (const [scale, name] of [[1, "update.png"], [2, "update@2x.png"]]) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: scale });
    await page.goto("file://" + path.join(__dirname, "update.html"), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(__dirname, name), clip: { x: 0, y: 0, width: 1200, height: 675 } });
    await page.close();
  }
  await browser.close();
})();
