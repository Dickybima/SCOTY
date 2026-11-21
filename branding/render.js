// Renders branding/x-header.html to PNG files next to it.
//   node branding/render.js
// Produces x-header.png (1500×500, upload this to X) and x-header@2x.png.
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const file = "file://" + path.join(__dirname, "x-header.html");
  for (const [scale, name] of [[1, "x-header.png"], [2, "x-header@2x.png"]]) {
    const page = await browser.newPage({ viewport: { width: 1500, height: 500 }, deviceScaleFactor: scale });
    await page.goto(file, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(__dirname, name), clip: { x: 0, y: 0, width: 1500, height: 500 } });
    await page.close();
  }
  await browser.close();
})();
