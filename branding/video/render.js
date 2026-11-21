// Renders meet-scoty.html frame by frame and encodes meet-scoty.mp4 (1920×1080, 30 fps, H.264).
//   node branding/video/render.js
// Needs Playwright (Chromium) and ffmpeg on PATH.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const FPS = 30;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  await page.goto("file://" + path.join(__dirname, "meet-scoty.html"), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const duration = await page.evaluate(() => window.DURATION);
  const frames = Math.round(duration * FPS);

  const out = path.join(__dirname, "meet-scoty.mp4");
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-vf", "scale=1920:1080:flags=lanczos", "-movflags", "+faststart", out,
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
