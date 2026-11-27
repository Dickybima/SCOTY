// SCOTY intro preloader — "Venom Vial" ported from the React component
// (venom-vial-preloader.tsx) to plain JavaScript for this static site.
//
// A pixel-art phial fills with venom while a black widow — wearing the SCOTY
// anchor on her back — wraps it in silk. At 100% the stopper pops, venom fog
// floods out and thins away onto the page. Click / Enter skips ahead.
//
// Shown once per browser session on first open. Add ?intro=1 to any URL to
// see it again.
(function () {
  "use strict";

  var KEY = "scoty.intro";
  var force = /[?&]intro=1\b/.test(location.search);
  try { if (!force && sessionStorage.getItem(KEY)) return; } catch (_) {}

  // ---- options (component props) ------------------------------------------------
  var OPT = {
    durationMs: 3600,
    total: 0,
    unit: "MB",
    doneLabel: "Brewed. Ready when you are.",
    hint: "Click to enter",
    tip: "Tug the gem",
    pixel: 1,
    counter: true,
    label: "SCOTY",
    fontHref: "https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500&display=swap",
    font: '"Pixelify Sans", "Silkscreen", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
  };
  // SCOTY colours: black void, lavender venom (Elysium); the logo keeps its lime
  var colors = {
    void: "#000000",
    glass: "#a6acb7",
    venom: "#a78bfa",
    slime: "#befd08",
    gem: "#8b5cf6",
    brass: "#e39a2d",
    spider: "#14141c",
    mark: "#e8233d",
    silk: "#eef7ef",
  };

  // The SCOTY anchor drawn on the widow's back: # silver, + lime slime.
  var LOGO = [
    "....#....",
    "...###...",
    "....#....",
    "..++#....",
    "....#++..",
    "..++#....",
    "....#....",
    "#...#...#",
    "##..#..##",
    ".##+#+##.",
    "..#####..",
    "...+.+...",
    "...+.....",
  ];
  var LOGO_W = 9, LOGO_H = LOGO.length;

  // ---- pure helpers (verbatim from the component) --------------------------------
  var VV_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(function (v) { return (v + 0.5) / 16; });
  function vvBayer(x, y) { return VV_BAYER[((y & 3) << 2) | (x & 3)]; }
  function vvHash(x, y) {
    var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vvNoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = vvHash(xi, yi), b = vvHash(xi + 1, yi), c = vvHash(xi, yi + 1), d = vvHash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function vvFbm(x, y) { return vvNoise(x, y) * 0.62 + vvNoise(x * 2.03 + 17.1, y * 2.03 - 9.4) * 0.38; }
  var VV_KEYS = [[0, 0], [0.16, 0.19], [0.27, 0.23], [0.47, 0.55], [0.6, 0.6], [0.8, 0.88], [0.9, 0.91], [1, 1]];
  function vvSimulated(t) {
    if (!(t > 0)) return 0;
    if (t >= 1) return 1;
    for (var i = 1; i < VV_KEYS.length; i++) {
      var t1 = VV_KEYS[i][0];
      if (t <= t1) {
        var t0 = VV_KEYS[i - 1][0], v0 = VV_KEYS[i - 1][1], k = (t - t0) / (t1 - t0);
        return v0 + (VV_KEYS[i][1] - v0) * k * k * (3 - 2 * k);
      }
    }
    return 1;
  }
  function vvRgb(hex) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    var h = m[1].length === 3 ? m[1].split("").map(function (c) { return c + c; }).join("") : m[1];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function vvShade(hex, amt) {
    var c = vvRgb(hex);
    if (!c) return hex;
    var t = amt < 0 ? 0 : 255, p = Math.min(1, Math.abs(amt));
    return "#" + c.map(function (v) { return Math.round(v + (t - v) * p).toString(16).padStart(2, "0"); }).join("");
  }
  var VV_R = 14, VV_TAIL = 50;
  function vvLayout(W, H, pixel) {
    var s = Math.max(2, Math.round((Math.min(W, H * 1.7) / 420) * (pixel > 0 ? pixel : 1)));
    var BW = Math.max(1, Math.ceil(W / s)), BH = Math.max(1, Math.ceil(H / s));
    var wide = W > H;
    var avail = Math.floor(BW * (wide ? 0.56 : 0.84));
    var L = Math.max(56, Math.min(210, avail - VV_TAIL));
    var x0 = Math.round((BW - (L + VV_TAIL)) / 2);
    var cy = Math.round(BH * (wide ? 0.44 : 0.42));
    var xs = x0 + L, xn = xs + 10, xc = xn + 6, xb = xc + 3, xg = xb + 7 + 12;
    return { s: s, BW: BW, BH: BH, L: L, x0: x0, cy: cy, xs: xs, xn: xn, xc: xc, xb: xb, xg: xg, end: xg + 12 };
  }
  function vvOuter(v, x) {
    if (x < v.x0 || x > v.xb + 7) return -1;
    if (x < v.x0 + VV_R) { var d = v.x0 + VV_R - x; return Math.sqrt(Math.max(0, VV_R * VV_R - d * d)); }
    if (x <= v.xs) return VV_R;
    if (x <= v.xn) return 6 + (VV_R - 6) * (0.5 + 0.5 * Math.cos((Math.PI * (x - v.xs)) / (v.xn - v.xs)));
    if (x <= v.xc) return 6;
    if (x <= v.xb) return 8;
    return 7;
  }
  function vvInner(v, x) {
    if (x < v.x0 || x >= v.xc) return -1;
    if (x < v.x0 + VV_R) { var d = v.x0 + VV_R - x, r = VV_R - 2; return d >= r ? -1 : Math.sqrt(r * r - d * d); }
    return vvOuter(v, x) - 2;
  }
  function vvGem(u, v) {
    var au = Math.abs(u), av = Math.abs(v);
    if (av > 10.5 || au > 12.5 - 0.6 * av) return 0;
    if (av > 9.5 || au > 11.3 - 0.6 * av) return 1;
    if ((v > -3.6 && v < -2.4 && u > -3.6 && u < -0.4) || (u > -3.6 && u < -2.4 && v > -3.6 && v < -1)) return 7;
    var tw = 5 - 0.2 * av;
    if (au <= tw && av <= 4.5) return au > tw - 0.9 || av > 3.6 ? 8 : 3;
    if (v < -4.5) return 2;
    if (v > 4.5) return 6;
    return u > 0 ? 4 : 5;
  }
  var VV_DIGITS = {
    "0": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
    "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
    "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
    "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
    "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
    "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  };
  var VV_PERCENT = ["#..#", "..#.", ".#..", "#..#"];
  function vvCountWidth(text, k) { return text.length * 6 * k - k + 2 + VV_PERCENT[0].length; }
  function vvAmount(pct, total, unit) {
    if (!(total > 0) || !isFinite(total)) return "";
    var p = Math.max(0, Math.min(100, pct));
    return ((total * p) / 100).toFixed(1) + " of " + total.toFixed(1) + (unit ? " " + unit : "");
  }
  function vvVeil(n, b, k) { return n * 0.55 + b * 0.45 < k; }
  var VV_RIDE = [900, 1400, 3200, 1500];
  function vvRide(ms) {
    var wait = VV_RIDE[0], down = VV_RIDE[1], ride = VV_RIDE[2], up = VV_RIDE[3];
    var total = wait + down + ride + up;
    var m = ((ms % total) + total) % total;
    if (m < wait) return 0;
    if (m < wait + down) return (m - wait) / down;
    if (m < wait + down + ride) return 1;
    return 1 - (m - wait - down - ride) / up;
  }
  function vvStreamHead(k, from, to) {
    var e = 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
    return from + (to - from) * e;
  }

  var VV_CSS = [
    ".vvp-root{position:fixed;inset:0;z-index:2147483000;width:100%;height:100vh;height:100svh;overflow:hidden;isolation:isolate;-webkit-tap-highlight-color:transparent}",
    ".vvp-root *,.vvp-root *::before,.vvp-root *::after{box-sizing:border-box}",
    ".vvp-gate{position:absolute;inset:0;z-index:10;background:var(--vvp-void);outline:none;user-select:none;-webkit-user-select:none;touch-action:none;overflow:hidden}",
    ".vvp-gate:focus-visible::after{content:'';position:absolute;inset:8px;border:1px dashed var(--vvp-venom);opacity:.5;pointer-events:none}",
    ".vvp-canvas{position:absolute;left:0;top:0;max-width:none;max-height:none;display:block;pointer-events:none;image-rendering:pixelated;image-rendering:crisp-edges}",
    ".vvp-glow{position:absolute;left:0;top:0;max-width:none;max-height:none;display:block;pointer-events:none;mix-blend-mode:screen;opacity:.95}",
    ".vvp-label,.vvp-hint{position:absolute;left:0;right:0;margin:0;text-align:center;font-family:var(--vvp-font);white-space:nowrap;pointer-events:none;-webkit-font-smoothing:none;opacity:0;transition:opacity .45s steps(3,end),color .3s ease}",
    ".vvp-label{color:var(--vvp-muted);letter-spacing:.04em}",
    ".vvp-label[data-on=true]{opacity:1}",
    ".vvp-label[data-tone=done]{color:var(--vvp-text)}",
    ".vvp-hint{color:var(--vvp-muted);letter-spacing:.22em;text-transform:uppercase}",
    ".vvp-hint[data-on=true]{opacity:.6}",
    ".vvp-hint[data-on=true][data-tone=call]{color:var(--vvp-venom-hi);opacity:.9;animation:vvp-blink 2s steps(2,jump-none) .5s infinite}",
    ".vvp-root[data-phase=lift] .vvp-label,.vvp-root[data-phase=lift] .vvp-hint{opacity:0;animation:none;transition:opacity .25s steps(2,end)}",
    ".vvp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}",
    "@keyframes vvp-blink{0%,100%{opacity:.9}50%{opacity:.4}}",
    "@media (prefers-reduced-motion:reduce){.vvp-hint[data-on=true][data-tone=call]{animation:none}}",
    "html.vvp-lock,html.vvp-lock body{overflow:hidden!important}",
  ].join("\n");

  // ---- constants ----------------------------------------------------------------
  var INTRO_MS = 1700, FULL_MS = 1500, HOLD_MS = 3200, POUR_MS = 800, LIFT_MS = 3100;
  var FLOOD_MS = 1500, FLOOD_AT = 380, CLEAR_AT = 1650;
  var CHAIN_LEN = 30, CHAIN_N = 12, GEM_A = [-6, 10], GRAVITY = 300, SPIDER_Z = 2;

  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeBack(t) { return 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2); }
  function pk(hex) { var c = vvRgb(hex) || [255, 0, 255]; return ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0; }
  function mixPk(a, b, t) {
    var r = (a & 255) + ((b & 255) - (a & 255)) * t;
    var g = ((a >>> 8) & 255) + (((b >>> 8) & 255) - ((a >>> 8) & 255)) * t;
    var bl = ((a >>> 16) & 255) + (((b >>> 16) & 255) - ((a >>> 16) & 255)) * t;
    return ((255 << 24) | (Math.round(bl) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
  }

  var C = colors;
  var K = {
    void: pk(C.void), starDim: pk(vvShade(C.glass, -0.55)), star: pk(vvShade(C.glass, 0.35)),
    glassHi: pk(vvShade(C.glass, 0.62)), glassTop: pk(vvShade(C.glass, 0.12)), glassEdge: pk(vvShade(C.glass, -0.22)),
    glassBot: pk(vvShade(C.glass, -0.42)), glassDeep: pk(vvShade(C.glass, -0.62)), glassIn: pk(vvShade(C.void, 0.07)),
    slime: pk(C.slime), v2: pk(vvShade(C.venom, 0.62)), v1: pk(vvShade(C.venom, 0.3)), v0: pk(C.venom), vd1: pk(vvShade(C.venom, -0.24)),
    vd2: pk(vvShade(C.venom, -0.44)), vapor: pk(vvShade(C.venom, -0.5)), mist1: pk(vvShade(C.venom, -0.8)),
    mist2: pk(vvShade(C.venom, -0.68)), fog0: pk(vvShade(C.venom, -0.84)), fog1: pk(vvShade(C.venom, -0.72)),
    fog2: pk(vvShade(C.venom, -0.56)), g1: pk(vvShade(C.gem, -0.66)), g2: pk(vvShade(C.gem, 0.55)),
    g3: pk(vvShade(C.gem, 0.22)), g4: pk(C.gem), g5: pk(vvShade(C.gem, -0.3)), g6: pk(vvShade(C.gem, -0.52)),
    g7: pk(vvShade(C.gem, 0.85)), bD: pk(vvShade(C.brass, -0.5)), bM: pk(C.brass), bL: pk(vvShade(C.brass, 0.3)),
    bH: pk(vvShade(C.brass, 0.62)), sD: pk(vvShade(C.glass, -0.45)), sM: pk(vvShade(C.glass, -0.12)),
    sL: pk(vvShade(C.glass, 0.4)), body: pk(C.spider), rim: pk(vvShade(C.spider, 0.3)), edge: pk(vvShade(C.spider, 0.12)),
    gloss: pk(vvShade(C.spider, 0.62)), leg: pk(vvShade(C.glass, -0.28)), knee: pk(vvShade(C.glass, 0.12)),
    mark: pk(C.mark), markD: pk(vvShade(C.mark, -0.4)), silk: pk(C.silk), silkDim: pk(vvShade(C.silk, -0.4)),
    digit: pk(vvShade(C.silk, 0.4)), digitLo: pk(vvShade(C.glass, 0.25)), shadow: pk(vvShade(C.void, 0.14)),
    white: pk("#ffffff"), logo: pk("#e6e9ee"), logoLo: pk("#9aa1ad"),
  };

  // ---- DOM ----------------------------------------------------------------------
  var style = document.createElement("style");
  style.textContent = VV_CSS;
  document.head.appendChild(style);
  if (OPT.fontHref && !document.querySelector('link[data-vvp-fonts]')) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = OPT.fontHref;
    link.setAttribute("data-vvp-fonts", "1");
    document.head.appendChild(link);
  }

  var root = document.createElement("div");
  root.className = "vvp-root";
  root.setAttribute("data-phase", "load");
  root.style.setProperty("--vvp-void", C.void);
  root.style.setProperty("--vvp-venom", C.venom);
  root.style.setProperty("--vvp-venom-hi", vvShade(C.venom, 0.45));
  root.style.setProperty("--vvp-text", vvShade(C.silk, 0.2));
  root.style.setProperty("--vvp-muted", vvShade(C.glass, -0.12));
  root.style.setProperty("--vvp-font", OPT.font);
  root.innerHTML =
    '<div class="vvp-gate" role="progressbar" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
    '<canvas class="vvp-canvas" aria-hidden="true"></canvas><canvas class="vvp-glow" aria-hidden="true"></canvas>' +
    '<p class="vvp-label" aria-hidden="true"> </p><p class="vvp-hint" aria-hidden="true"> </p>' +
    '<span class="vvp-sr" aria-live="polite"></span></div>';
  var gate = root.querySelector(".vvp-gate");
  var cv = root.querySelector(".vvp-canvas");
  var gl = root.querySelector(".vvp-glow");
  var labelEl = root.querySelector(".vvp-label");
  var hintEl = root.querySelector(".vvp-hint");
  var srEl = root.querySelector(".vvp-sr");
  gate.setAttribute("aria-label", OPT.label + " is loading");
  document.documentElement.classList.add("vvp-lock");
  (document.body || document.documentElement).appendChild(root);

  // ---- state --------------------------------------------------------------------
  var phase = "load", phaseAt = performance.now(), pct = 0, arrived = false, fontsReady = !OPT.fontHref;
  var shownP = 0, rush = false, lay = null, pointer = null, still = false;
  var gem = { mode: "seat", x: 0, y: 0, vx: 0, vy: 0, ang: 0, va: 0, gx: 0, gy: 0, offX: 0, offY: 0, pulled: 0 };
  var chain = [];
  var spider = { x: 0, y: -40, head: Math.PI / 2, gait: 0, mode: 0, vx: 0, hop: 0, hv: 0, landed: false, rideAt: 0, ride: 0 };
  var slosh = { a: 0, va: 0 };
  var sparks = [], puffs = [], bubbles = [], stars = [];

  function go(next) {
    phase = next;
    phaseAt = performance.now();
    root.setAttribute("data-phase", next);
    renderUI();
  }

  function renderUI() {
    var loading = phase === "load";
    var brewed = phase === "full" || phase === "hold";
    var amount = vvAmount(pct, OPT.total, OPT.unit);
    var labelText = loading ? amount : brewed ? OPT.doneLabel : "";
    var hintText = brewed ? OPT.hint : loading && OPT.tip ? OPT.tip : "";
    var ready = !!lay && fontsReady;
    var s = lay ? lay.s : 3;
    var labelTop = lay ? (lay.cy + VV_R + 12 + (OPT.counter ? 22 : 2)) * s : 0;
    var labelSize = Math.max(11, Math.round(s * 4.2));
    var hintTop = lay ? Math.min(lay.BH * s - labelSize * 3.4, labelTop + labelSize * 4.2 + s * 18) : 0;
    labelEl.textContent = labelText || " ";
    labelEl.setAttribute("data-on", String(ready && !!labelText && (arrived || !loading)));
    labelEl.setAttribute("data-tone", brewed ? "done" : "load");
    labelEl.style.top = labelTop + "px";
    labelEl.style.fontSize = labelSize + "px";
    hintEl.textContent = hintText || " ";
    hintEl.setAttribute("data-on", String(ready && !!hintText && (arrived || !loading)));
    hintEl.setAttribute("data-tone", brewed ? "call" : "tip");
    hintEl.style.top = hintTop + "px";
    hintEl.style.fontSize = Math.max(11, Math.round(labelSize * 0.8)) + "px";
    gate.setAttribute("aria-valuenow", String(pct));
    gate.setAttribute("aria-valuetext", loading ? pct + "%" : "Loaded. Press Enter to continue.");
    srEl.textContent = brewed ? OPT.doneLabel + " " + OPT.hint + "." : "";
  }

  // fonts
  if (OPT.fontHref) {
    var fontDone = function () { if (!fontsReady) { fontsReady = true; renderUI(); } };
    setTimeout(fontDone, 1600);
    if (document.fonts && document.fonts.load) document.fonts.load('400 1em "Pixelify Sans"').then(fontDone, fontDone);
  }

  // reduced motion
  if (typeof matchMedia !== "undefined") {
    var mq = matchMedia("(prefers-reduced-motion: reduce)");
    still = mq.matches;
    if (mq.addEventListener) mq.addEventListener("change", function () { still = mq.matches; });
  }

  // layout follows the viewport
  function measure() {
    var r = root.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    var next = vvLayout(r.width, r.height, OPT.pixel);
    if (lay && lay.s === next.s && lay.BW === next.BW && lay.BH === next.BH) return;
    lay = next;
    stars = [];
    var n = Math.round((next.BW * next.BH) / 620);
    for (var i = 0; i < n; i++) {
      var x = Math.floor(vvHash(i, 11) * next.BW), y = Math.floor(vvHash(i, 23) * next.BH), roll = vvHash(i, 37);
      var kind = roll < 0.62 ? 0 : roll < 0.8 ? 1 : roll < 0.9 ? 2 : 3;
      if (kind === 2 && Math.abs(y - next.cy) < 26 && x > next.x0 - 12 && x < next.end + 12) continue;
      stars.push({ x: x, y: y, kind: kind, ph: vvHash(i, 51) * 6.28, sp: 0.6 + vvHash(i, 67) * 1.8, tone: Math.floor(vvHash(i, 79) * 3) });
    }
    var ax = next.xb + 3, ay = next.cy + 8, gx = next.xg + GEM_A[0], gy = next.cy + GEM_A[1];
    chain = [];
    for (var j = 0; j < CHAIN_N; j++) {
      var t = j / (CHAIN_N - 1);
      var cx = ax + (gx - ax) * t, cyy = ay + (gy - ay) * t + Math.sin(t * Math.PI) * 12;
      chain.push({ x: cx, y: cyy, ox: cx, oy: cyy });
    }
    if (gem.mode === "seat") { gem.x = gx; gem.y = gy; }
    renderUI();
  }
  measure();
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(measure).observe(root);
  else addEventListener("resize", measure);

  // ---- frame loop ---------------------------------------------------------------
  var raf = 0, last = performance.now(), lastPct = -1, entered = "", img = null, gimg = null;
  var buf = new Uint32Array(1), gbuf = new Uint32Array(1);
  var nextPuff = 0, nextSpark = 0, nextBubble = 0, glintAt = 0, flash = 0, arrivedSent = false;

  function burst(x, y, n, speed, now, spread) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, spd = speed * (0.35 + Math.random() * 0.65);
      sparks.push({
        x: x + Math.cos(a) * spread * Math.random(), y: y + Math.sin(a) * spread * 0.4 * Math.random(),
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.75 - speed * 0.2,
        born: now, life: 700 + Math.random() * 1000, kind: Math.random() < 0.45 ? 1 : 0, tone: Math.floor(Math.random() * 4),
      });
    }
  }

  function enter(ph, now) {
    var v = lay, sp = spider;
    if (ph === "load") {
      shownP = 0; rush = false; lastPct = -1; pct = 0; arrived = false; arrivedSent = false;
      sp.x = v ? v.x0 + 9 : 0; sp.y = -40; sp.mode = 0; sp.head = Math.PI / 2; sp.landed = false; sp.vx = 0;
      gem.mode = "seat"; gem.ang = 0; gem.va = 0;
      sparks = []; puffs = []; bubbles = [];
      renderUI();
    }
    if (ph === "full" && v) {
      flash = 1;
      if (!still) burst(v.x0 + v.L * 0.55, v.cy, 46, 120, now, v.L * 0.5);
      slosh.va += 2.2;
      if (gem.mode !== "held") { gem.mode = "free"; gem.vx = 55; gem.vy = -150; gem.va = 7; }
      if (!still) burst(v.xb + 8, v.cy - 6, 70, 170, now, 5);
    }
    if (ph === "lift" && v) {
      gate.style.background = "transparent";
      document.documentElement.classList.remove("vvp-lock");
      if (gem.mode === "seat" || gem.mode === "ret") { gem.mode = "free"; gem.vx = 70; gem.vy = -110; gem.va = 6; }
      else gem.mode = "free";
      if (!still) burst(v.xb + 8, v.cy, 30, 150, now, 4);
      sp.mode = 2;
    }
  }

  function finish() {
    cancelAnimationFrame(raf);
    document.documentElement.classList.remove("vvp-lock");
    root.remove();
    try { sessionStorage.setItem(KEY, "1"); } catch (_) {}
  }

  function tick(now) {
    var dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    var v = lay;
    var t = still ? 0 : now / 1000;

    if (phase !== entered) { entered = phase; enter(entered, now); }
    var ph = phase;
    var since = now - phaseAt;
    var intro = still ? 0 : INTRO_MS;

    if (ph === "load") {
      var target = vvSimulated(Math.max(0, since - intro) / Math.max(600, OPT.durationMs));
      if (since < intro) target = 0;
      if (since < intro + (still ? 0 : POUR_MS)) target = 0;
      if (rush && since >= intro) target = 1;
      var rate = rush ? 0.1 : 1;
      var shown0 = shownP;
      shown0 += (target - shown0) * Math.min(1, rate * (dt / 0.0167));
      if (Math.abs(target - shown0) < 0.002) shown0 = target;
      shownP = shown0;
      var p = Math.round(shown0 * 100);
      if (p !== lastPct) { lastPct = p; pct = p; gate.setAttribute("aria-valuenow", String(p)); gate.setAttribute("aria-valuetext", p + "%"); }
      if (!arrivedSent && since > intro * 0.8) { arrivedSent = true; arrived = true; renderUI(); }
      if (shown0 >= 1 && since > intro) go("full");
    } else if (ph === "full" && since > FULL_MS) go("hold");
    else if (ph === "hold" && since > HOLD_MS && gem.mode !== "held") go("lift");
    else if (ph === "lift" && since > LIFT_MS) { finish(); return; }

    if (!v) { raf = requestAnimationFrame(tick); return; }
    var BW = v.BW, BH = v.BH, s = v.s, x0 = v.x0, cy = v.cy, xs = v.xs, xn = v.xn, xc = v.xc, xb = v.xb;
    var c = K;

    if (cv.width !== BW || cv.height !== BH || !img) {
      cv.width = BW; cv.height = BH; gl.width = BW; gl.height = BH;
      cv.style.width = BW * s + "px"; cv.style.height = BH * s + "px";
      gl.style.width = BW * s + "px"; gl.style.height = BH * s + "px";
      gl.style.filter = "blur(" + Math.round(s * 4.5) + "px)";
      var cx0 = cv.getContext("2d"), gx0 = gl.getContext("2d");
      if (!cx0 || !gx0) { raf = requestAnimationFrame(tick); return; }
      img = cx0.createImageData(BW, BH);
      gimg = gx0.createImageData(BW, BH);
      buf = new Uint32Array(img.data.buffer);
      gbuf = new Uint32Array(gimg.data.buffer);
    }
    function put(x, y, col) { if (x >= 0 && y >= 0 && x < BW && y < BH) buf[(y | 0) * BW + (x | 0)] = col; }
    function glow(x, y, col) { if (x >= 0 && y >= 0 && x < BW && y < BH) gbuf[(y | 0) * BW + (x | 0)] = col; }
    function blend(x, y, col, a) { if (x >= 0 && y >= 0 && x < BW && y < BH) { var i = (y | 0) * BW + (x | 0); buf[i] = mixPk(buf[i], col, a); } }
    function line(ax, ay, bx, by, col) {
      var x = Math.round(ax), y = Math.round(ay), x1 = Math.round(bx), y1 = Math.round(by);
      var dx = Math.abs(x1 - x), dy = -Math.abs(y1 - y), sx = x < x1 ? 1 : -1, sy = y < y1 ? 1 : -1, err = dx + dy;
      for (var k = 0; k < 200; k++) {
        put(x, y, col);
        if (x === x1 && y === y1) break;
        var e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
      }
    }

    var shown = ph === "load" ? shownP : 1;
    var introP = ph === "load" ? (still ? 1 : clamp01((since - 80) / 1000)) : 1;
    var lifting = ph === "lift";
    flash = Math.max(0, flash - dt * 1.4);

    // ---- simulation
    var ptr = pointer;
    if (ptr && !still && now - ptr.t < 120 && Math.abs(ptr.y - cy) < 26 && ptr.x > x0 - 6 && ptr.x < xn) {
      slosh.va += Math.max(-1, Math.min(1, ptr.vx / 220)) * dt * 26;
    }
    slosh.va += (-slosh.a * 38 - slosh.va * 3.6) * dt;
    slosh.a = Math.max(-1.2, Math.min(1.2, slosh.a + slosh.va * dt));
    if (still) slosh.a = 0;

    var ax = xb + 3, ay = cy + 8, homeX = v.xg + GEM_A[0], homeY = cy + GEM_A[1];
    var gemIn = ph === "load" ? (still ? 1 : clamp01((since - 980) / 420)) : 1;
    var brewed = ph === "full" || ph === "hold";
    if (gem.mode === "seat") { gem.x = homeX; gem.y = homeY; gem.vx = 0; gem.vy = 0; }
    else if (gem.mode === "held") {
      var nx0 = gem.x + (gem.gx - gem.x) * Math.min(1, dt * 22), ny0 = gem.y + (gem.gy - gem.y) * Math.min(1, dt * 22);
      gem.vx = (nx0 - gem.x) / Math.max(dt, 0.001); gem.vy = (ny0 - gem.y) / Math.max(dt, 0.001);
      gem.x = nx0; gem.y = ny0;
    } else if (gem.mode === "free") {
      if (brewed && !still) gem.vx += Math.sin(t * 1.35) * 16 * dt;
      gem.vy += GRAVITY * dt;
      gem.vx *= Math.pow(0.55, dt); gem.vy *= Math.pow(0.55, dt);
      gem.x += gem.vx * dt; gem.y += gem.vy * dt;
    } else {
      gem.vx += ((homeX - gem.x) * 140 - gem.vx * 17) * dt;
      gem.vy += ((homeY - gem.y) * 140 - gem.vy * 17) * dt;
      gem.x += gem.vx * dt; gem.y += gem.vy * dt;
      if (Math.hypot(homeX - gem.x, homeY - gem.y) < 0.45 && Math.hypot(gem.vx, gem.vy) < 8 && Math.abs(gem.ang) < 0.05) {
        gem.mode = "seat"; gem.ang = 0; gem.va = 0; glintAt = now; slosh.va += 0.8;
      }
    }
    if (gem.mode !== "seat") {
      var gdx = gem.x - ax, gdy = gem.y - ay, gd = Math.hypot(gdx, gdy);
      if (gd > CHAIN_LEN) {
        var gnx = gdx / gd, gny = gdy / gd;
        gem.x = ax + gnx * CHAIN_LEN; gem.y = ay + gny * CHAIN_LEN;
        var vr = gem.vx * gnx + gem.vy * gny;
        if (vr > 0) { gem.vx -= gnx * vr; gem.vy -= gny * vr; }
      }
      gem.pulled = Math.hypot(gem.x - homeX, gem.y - homeY);
    } else gem.pulled = 0;

    if (chain.length === CHAIN_N) {
      var seg = CHAIN_LEN / (CHAIN_N - 1);
      for (var ci = 1; ci < CHAIN_N - 1; ci++) {
        var cn = chain[ci], cvx = (cn.x - cn.ox) * 0.96, cvy = (cn.y - cn.oy) * 0.96;
        cn.ox = cn.x; cn.oy = cn.y; cn.x += cvx; cn.y += cvy + GRAVITY * 0.6 * dt * dt;
      }
      for (var it = 0; it < 12; it++) {
        chain[0].x = ax; chain[0].y = ay; chain[CHAIN_N - 1].x = gem.x; chain[CHAIN_N - 1].y = gem.y;
        for (var cj = 0; cj < CHAIN_N - 1; cj++) {
          var ca0 = chain[cj], cb0 = chain[cj + 1], cdx = cb0.x - ca0.x, cdy = cb0.y - ca0.y, cd = Math.hypot(cdx, cdy) || 0.0001;
          if (cd <= seg) continue;
          var f = (cd - seg) / cd;
          var wa = cj === 0 ? 0 : cj + 1 === CHAIN_N - 1 ? 1 : 0.5;
          var wb = cj + 1 === CHAIN_N - 1 ? 0 : cj === 0 ? 1 : 0.5;
          ca0.x += cdx * f * wa; ca0.y += cdy * f * wa; cb0.x -= cdx * f * wb; cb0.y -= cdy * f * wb;
        }
      }
    }
    (function () {
      var target = 0;
      if (gem.mode === "free" || gem.mode === "held") {
        var prev = chain[CHAIN_N - 2] || { x: ax, y: ay };
        var dx = gem.x - prev.x, dy = gem.y - prev.y, d = Math.hypot(dx, dy) || 1;
        dx /= d; dy /= d;
        var taut = clamp01((Math.hypot(gem.x - ax, gem.y - ay) / CHAIN_LEN - 0.55) / 0.4);
        dx = dx * taut; dy = dy * taut + (1 - taut);
        target = Math.atan2(-dy, -dx) - Math.atan2(GEM_A[1], GEM_A[0]);
      }
      var diff = target - gem.ang;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      gem.va += (diff * 70 - gem.va * 7) * dt;
      gem.ang += gem.va * dt;
      if (still) gem.ang = target;
    })();
    var ca = Math.cos(gem.ang), sa = Math.sin(gem.ang);
    var gcx = gem.x - (ca * GEM_A[0] - sa * GEM_A[1]);
    var gcy = gem.y - (sa * GEM_A[0] + ca * GEM_A[1]);
    var open = gem.mode !== "seat" && gem.pulled > 3;

    var sp = spider;
    var fillStart = x0 + 2, fillEnd = xn + 3;
    var xf = fillStart + (fillEnd - fillStart) * shown;
    var surfaceY = function (x) { return cy - Math.max(3, vvOuter(v, x)) + 3.5 - (SPIDER_Z - 1.6) * 3; };
    if (sp.mode === 0) {
      var landX = x0 + 9, landY = surfaceY(landX);
      var k0 = still ? 1 : clamp01((since - 650) / 900);
      sp.x = landX;
      sp.y = -24 + (landY + 24) * easeBack(k0);
      sp.head = Math.PI / 2 + (Math.atan2(-(vvOuter(v, landX + 1) - vvOuter(v, landX - 1)), 2) - Math.PI / 2) * clamp01((k0 - 0.85) / 0.15);
      if (k0 >= 1) { sp.mode = 1; sp.landed = true; slosh.va -= 0.6; }
    } else if (sp.mode === 1 && brewed && Math.abs(sp.x - (xb + 3)) < 1.5 && since > 700) {
      sp.mode = 3; sp.rideAt = now;
    } else if (sp.mode === 3) {
      var u = still ? 0 : vvRide(now - sp.rideAt);
      var pts = chain.length === CHAIN_N ? chain : [{ x: ax, y: ay }];
      var fi = u * (pts.length - 1), i0 = Math.min(pts.length - 1, Math.floor(fi)), i1 = Math.min(pts.length - 1, i0 + 1), kk = fi - i0;
      var px = pts[i0].x + (pts[i1].x - pts[i0].x) * kk, py = pts[i0].y + (pts[i1].y - pts[i0].y) * kk;
      var dir = Math.atan2(pts[i1].y - pts[i0].y, pts[i1].x - pts[i0].x);
      if (u >= 1) { px = gcx; py = gcy - 6; dir = Math.PI / 2; }
      var goingUp = u < sp.ride - 1e-4;
      sp.gait += Math.abs(u - sp.ride) * 40;
      sp.ride = u; sp.x = px; sp.y = py;
      var dd0 = (goingUp ? dir + Math.PI : dir) - sp.head;
      dd0 = Math.atan2(Math.sin(dd0), Math.cos(dd0));
      sp.head += dd0 * Math.min(1, dt * 10);
      if (!brewed) sp.mode = ph === "lift" ? 2 : 1;
    } else if (sp.mode === 1) {
      var tx = ph === "load" ? Math.max(x0 + 9, Math.min(xn - 2, xf + 1)) : xb + 3;
      var want = Math.max(-1, Math.min(1, (tx - sp.x) / 6));
      var maxV = ph === "load" ? 58 : 40;
      sp.vx += (want * maxV - sp.vx) * Math.min(1, dt * 7);
      if (still) { sp.x = tx; sp.vx = 0; } else sp.x += sp.vx * dt;
      sp.gait += Math.abs(sp.vx) * dt * 0.55;
      var slope = -(vvOuter(v, sp.x + 1.5) - vvOuter(v, sp.x - 1.5)) / 3;
      var head = Math.atan(slope) * 0.8;
      sp.head += (head - sp.head) * Math.min(1, dt * 9);
      sp.hv += GRAVITY * 1.4 * dt;
      sp.hop = Math.min(0, sp.hop + sp.hv * dt);
      if (sp.hop >= 0) sp.hv = 0;
      sp.y = surfaceY(sp.x) + sp.hop;
    } else {
      var kc = clamp01((since - 220) / 1100);
      sp.head += (-Math.PI / 2 - sp.head) * Math.min(1, dt * 8);
      sp.y -= (40 + 260 * kc * kc) * dt;
      sp.gait += dt * 14;
    }

    // ---- paint
    buf.fill(c.void);
    gbuf.fill(0);

    var starOn = ph === "load" ? clamp01(since / 700) : 1;
    for (var si = 0; si < stars.length; si++) {
      var st = stars[si];
      var tw = 0.5 + 0.5 * Math.sin(t * st.sp + st.ph);
      if (tw * starOn < 0.25) continue;
      if (st.kind === 0) put(st.x, st.y, tw > 0.75 ? c.star : c.starDim);
      else if (st.kind === 1) {
        var col1 = st.tone === 0 ? c.v1 : st.tone === 1 ? c.bL : c.star;
        put(st.x, st.y, col1);
        if (tw > 0.85) glow(st.x, st.y, col1);
      } else if (st.kind === 2) {
        var col2 = st.tone === 0 ? c.v2 : st.tone === 1 ? c.bH : c.glassHi;
        put(st.x, st.y, col2);
        if (tw > 0.55) {
          put(st.x - 1, st.y, c.vd1); put(st.x + 1, st.y, c.vd1); put(st.x, st.y - 1, c.vd1); put(st.x, st.y + 1, c.vd1);
          glow(st.x, st.y, col2);
        }
      } else {
        var yy = ((((st.y - t * st.sp * 3) % BH) + BH) % BH) | 0;
        var xx = (st.x + Math.sin(t * 0.7 + st.ph) * 3) | 0;
        put(xx, yy, c.vd2); put(xx + 1, yy, c.vd2); put(xx, yy + 1, c.vd2); put(xx + 1, yy + 1, c.vapor);
        glow(xx, yy, c.vd2);
      }
    }

    // toxic haze behind the vial
    var hz = (0.18 + 0.82 * shown) * introP + (open ? 0.25 : 0);
    if (hz > 0.02) {
      var hx0 = Math.max(0, x0 - 34), hx1 = Math.min(BW - 1, v.end + 34), hy0 = Math.max(0, cy - 44), hy1 = Math.min(BH - 1, cy + 44);
      var mx = (x0 + v.end) / 2, hw = (v.end - x0) / 2 + 34;
      for (var hy = hy0; hy <= hy1; hy++) {
        var ey = (hy - cy) / 44;
        for (var hx = hx0; hx <= hx1; hx++) {
          var ex = (hx - mx) / hw;
          var fall = 1 - ex * ex - ey * ey * 1.15;
          if (fall <= 0) continue;
          var hn = vvFbm(hx * 0.034 + t * 0.07, hy * 0.075 + Math.sin(hx * 0.021 + t * 0.4) * 0.7 - t * 0.05);
          var hr = 1 - Math.abs(hn - 0.5) * 3.4;
          if (hr <= 0) continue;
          var val = hr * hr * Math.min(1, fall * 1.6) * hz;
          if (val > vvBayer(hx, hy) * 0.7 + 0.2) {
            var hcol = val > 0.62 ? c.mist2 : c.mist1;
            buf[hy * BW + hx] = hcol; gbuf[hy * BW + hx] = hcol;
          }
        }
      }
    }

    // the vial
    var revealX = x0 + introP * (xb + 8 - x0);
    var wrapX = ph === "load" ? (sp.landed ? sp.x - 5 : x0 - 20) : xn + 2;
    var pourK = ph === "load" && !still ? (since - intro) / POUR_MS : 2;
    var streamA = ph !== "load" || still ? 0 : pourK < 0 ? 0 : pourK < 1 ? 1 : clamp01(1 - shown * 3.2);
    var streamHead = pourK < 1 ? vvStreamHead(pourK, xn + 2, fillStart + 2) : fillStart + 2;
    var P = 15, sl = slosh.a;
    var wob = still ? 0 : 0.45 + Math.min(1.2, Math.abs(slosh.va) * 0.35);
    for (var x = x0; x < xc; x++) {
      if (x >= revealX) break;
      if (x < 0 || x >= BW) continue;
      var ro = vvOuter(v, x + 0.5);
      if (ro <= 0) continue;
      var ri = vvInner(v, x + 0.5);
      var yTop = Math.ceil(cy - ro - 0.5), yBot = Math.floor(cy + ro - 0.5);
      for (var y = yTop; y <= yBot; y++) {
        if (y < 0 || y >= BH) continue;
        var dy = y + 0.5 - cy, ady = Math.abs(dy);
        if (ady > ro) continue;
        var i = y * BW + x, b = vvBayer(x, y);
        if (ri > 0 && ady < ri) {
          var ny = dy / ri;
          var front = xf + sl * ny * 5 + Math.sin(y * 0.9 + t * 7) * wob;
          if (x < front && shown > 0) {
            if (x >= front - 1.3) { buf[i] = c.v2; gbuf[i] = c.v1; }
            else {
              var n = vvNoise(x * 0.11 - t * 0.9, y * 0.24 + Math.sin(x * 0.07 + t * 1.3) * 0.9);
              var l = 0.55 - ny * 0.28 + (n - 0.5) * 0.7 + flash * 0.45;
              if (ny < -0.62) l += 0.32;
              if (ny > 0.66) l -= 0.22;
              var q = l + (b - 0.5) * 0.24;
              buf[i] = q > 0.98 ? c.v2 : q > 0.7 ? c.v1 : q > 0.4 ? c.v0 : q > 0.2 ? c.vd1 : c.vd2;
              gbuf[i] = q > 0.4 ? c.v0 : c.vd1;
            }
          } else {
            buf[i] = c.glassIn;
            var painted = false;
            if (streamA > 0 && x >= streamHead && x < xn + 3) {
              var sn = vvNoise(x * 0.09 - t * 2.4, y * 0.3 + t * 0.6);
              var thick = (0.22 + 0.3 * sn + 0.18 * clamp01((x - streamHead) / 30)) * streamA;
              var mid = 0.32 + Math.sin(x * 0.07 - t * 3) * 0.12;
              var sd = Math.abs(ny - mid);
              if (sd < thick && sn + (b - 0.5) * 0.3 > 0.22) {
                var sq = sn - sd * 0.8 + (x - streamHead < 3 ? 0.4 : 0);
                buf[i] = sq > 0.75 ? c.v2 : sq > 0.5 ? c.v1 : sq > 0.3 ? c.v0 : c.vd1;
                gbuf[i] = c.v0;
                painted = true;
              }
            }
            if (painted) continue;
            if (shown > 0.005) {
              var ahead = x - front;
              var dens = Math.exp(-ahead / 16) * vvFbm(x * 0.13 - t * 1.6, y * 0.3 + t * 0.4) * 1.25;
              if (dens > b * 0.9 + 0.12) { buf[i] = dens > 0.55 ? c.vd2 : c.vapor; gbuf[i] = c.vapor; }
            }
          }
        } else {
          var outer = ady > ro - 1, top = dy < 0;
          var wcol = top ? (outer ? c.glassEdge : c.glassTop) : outer ? c.glassDeep : c.glassBot;
          if (x < x0 + 3 && !outer) wcol = c.glassTop;
          if (!outer && x < xf && shown > 0) { wcol = mixPk(wcol, c.v1, 0.45); gbuf[i] = c.vd1; }
          buf[i] = wcol;
        }
        if (x < wrapX && x < xn - 1) {
          var kw = x - x0 + dy * 0.55, idx = Math.floor(kw / P), m = kw - idx * P;
          if (m < 2 && idx * P + x0 + ro * 0.55 < wrapX) {
            var fresh = ph === "load" && idx * P + x0 + ro * 0.55 > wrapX - P;
            buf[i] = m < 1 ? (fresh ? c.white : c.silk) : mixPk(buf[i], c.silkDim, 0.7);
          }
        }
      }
    }
    (function () {
      var yh = cy - VV_R + 3;
      var segs = [[x0 + 7, x0 + v.L * 0.5], [x0 + v.L * 0.56, x0 + v.L * 0.63], [x0 + v.L * 0.67, x0 + v.L * 0.7], [xs - 4, xs - 1]];
      for (var a = 0; a < segs.length; a++) for (var hx2 = Math.round(segs[a][0]); hx2 < segs[a][1] && hx2 < revealX; hx2++) blend(hx2, yh, c.glassHi, 0.8);
      for (var hx3 = x0 + 12; hx3 < xs - 8 && hx3 < revealX; hx3++) if ((hx3 >> 2) % 3 !== 0) blend(hx3, cy + VV_R - 4, c.glassHi, 0.16);
      if (revealX > x0 + 4) { blend(x0 + 3, cy - 5, c.glassHi, 0.7); blend(x0 + 3, cy - 4, c.glassHi, 0.7); blend(x0 + 4, cy - 7, c.glassHi, 0.6); }
    })();
    if (introP > 0 && introP < 1) {
      var rx = Math.floor(revealX), rro = vvOuter(v, rx);
      if (rro > 0) [cy - rro, cy + rro - 1].forEach(function (yy2) { put(rx, Math.round(yy2), c.white); glow(rx, Math.round(yy2), c.v1); });
    }

    // bubbles
    if (!still && shown > 0.04 && ph !== "lift" && now > nextBubble) {
      nextBubble = now + 90 + Math.random() * (260 - Math.min(200, Math.abs(slosh.va) * 80));
      var bx = fillStart + 3 + Math.random() * Math.max(1, xf - fillStart - 6);
      var bri = vvInner(v, bx);
      if (bri > 2) bubbles.push({ x: bx, y: cy + bri - 1.5, vy: -(5 + Math.random() * 9), ring: Math.random() < 0.3 });
    }
    bubbles = bubbles.filter(function (bb) {
      bb.y += bb.vy * dt;
      bb.x += Math.sin(t * 3 + bb.y) * 2 * dt + slosh.a * 4 * dt;
      var r2 = vvInner(v, bb.x);
      if (r2 <= 0 || bb.y < cy - r2 + 1.5 || bb.x >= xf - 1) return false;
      var bx2 = Math.round(bb.x), by2 = Math.round(bb.y);
      if (bb.ring) { put(bx2 - 1, by2, c.v2); put(bx2 + 1, by2, c.v2); put(bx2, by2 - 1, c.v2); put(bx2, by2 + 1, c.v2); }
      else put(bx2, by2, c.v2);
      return true;
    });

    // mist from the open neck
    if (!still && ((open && !brewed) || lifting) && now > nextPuff) {
      var jet = lifting && since < 1000;
      nextPuff = now + (jet ? 12 : 45);
      for (var pi = 0; pi < (jet ? 3 : 1); pi++) {
        var pa = (Math.random() - 0.5) * (jet ? 1.6 : 0.9) - 0.15;
        var pspd = (jet ? 70 : 26) + Math.random() * (jet ? 90 : 26);
        puffs.push({ x: xb + 7, y: cy + (Math.random() - 0.5) * 6, vx: Math.cos(pa) * pspd, vy: Math.sin(pa) * pspd - 6, born: now,
          life: (jet ? 1300 : 1500) + Math.random() * 600, r0: 2, r1: jet ? 22 + Math.random() * 14 : 10 + Math.random() * 8 });
      }
    }
    if (puffs.length) {
      var keepP = [];
      for (var pj = 0; pj < puffs.length; pj++) {
        var pf = puffs[pj], age = (now - pf.born) / pf.life;
        if (age >= 1) continue;
        keepP.push(pf);
        pf.vx *= Math.pow(0.4, dt); pf.vy = pf.vy * Math.pow(0.5, dt) - 10 * dt;
        pf.x += pf.vx * dt; pf.y += pf.vy * dt;
        var pr = pf.r0 + (pf.r1 - pf.r0) * easeOut(age), pdens = (1 - age) * 0.95;
        for (var py2 = Math.floor(pf.y - pr); py2 <= pf.y + pr; py2++) {
          if (py2 < 0 || py2 >= BH) continue;
          for (var px2 = Math.floor(pf.x - pr); px2 <= pf.x + pr; px2++) {
            if (px2 < 0 || px2 >= BW) continue;
            var pd = Math.hypot(px2 + 0.5 - pf.x, py2 + 0.5 - pf.y) / pr;
            if (pd >= 1) continue;
            var pn = vvNoise(px2 * 0.2 + pf.born * 0.01, py2 * 0.2 - t);
            var pa2 = (1 - pd * pd) * pdens * (0.15 + pn * 1.25), pb = vvBayer(px2, py2);
            if (pa2 > pb + 0.06) {
              var pi2 = py2 * BW + px2;
              buf[pi2] = pa2 > pb + 0.45 ? c.vd1 : pa2 > pb + 0.2 ? c.vd2 : c.vapor;
              gbuf[pi2] = pa2 > pb + 0.3 ? c.v0 : c.vd2;
            }
          }
        }
      }
      puffs = keepP;
    }

    // steel ring and brass collar
    if (introP >= 1 || revealX > xc) {
      for (var rx2 = xc; rx2 < xb + 7; rx2++) {
        if (rx2 >= revealX + 1) break;
        var steel = rx2 < xb, rr = steel ? 8 : 7, colI = rx2 - (steel ? xc : xb);
        for (var ry = cy - rr; ry < cy + rr; ry++) {
          var rdy = ry + 0.5 - cy;
          if (Math.abs(rdy) > rr - 1 && (colI === 0 || (steel ? colI === 2 : colI === 6))) continue;
          var base = steel ? (colI === 1 ? c.sL : colI === 0 ? c.sM : c.sD) : [c.bD, c.bL, c.bM, c.bD, c.bH, c.bM, c.bD][colI];
          if (rdy < -rr + 2.5) base = mixPk(base, c.white, steel ? 0.15 : 0.28);
          if (rdy > rr - 3) base = mixPk(base, c.void, 0.45);
          put(rx2, ry, base);
        }
      }
      if (0.5 + 0.5 * Math.sin(t * 1.7) > 0.8) { put(xb + 4, cy - 5, c.white); glow(xb + 4, cy - 5, c.bH); }
    }

    // the chain
    if (gemIn > 0 && chain.length === CHAIN_N) {
      for (var ck = 0; ck < CHAIN_N - 1; ck++) {
        var a1 = chain[ck], b1 = chain[ck + 1];
        line(a1.x + 0.6, a1.y + 0.8, b1.x + 0.6, b1.y + 0.8, c.bD);
        line(a1.x, a1.y, b1.x, b1.y, c.bM);
      }
      for (var cl = 1; cl < CHAIN_N - 1; cl++) {
        var cnx = Math.round(chain[cl].x), cny = Math.round(chain[cl].y);
        if (cl % 2) { put(cnx - 1, cny, c.bL); put(cnx, cny - 1, c.bH); put(cnx + 1, cny, c.bM); put(cnx, cny + 1, c.bD); put(cnx, cny, c.void); }
        else { put(cnx, cny, c.bH); put(cnx + 1, cny, c.bL); }
        glow(cnx, cny, c.bD);
      }
    }

    // the stopper
    if (gemIn > 0) {
      var sc = still ? 1 : easeBack(gemIn);
      var rad = 14 * Math.max(0.2, sc);
      var gcol = [0, c.g1, c.g2, c.g3, c.g4, c.g5, c.g6, c.g7, c.g5];
      for (var gy = Math.floor(gcy - rad); gy <= gcy + rad; gy++) {
        for (var gx = Math.floor(gcx - rad); gx <= gcx + rad; gx++) {
          var gdx2 = (gx + 0.5 - gcx) / sc, gdy2 = (gy + 0.5 - gcy) / sc;
          var gu = gdx2 * ca + gdy2 * sa, gw = -gdx2 * sa + gdy2 * ca;
          var gf = vvGem(gu, gw);
          if (!gf) continue;
          var gc = gcol[gf];
          if (gf === 3 && Math.abs(gu + gw * 0.6 - ((t * 5) % 30) + 12) < 1.2) gc = c.g2;
          put(gx, gy, gc);
          if (gf !== 1 && gf !== 6) glow(gx, gy, gf === 7 ? c.g2 : c.g4);
        }
      }
      var gg = (now - glintAt) / 520, idle = (t % 3.6) / 0.5;
      var kg = gg < 1 ? gg : idle < 1 ? idle : -1;
      if (kg >= 0 && !still) {
        var arm = Math.round(Math.sin(kg * Math.PI) * 3);
        var sx0 = Math.round(gcx + 4 * ca - -5 * sa), sy0 = Math.round(gcy + 4 * sa + -5 * ca);
        for (var ar = -arm; ar <= arm; ar++) {
          put(sx0 + ar, sy0, c.white); put(sx0, sy0 + ar, c.white);
          glow(sx0 + ar, sy0, c.g7); glow(sx0, sy0 + ar, c.g7);
        }
      }
    }

    // silk over the stone while she rides it
    if (sp.mode === 3 && sp.ride >= 1) {
      [[-10, -4, 9, 6], [-9, 5, 8, -6], [-3, -9, 2, 9], [-11, 1, 11, -1]].forEach(function (st2) {
        var p1x = gcx + st2[0] * ca - st2[1] * sa, p1y = gcy + st2[0] * sa + st2[1] * ca;
        var p2x = gcx + st2[2] * ca - st2[3] * sa, p2y = gcy + st2[2] * sa + st2[3] * ca;
        var nn = Math.max(1, Math.round(Math.hypot(p2x - p1x, p2y - p1y)));
        for (var qq = 0; qq <= nn; qq++) {
          if (qq % 3 === 1) continue;
          blend(Math.round(p1x + ((p2x - p1x) * qq) / nn), Math.round(p1y + ((p2y - p1y) * qq) / nn), c.silk, 0.55);
        }
      });
    }

    // the widow and her thread
    if (sp.mode === 0 || sp.mode === 2) {
      var ttx = Math.round(sp.x), tty = Math.round(sp.y + (sp.mode === 0 ? -8 * SPIDER_Z : 0));
      for (var ty = 0; ty < tty; ty++) put(ttx, ty, (ty + Math.floor(t * 20)) % 9 < 6 ? c.silkDim : c.silk);
    }
    if (sp.y > -20) {
      var near = ptr && Math.hypot(ptr.x - sp.x, ptr.y - sp.y) < 40;
      drawSpider(sp.x, sp.y, sp.head, still ? 0 : sp.gait, near ? c.v1 : c.mark);
    }

    // sparks
    if (!still && (ph === "hold" || ph === "full") && now > nextSpark) {
      nextSpark = now + 260 + Math.random() * 380;
      burst(x0 + Math.random() * (v.end - x0), cy + (Math.random() - 0.5) * 50, 1, 14, now, 10);
    }
    if (sparks.length) {
      var keepS = [];
      for (var sk = 0; sk < sparks.length; sk++) {
        var spk = sparks[sk], sage = (now - spk.born) / spk.life;
        if (sage >= 1) continue;
        keepS.push(spk);
        spk.vx *= Math.pow(0.18, dt); spk.vy = spk.vy * Math.pow(0.18, dt) + 6 * dt;
        spk.x += spk.vx * dt; spk.y += spk.vy * dt;
        if (sage > 0.66 && Math.floor(now / 60 + spk.born) % 2) continue;
        var scol = spk.tone === 0 ? c.v2 : spk.tone === 1 ? c.bH : spk.tone === 2 ? c.white : c.v1;
        var skx = Math.round(spk.x), sky = Math.round(spk.y);
        put(skx, sky, scol); glow(skx, sky, scol);
        if (spk.kind === 1 && sage < 0.6) { put(skx - 1, sky, scol); put(skx + 1, sky, scol); put(skx, sky - 1, scol); put(skx, sky + 1, scol); }
      }
      sparks = keepS;
    }

    // the count
    if (OPT.counter && (ph === "load" || ph === "full" || ph === "hold") && (ph !== "load" || since > intro * 0.75)) {
      var blink = ph === "full" && since < 520 && Math.floor(since / 90) % 2 === 0;
      if (!blink) {
        var text = String(Math.round(shown * 100)), kz = 2;
        var cx2 = Math.round(BW / 2 - vvCountWidth(text, kz) / 2), cy2 = cy + VV_R + 12;
        for (var chI = 0; chI < text.length; chI++) {
          var glyph = VV_DIGITS[text[chI]];
          for (var gr = 0; gr < 7; gr++) for (var gq = 0; gq < 5; gq++) {
            if (glyph[gr][gq] !== "#") continue;
            for (var za = 0; za < kz; za++) for (var zb = 0; zb < kz; zb++) {
              var dpx = cx2 + gq * kz + za, dpy = cy2 + gr * kz + zb;
              var nb = buf[(dpy + 1) * BW + dpx + 1];
              if (nb !== c.digit && nb !== c.digitLo) put(dpx + 1, dpy + 1, c.shadow);
              put(dpx, dpy, gr < 4 ? c.digit : c.digitLo);
            }
          }
          cx2 += 6 * kz;
        }
        cx2 += 2 - kz;
        for (var pr2 = 0; pr2 < 4; pr2++) for (var pq = 0; pq < 4; pq++) if (VV_PERCENT[pr2][pq] === "#") put(cx2 + pq, cy2 + pr2, c.digitLo);
      }
    }

    // the exit: venom fog floods out, then thins away onto the page
    if (lifting && !still) {
      var fmx = xb + 7;
      var maxD = Math.hypot(Math.max(fmx, BW - fmx), Math.max(cy, BH - cy) * 1.25);
      var ffront = ease(clamp01((since - FLOOD_AT) / FLOOD_MS)) * maxD * 1.25;
      var fk = ease(clamp01((since - CLEAR_AT) / (LIFT_MS - CLEAR_AT - 80)));
      for (var fy = 0; fy < BH; fy++) {
        var fdy = (fy - cy) * 1.25;
        for (var fx = 0; fx < BW; fx++) {
          var fi2 = fy * BW + fx, fb = vvBayer(fx, fy);
          var fn = vvNoise(fx * 0.05 + t * 0.35, fy * 0.05 - t * 0.2);
          if (fk > 0 && vvVeil(fn, fb, fk)) { buf[fi2] = 0; gbuf[fi2] = 0; continue; }
          var fd = Math.hypot(fx - fmx, fdy) + (vvNoise(fx * 0.022 + 40, fy * 0.03 - t * 0.5) - 0.5) * 70;
          var cov = (ffront - fd) / 30 + (fn - 0.5) * 0.7;
          if (cov > fb) {
            var sw = vvFbm(fx * 0.028 - t * 0.25, fy * 0.05 + Math.sin(fx * 0.018 + t * 0.6) * 0.8 + t * 0.12);
            var strand = Math.max(0, 1 - Math.abs(sw - 0.5) * 5);
            var fq = strand * 0.85 + (fn - 0.5) * 0.3 + (fb - 0.5) * 0.3;
            var edge = cov < fb + 0.14 && ffront < maxD * 1.1;
            buf[fi2] = edge ? c.vd1 : fq > 0.7 ? c.fog2 : fq > 0.3 ? c.fog1 : c.fog0;
            gbuf[fi2] = edge ? c.v0 : fq > 0.62 ? c.fog1 : 0;
          }
        }
      }
    }
    if (lifting && still) gate.style.opacity = String(1 - clamp01(since / 600));

    cv.getContext("2d").putImageData(img, 0, 0);
    gl.getContext("2d").putImageData(gimg, 0, 0);
    raf = requestAnimationFrame(tick);

    // ---- sprites
    function drawSpider(sx, sy, th, gait, eye) {
      var z = SPIDER_Z, co = Math.cos(th), si2 = Math.sin(th);
      var W = function (lx, ly) { return [sx + (lx * co - ly * si2) * z, sy + (lx * si2 + ly * co) * z]; };
      var spread = [0.5, 1.12, 1.9, 2.5], femur = [6, 5.2, 5.2, 6.4], tibia = [7.5, 5.5, 5.5, 7.5];
      for (var side = -1; side <= 1; side += 2) {
        for (var li = 0; li < 4; li++) {
          var phs = gait * 2 + ((li + (side > 0 ? 0 : 1)) % 2) * Math.PI;
          var step = Math.sin(phs) * 1.5, lift = Math.max(0, Math.cos(phs));
          var la = spread[li], lrx = 2.4 - li * 0.75, lry = side * 1.3, ka = la - 0.42;
          var kx = lrx + Math.cos(ka) * femur[li] + step * 0.5;
          var ky = lry + side * Math.sin(ka) * femur[li] * (1 + lift * 0.12);
          var fa = la + 0.5;
          var lfx = kx + Math.cos(fa) * tibia[li] + step;
          var lfy = ky + side * Math.sin(fa) * tibia[li] * (1 - lift * 0.1);
          var r0 = W(lrx, lry), k1 = W(kx, ky), f1 = W(lfx, lfy);
          line(r0[0], r0[1], k1[0], k1[1], c.leg);
          line(k1[0], k1[1], f1[0], f1[1], c.leg);
          put(Math.round(k1[0]), Math.round(k1[1]), c.knee);
          put(Math.round(k1[0]), Math.round(k1[1]) - 1, c.knee);
        }
      }
      var acx = -4.9, aw = W(acx, 0), reach = 9.5 * z;
      for (var by = Math.floor(sy - reach); by <= sy + reach; by++) {
        for (var bx3 = Math.floor(sx - reach); bx3 <= sx + reach; bx3++) {
          var ddx = (bx3 + 0.5 - sx) / z, ddy = (by + 0.5 - sy) / z;
          var lx = ddx * co + ddy * si2, ly = -ddx * si2 + ddy * co;
          var ea = Math.pow((lx - acx) / 5.6, 2) + Math.pow(ly / 4.9, 2);
          var et = Math.pow((lx - 1.9) / 3.1, 2) + Math.pow(ly / 2.3, 2);
          if (ea <= 1) {
            var bcol = c.body;
            var lit = ((bx3 + 0.5 - aw[0]) * -0.6 + (by + 0.5 - aw[1]) * -0.8) / (5 * z);
            if (ea > 0.62) bcol = lit > 0.25 ? c.rim : lit < -0.45 ? c.edge : bcol;
            // the SCOTY anchor on her back, always upright on screen
            var gxl = Math.floor(bx3 + 0.5 - aw[0] + LOGO_W / 2);
            var gyl = Math.floor(by + 0.5 - aw[1] + LOGO_H / 2);
            if (gxl >= 0 && gxl < LOGO_W && gyl >= 0 && gyl < LOGO_H) {
              var lch = LOGO[gyl][gxl];
              if (lch === "#") { bcol = gyl < LOGO_H / 2 ? c.logo : c.logoLo; glow(bx3, by, c.v1); }
              else if (lch === "+") { bcol = c.slime; glow(bx3, by, c.slime); }
            }
            put(bx3, by, bcol);
          } else if (et <= 1) {
            var lit2 = (bx3 + 0.5 - sx) * -0.6 + (by + 0.5 - sy) * -0.8;
            put(bx3, by, et > 0.55 ? (lit2 > 1 ? c.rim : c.edge) : c.body);
          }
        }
      }
      for (var es = -1; es <= 1; es += 2) {
        var e1 = W(4.2, es * 0.85);
        put(Math.round(e1[0]), Math.round(e1[1]), eye);
        glow(Math.round(e1[0]), Math.round(e1[1]), eye);
      }
    }
  }
  raf = requestAnimationFrame(tick);

  // ---- input ----------------------------------------------------------------------
  function toArt(e) {
    if (!lay) return null;
    var r = root.getBoundingClientRect();
    return { x: (e.clientX - r.left) / lay.s, y: (e.clientY - r.top) / lay.s };
  }
  function gemCentre() {
    var ca = Math.cos(gem.ang), sa = Math.sin(gem.ang);
    return { x: gem.x - (ca * GEM_A[0] - sa * GEM_A[1]), y: gem.y - (sa * GEM_A[0] + ca * GEM_A[1]) };
  }
  function live() { return phase === "load" || phase === "full" || phase === "hold"; }
  function uncork() { if (phase === "full" || phase === "hold") go("lift"); }

  gate.addEventListener("pointerdown", function (e) {
    var p = toArt(e), v = lay;
    if (!p || !v || !live()) return;
    var gc = gemCentre();
    if (Math.hypot(p.x - gc.x, p.y - gc.y) < 15 && (phase !== "load" || performance.now() - phaseAt > 1400)) {
      gem.mode = "held"; gem.gx = gem.x; gem.gy = gem.y; gem.offX = gem.x - p.x; gem.offY = gem.y - p.y;
      try { gate.setPointerCapture(e.pointerId); } catch (_) {}
      gate.style.cursor = "grabbing";
      return;
    }
    if (spider.mode === 1 && Math.hypot(p.x - spider.x, p.y - spider.y) < 16) { spider.hv = -95; spider.hop = -0.01; return; }
    if (phase === "load") {
      if (Math.abs(p.y - v.cy) < 18 && p.x > v.x0 && p.x < v.xn) slosh.va += p.x < v.x0 + (v.xn - v.x0) / 2 ? 2.4 : -2.4;
      else rush = true; // tap anywhere else to hurry the brew
      return;
    }
    uncork();
  });
  gate.addEventListener("pointermove", function (e) {
    var p = toArt(e);
    if (!p) return;
    var now = performance.now(), prev = pointer;
    var vx = prev ? ((p.x - prev.x) / Math.max(1, now - prev.t)) * 1000 : 0;
    pointer = { x: p.x, y: p.y, vx: prev ? prev.vx * 0.5 + vx * 0.5 : 0, t: now };
    if (gem.mode === "held") { gem.gx = p.x + gem.offX; gem.gy = p.y + gem.offY; return; }
    if (gem.mode === "free") {
      var gc = gemCentre();
      if (Math.hypot(p.x - gc.x, p.y - gc.y) < 13) { gem.vx += Math.max(-160, Math.min(160, pointer.vx * 0.35)); gem.vy -= 25; }
    }
    var gc2 = gemCentre();
    var over = live() && Math.hypot(p.x - gc2.x, p.y - gc2.y) < 15;
    gate.style.cursor = over ? "grab" : phase === "full" || phase === "hold" ? "pointer" : "";
  });
  function up() {
    if (gem.mode !== "held") return;
    var brewed = phase === "full" || phase === "hold";
    if (brewed && gem.pulled > CHAIN_LEN * 0.5) { gem.mode = "free"; go("lift"); }
    else gem.mode = brewed ? "free" : "ret";
    gate.style.cursor = "";
  }
  gate.addEventListener("pointerup", up);
  gate.addEventListener("pointercancel", up);
  gate.addEventListener("pointerleave", function () { pointer = null; });
  function onKey(e) {
    if (!root.isConnected) { removeEventListener("keydown", onKey); return; }
    if (e.key !== "Enter" && e.key !== " " && e.key !== "Escape") return;
    e.preventDefault();
    if (phase === "load") rush = true;
    else uncork();
  }
  addEventListener("keydown", onKey);
})();
