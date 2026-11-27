(function () {
  const { CFG, W, Store, logoSVG, logoDataUri, imgSrc, readProvider, esc, short } = window.SCOTY;
  const $ = (id) => document.getElementById(id);
  const state = { chain: CFG.chains[0], image: null, seed: "" };

  const IDEAS = [
    "a cat coin that trades memes from the couch",
    "a frog who only buys the dip on Mondays",
    "a sleepy panda that stakes while it naps",
    "an astronaut dog planting flags on every chart",
    "a coffee token for devs shipping at 3am",
    "a pixel dragon guarding the liquidity pool",
    "a grandma who discovered crypto and won't stop posting",
    "a tiny robot that cleans up rug pulls",
    "a pizza slice orbiting the moon",
    "a duck that quacks every time the price pumps",
  ];

  // ── Local "AI" package generator (rule-based) ─────────────
  const STOP = new Set("a an the that who which with from for of on in to and or only every is are be at by it its my your our this coin token".split(" "));
  const SUFFIX = ["", " Club", " Protocol", " Inu", " Labs", " World", " DAO", " Finance"];
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

  function generate(idea) {
    const words = idea.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
    const r = Math.random();
    const core = words.slice(0, 2);
    let name = core.map(cap).join(" ") || "Scoty";
    name = (name + SUFFIX[Math.floor(r * SUFFIX.length)]).slice(0, 32);
    let symbol = core.length > 1 ? (core[0].slice(0, 3) + core[1].slice(0, 2)) : (core[0] || "SCOTY").slice(0, 5);
    symbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "") || "SCOTY";
    const lines = [
      `${name} is ${idea.replace(/^(a|an|the)\s+/i, "the ")}. Born on Elysium, owned by the community.`,
      `No team allocation, no presale — just ${name} and the people who believe in it.`,
    ];
    return { name, symbol, desc: lines.join(" ") };
  }

  // ── Step 01 ───────────────────────────────────────────────
  const idea = $("idea");
  idea.addEventListener("input", () => ($("generate").disabled = idea.value.trim().length < 3));
  idea.addEventListener("keydown", (e) => { if (e.key === "Enter" && !$("generate").disabled) $("generate").click(); });
  $("roulette").onclick = () => {
    idea.value = IDEAS[Math.floor(Math.random() * IDEAS.length)];
    $("generate").disabled = false;
    $("generate").click();
  };
  $("generate").onclick = () => {
    const btn = $("generate");
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Generating…';
    setTimeout(() => {
      const p = generate(idea.value.trim());
      $("name").value = p.name;
      $("symbol").value = p.symbol;
      $("desc").value = p.desc;
      state.image = null;
      state.seed = p.symbol + p.name;
      state.mode = "gen";
      ["p2", "p3", "p4"].forEach((id) => $(id).classList.remove("locked"));
      renderLogo(); renderSummary();
      btn.disabled = false;
      btn.innerHTML = "✦ Regenerate";
      $("p2").scrollIntoView({ behavior: "smooth", block: "start" });
    }, 650);
  };

  // ── Step 02 ───────────────────────────────────────────────
  function renderLogo() {
    const link = logoLink();
    const manual = state.mode === "manual";
    $("reroll").hidden = manual;
    $("logoOpt").hidden = manual;
    $("logoUrl").placeholder = manual ? "https://… or ipfs://…  (or use Upload image)" : "https://… or ipfs://…  (leave empty to use the generated logo)";
    $("logoReq").hidden = !manual || !!link;
    $("logo").classList.toggle("logo-empty", manual && !link);
    if (manual && !link) {
      $("logo").innerHTML = `<label class="logo-drop" for="upload"><span>⬆</span>Upload your logo</label>`;
      return;
    }
    $("logo").innerHTML = link ? window.SCOTY.tokenImg(link, { symbol: $("symbol").value, name: $("name").value }) : `<img src="${esc(logoDataUri(state.seed, $("symbol").value))}" alt="logo">`;
  }

  // ── Mode: Generate or Manual ───────────────────────────────
  state.mode = "gen";
  function setMode(m) {
    $("modes").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.m === m));
    $("genBox").hidden = m !== "gen";
    $("manualBox").hidden = m !== "manual";
  }
  $("modes").querySelectorAll("button").forEach((b) => (b.onclick = () => setMode(b.dataset.m)));
  $("startManual").onclick = () => {
    state.mode = "manual";
    state.seed = Math.random().toString(36);
    ["name", "symbol", "desc", "logoUrl"].forEach((id) => ($(id).value = ""));
    $("logoUrl").dispatchEvent(new Event("input"));
    ["p2", "p3", "p4"].forEach((id) => $(id).classList.remove("locked"));
    renderLogo(); renderSummary();
    $("p2").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => $("name").focus({ preventScroll: true }), 400);
  };
  $("symbol").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); renderLogo(); renderSummary(); });
  ["name", "desc"].forEach((id) => $(id).addEventListener("input", renderSummary));
  $("reroll").onclick = () => { $("logoUrl").value = ""; state.seed = Math.random().toString(36); renderLogo(); };
  // a hosted logo link (https:// or ipfs://)
  function logoLink() {
    const v = $("logoUrl").value.trim();
    return /^(https:\/\/|ipfs:\/\/)\S+$/i.test(v) && v.length <= 512 ? v : "";
  }
  // Upload: crop to a square, resize to 512 px WebP, store via /api/upload, use the returned link
  function toSquareImage(file, size = 512) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const s = Math.min(img.naturalWidth, img.naturalHeight);
        c.getContext("2d").drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b && b.type === "image/webp" ? resolve(b) : c.toBlob((p) => (p ? resolve(p) : reject(new Error("Couldn't read that image."))), "image/png")), "image/webp", 0.88);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't an image we can read.")); };
      img.src = url;
    });
  }
  $("upload").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const note = $("logoNote"), btn = $("uploadBtn");
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) { note.className = "note bad"; note.textContent = "Use a PNG, JPEG, WebP or GIF image."; return; }
    if (file.size > 15 * 1024 * 1024) { note.className = "note bad"; note.textContent = "That image is over 15 MB."; return; }
    btn.classList.add("busy");
    note.className = "note"; note.textContent = "Uploading your image…";
    try {
      const blob = file.type === "image/gif" && file.size <= 1024 * 1024 ? file : await toSquareImage(file);
      $("logo").innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="logo">`;
      let r, data = {};
      try { r = await fetch(CFG.uploadUrl, { method: "POST", headers: { "content-type": blob.type }, body: blob }); }
      catch (_) { throw new Error("Couldn't reach the upload service. Check your connection, or paste an image link instead."); }
      try { data = await r.json(); } catch (_) {}
      if (!r.ok || !data.url) {
        console.warn("upload failed", r.status, data);
        // say exactly what is wrong, so the site owner can fix it
        const why =
          r.status === 404 ? "the upload service isn't deployed on this site (api/upload not found)" :
          data.code === "NO_BLOB_TOKEN" ? "image storage isn't connected yet (Vercel Blob)" :
          data.code === "BLOB_ERROR" ? "image storage rejected the file" + (data.detail ? ": " + data.detail : "") :
          data.error || "error " + r.status;
        throw new Error(r.status === 413 || r.status === 415 || r.status === 400 ? data.error : `Upload isn't available: ${why}. Paste an image link instead.`);
      }
      $("logoUrl").value = data.url;
      $("logoUrl").dispatchEvent(new Event("input"));
      note.className = "note"; note.textContent = "✓ Image uploaded. It will be your token logo.";
    } catch (err) {
      note.className = "note bad"; note.textContent = err.message;
      renderLogo();
    } finally {
      btn.classList.remove("busy");
    }
  });

  $("logoUrl").addEventListener("input", () => {
    const v = $("logoUrl").value.trim(), note = $("logoNote");
    if (!v) { note.className = "note"; note.textContent = state.mode === "manual" ? "Upload your logo or paste an image link (https:// or ipfs://)." : "Upload your own image, paste an image link, or keep the generated logo."; }
    else if (!/^(https:\/\/|ipfs:\/\/)/i.test(v)) { note.className = "note bad"; note.textContent = "Use a link that starts with https:// or ipfs://"; }
    else if (v.length > 512) { note.className = "note bad"; note.textContent = "That link is too long."; }
    else { note.className = "note"; note.textContent = "Using your image link as the token logo."; }
    renderLogo();
  });

  // ── Step 03 ───────────────────────────────────────────────
  function renderChains() {
    $("chains").innerHTML = CFG.chains.map((c) =>
      `<button type="button" class="chain ${c.key === state.chain.key ? "on" : ""}" data-k="${c.key}">
        <b>${esc(c.name)}</b><small>chain ${c.chainId} · ${esc(CFG.protocol)}</small></button>`).join("");
  }

  // Montra launch configs: each is a pair + fee + anti-snipe window. SCOTY launches HYPE pairs.
  const ZERO = "0x0000000000000000000000000000000000000000";
  const WINDOW_LABEL = (s) => (!s ? "None" : s < 60 ? s + "s" : s / 60 + "m");
  state.fee = 2; state.window = 0; state.feeTo = "creator"; state.configs = null;

  async function loadConfigs(provider) {
    const f = new ethers.Contract(state.chain.factory, CFG.factoryAbi, provider);
    const n = Number(await f.configCount());
    const ids = Array.from({ length: n }, (_, i) => i);
    const out = [];
    for (let i = 0; i < ids.length; i += 50) {
      const part = await Promise.all(ids.slice(i, i + 50).map((id) => f.getConfig(id).then((c) => ({ id, c })).catch(() => null)));
      for (const x of part) {
        if (!x || !x.c.exists || !x.c.enabled || x.c.quote.toLowerCase() !== ZERO) continue;
        out.push({ id: x.id, fee: Number(x.c.totalFeePips) / 10000, window: Number(x.c.earlyBuyFeeStartPips) > 0 ? Number(x.c.earlyBuyFeeWindow) : 0 });
      }
    }
    return out;
  }
  function renderChoices() {
    const cs = state.configs;
    const fees = cs ? [...new Set(cs.map((c) => c.fee))].sort((a, b) => a - b) : [1, 2, 3, 5, 10];
    if (!fees.includes(state.fee)) state.fee = fees.includes(2) ? 2 : fees[0];
    const windows = cs ? [...new Set(cs.filter((c) => c.fee === state.fee).map((c) => c.window))].sort((a, b) => a - b) : [0, 5, 10, 30, 60, 300, 900, 1800];
    if (!windows.includes(state.window)) state.window = windows[0] || 0;
    $("feeChips").innerHTML = fees.map((f) => `<button type="button" data-v="${f}" class="${f === state.fee ? "on" : ""}">${f}%</button>`).join("");
    $("snipeChips").innerHTML = windows.map((w) => `<button type="button" data-v="${w}" class="${w === state.window ? "on" : ""}">${WINDOW_LABEL(w)}</button>`).join("");
    $("feeVal").textContent = state.fee + "%";
    $("snipeVal").textContent = WINDOW_LABEL(state.window);
    $("feeChips").querySelectorAll("button").forEach((b) => (b.onclick = () => { state.fee = Number(b.dataset.v); renderChoices(); renderSummary(); }));
    $("snipeChips").querySelectorAll("button").forEach((b) => (b.onclick = () => { state.window = Number(b.dataset.v); renderChoices(); renderSummary(); }));
  }
  $("feeToChips").querySelectorAll("button").forEach((b) => (b.onclick = () => {
    state.feeTo = b.dataset.v;
    $("feeToChips").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    $("feeToNote").textContent = state.feeTo === "holders"
      ? "Your side of every trading fee is streamed to the coin's holders."
      : "Your side of every trading fee is paid to your wallet.";
    renderSummary();
  }));
  const pickConfig = () => state.configs && state.configs.find((c) => c.fee === state.fee && c.window === state.window);

  // ── Initial buy ────────────────────────────────────────────
  const fmtAmt = (wei) => Number(ethers.formatEther(wei)).toLocaleString("en-US", { maximumFractionDigits: 6 });
  function devBuyWei() {
    const v = $("devBuy").value.trim();
    if (!v || !window.ethers) return 0n;
    try { const w = ethers.parseEther(v); return w > 0n ? w : 0n; } catch (_) { return 0n; }
  }
  $("devBuy").addEventListener("input", () => {
    const v = $("devBuy").value;
    $("buyChips").querySelectorAll("button").forEach((b) => b.classList.toggle("on", Number(b.dataset.v) === Number(v || 0)));
    renderSummary();
  });
  $("buyChips").querySelectorAll("button").forEach((b) => (b.onclick = () => {
    $("devBuy").value = b.dataset.v === "0" ? "" : b.dataset.v;
    $("devBuy").dispatchEvent(new Event("input"));
  }));

  // ── Step 04 ───────────────────────────────────────────────
  function renderSummary() {
    const sym = state.chain.symbol;
    const buy = devBuyWei();
    $("summary").innerHTML = `
      <div><span>Token      </span> ${esc($("name").value || "—")} ($${esc($("symbol").value || "—")})</div>
      <div><span>Network    </span> ${esc(state.chain.name)} · ${esc(CFG.protocol)}</div>
      <div><span>Creator    </span> ${W.address ? short(W.address) : "connect wallet"}</div>
      <div><span>Supply     </span> ${CFG.supply.toLocaleString("en-US")}</div>
      <div><span>Trading fee</span> ${state.fee}% · anti-snipe ${WINDOW_LABEL(state.window)} · to ${state.feeTo === "holders" ? "holders" : "you"}</div>
      <div><span>Initial buy</span> ${buy > 0n ? fmtAmt(buy) + " " + sym : "none"}</div>
      <div><span>Launch fee </span> ${state.feeWei == null ? "—" : fmtAmt(state.feeWei) + " " + sym}</div>
      <div><span>Total      </span> ${state.feeWei == null ? "—" : fmtAmt(state.feeWei + buy) + " " + sym} + gas</div>`;
    $("deploy").textContent = W.address ? "🚀 Launch token" : "Connect wallet to launch";
  }
  function renderDemo() { $("demoNote").innerHTML = ""; }

  const setStatus = (msg, cls = "") => { const s = $("status"); s.className = "status " + cls; s.innerHTML = msg; };

  // Montra's live configs and launch fee, read from the public RPC (or the wallet)
  async function loadMontra() {
    if (!window.ethers) return;
    const providers = [];
    if (W.provider && W.chainId === state.chain.chainId) providers.push(new ethers.BrowserProvider(W.provider));
    providers.push(readProvider(state.chain));
    for (const p of providers) {
      try {
        const f = new ethers.Contract(state.chain.factory, CFG.factoryAbi, p);
        const [fee, configs] = await Promise.all([f.launchFee(), loadConfigs(p)]);
        state.feeWei = fee;
        if (configs.length) state.configs = configs;
        renderChoices(); renderSummary();
        return;
      } catch (e) { console.warn("Montra read failed", e); }
    }
  }
  W.onChange(() => { renderSummary(); if (state.feeWei == null || !state.configs) loadMontra(); });

  const byteLen = (s) => new TextEncoder().encode(s).length;
  function metadataProblem(m) {
    const L = CFG.limits;
    if (byteLen(m.name) > L.name) return `Name is too long (max ${L.name} characters).`;
    if (byteLen(m.symbol) > L.symbol) return `Ticker is too long (max ${L.symbol} characters).`;
    if (byteLen(m.description) > L.description) return `Description is too long (max ${L.description} characters).`;
    for (const [k, v] of Object.entries(m.socials)) if (byteLen(v) > L.social) return `${k} link is too long.`;
    for (const [k, v] of Object.entries(m.socials)) if (v && !/^https:\/\//i.test(v)) return `${k === "twitter" ? "X" : k} link must start with https://`;
    return "";
  }
  function launchError(e) {
    if (e.code === "ACTION_REJECTED" || e.code === 4001) return "You rejected the transaction.";
    if (/insufficient funds/i.test(e.message || "")) return `Not enough ${state.chain.symbol} for the launch plus gas.`;
    const name = e.revert && e.revert.name;
    if (name === "FirstBuySlippage") return "The price moved before your initial buy. Please try again.";
    if (name === "SupplyOutOfRange" || name === "SupplyNotWholeCoins") return "Montra rejected the token supply.";
    if (name) return `Montra reverted with ${name}.`;
    return e.shortMessage || e.reason || e.message || String(e);
  }

  // Upload helpers: the generated logo as a PNG, and the token metadata JSON
  function svgToPng(svgUri, size = 512) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas"); c.width = c.height = size;
        c.getContext("2d").drawImage(img, 0, 0, size, size);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("render failed"))), "image/png");
      };
      img.onerror = () => reject(new Error("render failed"));
      img.src = svgUri;
    });
  }
  async function uploadBody(body, type) {
    const r = await fetch(CFG.uploadUrl, { method: "POST", headers: { "content-type": type }, body });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.url) throw new Error(d.error || "upload failed");
    return d.url;
  }
  // Tell SCOTY's index about the launch (it verifies the transaction on-chain)
  async function registerLaunch(tx) {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(CFG.launchesUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tx }) });
        if (r.ok) return true;
        if (r.status === 400) return false;
      } catch (_) {}
      await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
    }
    return false;
  }

  $("deploy").onclick = async () => {
    const name = $("name").value.trim(), symbol = $("symbol").value.trim(), desc = $("desc").value.trim();
    if (!name || !symbol) return setStatus("Name and ticker are required.", "err");
    if (!W.address && !(await W.connect())) return;
    const btn = $("deploy");
    const chain = state.chain;
    if ($("logoUrl").value.trim() && !logoLink()) return setStatus("Logo link must start with https:// or ipfs://", "err");
    if (state.mode === "manual" && !logoLink()) { $("logoReq").hidden = false; return setStatus("Upload your logo (or paste an image link) before launching.", "err"); }
    const socials = { telegram: "", twitter: $("x").value.trim(), discord: "", website: $("web").value.trim(), extra: "" };
    const problem = metadataProblem({ name, symbol, description: desc, socials });
    if (problem) return setStatus(problem, "err");
    btn.disabled = true;

    try {
      if (W.chainId !== chain.chainId) { setStatus("Switching to " + esc(chain.name) + "…"); await W.switchChain(chain); }
      const provider = new ethers.BrowserProvider(W.provider);
      const signer = await provider.getSigner();
      const factory = new ethers.Contract(chain.factory, [...CFG.factoryAbi, ...CFG.montraErrors], signer);

      setStatus("Preparing launch…");
      const [enabled, fee, balance] = await Promise.all([factory.launchEnabled(), factory.launchFee(), provider.getBalance(W.address)]);
      if (!enabled) throw new Error("Montra has launches switched off right now.");
      if (!state.configs) { state.configs = await loadConfigs(provider); renderChoices(); }
      const cfg = pickConfig();
      if (!cfg) throw new Error(`Montra has no ${state.fee}% config with a ${WINDOW_LABEL(state.window)} anti-snipe window. Pick another.`);
      const buy = devBuyWei();
      if (balance < fee + buy) throw new Error(`Not enough ${chain.symbol}: you need ${fmtAmt(fee + buy)} ${chain.symbol} plus gas.`);

      // logo + metadata, hosted so Montra and explorers can show them
      setStatus("Uploading logo and metadata…");
      let logo = logoLink();
      if (!logo) {
        const svg = logoDataUri(state.seed, symbol);
        logo = await svgToPng(svg).then((png) => uploadBody(png, "image/png")).catch(() => svg);
      }
      const meta = { name, symbol, description: desc, image: /^https:|^ipfs:/.test(logo) ? logo : undefined, twitter: socials.twitter || undefined, website: socials.website || undefined, createdOn: "https://scoty.fun" };
      const metadataURI = await uploadBody(JSON.stringify(meta), "application/json").catch(() => "");

      const p = {
        name, symbol, metadataURI,
        profile: { logo, description: desc, socials },
        configId: BigInt(cfg.id),
        supply: BigInt(CFG.supply) * 10n ** 18n,
        salt: ethers.hexlify(ethers.concat([CFG.launchTag, ethers.randomBytes(32 - ethers.getBytes(CFG.launchTag).length)])), // SCOTY marker + random
        feeRecipients: state.feeTo === "holders" ? [CFG.holdersRecipient] : [],
        feeShares: state.feeTo === "holders" ? [10000] : [],
        firstBuyAmount: buy, firstBuyMinOut: 0n,
        permit: { deadline: 0n, v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash },
      };
      const value = fee + buy;

      // initial buy: ask the chain for the exact output (it reverts FirstBuySlippage(out, min)
      // when the minimum is impossible), then allow 1% like Montra's own site
      let expectedOut = 0n;
      if (buy > 0n) {
        try {
          await factory.launch.staticCall({ ...p, firstBuyMinOut: 2n ** 255n }, { value });
        } catch (e) {
          if (e.revert && e.revert.name === "FirstBuySlippage") expectedOut = e.revert.args[0];
          else throw e;
        }
        if (expectedOut === 0n) throw new Error("Couldn't price your initial buy. Please try again.");
        p.firstBuyMinOut = (expectedOut * 99n) / 100n;
      }

      await factory.launch.staticCall(p, { value }); // catches any other revert before signing
      setStatus("Confirm the launch in your wallet…");
      const sent = await factory.launch(p, { value });
      setStatus(`Launching… <a href="${chain.txUrl(sent.hash)}" target="_blank" rel="noopener">view tx ↗</a>`);
      const rc = await sent.wait();
      if (rc.status !== 1) throw new Error("Transaction reverted.");

      let address = null, poolId = null;
      for (const log of rc.logs) {
        if (log.address.toLowerCase() !== chain.factory.toLowerCase()) continue;
        try { const ev = factory.interface.parseLog(log); if (ev && ev.name === "TokenLaunched") { address = ethers.getAddress(ev.args.token); poolId = ev.args.poolId; } } catch (_) {}
      }
      if (!address) throw new Error("Launched, but the token address wasn't found in the receipt.");

      setStatus("Adding your coin to Explore…");
      await registerLaunch(sent.hash);
      Store.add({ name, symbol, description: desc, image: logo, twitter: socials.twitter, website: socials.website,
        address, poolId, tx: sent.hash, chain: chain.key, creator: W.address, createdAt: Date.now(), mcap: 0, mine: true });
      const bought = expectedOut > 0n ? ` You bought ${Number(ethers.formatUnits(expectedOut, 18)).toLocaleString("en-US", { maximumFractionDigits: 0 })} $${esc(symbol)}.` : "";
      setStatus(`✅ $${esc(symbol)} is live on ${esc(CFG.protocol)}!${bought} Opening your token page…`, "ok");
      setTimeout(() => (location.href = "token.html?address=" + address), bought ? 3000 : 1500);
    } catch (e) {
      console.error(e);
      setStatus("Launch failed: " + esc(launchError(e)), "err");
    } finally {
      btn.disabled = false;
    }
  };

  renderChains(); renderDemo(); renderChoices(); renderSummary(); loadMontra();
})();
