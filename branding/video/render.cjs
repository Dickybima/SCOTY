// Renders a time-driven HTML animation (window.render(t), window.DURATION) to an H.264 MP4.
//
//   node branding/video/render.cjs                                   # meet-scoty.mp4 (1920×1080)
//   node branding/video/render.cjs logo-assemble.html logo-square.mp4 1080 1080
//   node branding/video/render.cjs logo-assemble.html logo-wide.mp4 1920 1080
//
// Args: [html] [out] [width] [height] [cssScale]. HTML pages that size themselves from
// ?w=&h= get those params; others are rendered at width/cssScale and scaled up.
// Needs Playwright (Chromium) and ffmpeg on PATH.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const [html = "meet-scoty.html", outName = "meet-scoty.mp4", w = "1920", h = "1080", scale] = process.argv.slice(2);
const W = +w, H = +h;
const FPS = 30;
// meet-scoty.html is laid out at 1280×720 and scaled 1.5×; canvas pages render at full size.
const S = scale ? +scale : (html === "meet-scoty.html" || html === "introducing-elysium.html" || html === "how-to-launch.html" || html === "leverage-promo.html") ? 1.5 : 1;

(async () => {
  const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage({ viewport: { width: Math.round(W / S), height: Math.round(H / S) }, deviceScaleFactor: S });
  await page.goto("file://" + path.join(__dirname, html) + `?w=${W}&h=${H}`, { waitUntil: "networkidle" });
  await page.evaluate(async () => { await document.fonts.ready; if (window.ready) await window.ready; });
  const duration = await page.evaluate(() => window.DURATION);
  const frames = Math.round(duration * FPS);

  const out = path.join(__dirname, outName);
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-vf", `scale=${W}:${H}:flags=lanczos`, "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });

  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    const png = await page.screenshot({ type: "png" });
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 60 === 0) process.stdout.write(`frame ${i}/${frames}\n`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await browser.close();
  console.log("wrote", out);
})();
