// Renders update.html (or <name>.html) to <name>.png (1200×675) and <name>@2x.png.
//   node branding/tweets/render-update.cjs [name]
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
  const base = process.argv[2] || "update";
  for (const [scale, name] of [[1, base + ".png"], [2, base + "@2x.png"]]) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: scale });
    await page.goto("file://" + path.join(__dirname, base + ".html"), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(__dirname, name), clip: { x: 0, y: 0, width: 1200, height: 675 } });
    await page.close();
  }
  await browser.close();
})();
