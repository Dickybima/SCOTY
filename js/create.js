(function () {
  const { CFG, W, Store, logoSVG, logoDataUri, imgSrc, esc, short } = window.SCOTY;
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
      `${name} is ${idea.replace(/^(a|an|the)\s+/i, "the ")}. Born on Robinhood Chain, owned by the community.`,
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
    $("logo").innerHTML = `<img src="${esc(link ? imgSrc(link) : logoDataUri(state.seed, $("symbol").value))}" alt="logo">`;
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
  // a hosted logo link (https:// or ipfs://), validated against Pons' 512-byte cap
  function logoLink() {
    const v = $("logoUrl").value.trim();
    return /^(https:\/\/|ipfs:\/\/)\S+$/i.test(v) && byteLen(v) <= CFG.limits.logo ? v : "";
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
      const r = await fetch(CFG.uploadUrl, { method: "POST", headers: { "content-type": blob.type }, body: blob });
      let data = {};
      try { data = await r.json(); } catch (_) {}
      if (!r.ok || !data.url) throw new Error(data.error || (r.status === 404 ? "Image uploads aren't set up on this site yet. Paste an image link instead." : "Upload failed. Please try again."));
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
    else if (byteLen(v) > CFG.limits.logo) { note.className = "note bad"; note.textContent = `That link is ${byteLen(v)} bytes; Pons allows ${CFG.limits.logo}.`; }
    else { note.className = "note"; note.textContent = "Using your image link as the token logo."; }
    renderLogo();
  });

  // ── Step 03 ───────────────────────────────────────────────
  function renderChains() {
    $("chains").innerHTML = CFG.chains.map((c) =>
      `<button type="button" class="chain ${c.key === state.chain.key ? "on" : ""}" data-k="${c.key}">
        <b>${esc(c.name)}</b><small>chain ${c.chainId} · ${c.factory ? "live" : "demo"}</small></button>`).join("");
    $("chains").querySelectorAll(".chain").forEach((b) => (b.onclick = () => {
      state.chain = CFG.chains.find((c) => c.key === b.dataset.k);
      renderChains(); renderSummary(); renderDemo();
    }));
  }

  // ── Launch settings: initial buy + creator fee ─────────────
  const fmtEth = (wei) => Number(ethers.formatEther(wei)).toLocaleString("en-US", { maximumFractionDigits: 6 });
  const fmtTokens = (wei) => Number(ethers.formatUnits(wei, 18)).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const fmtPct = (bps) => (bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 }) + "%";
  function devBuyWei() {
    const v = $("devBuy").value.trim();
    if (!v || !window.ethers) return 0n;
    try { const w = ethers.parseEther(v); return w > 0n ? w : 0n; } catch (_) { return 0n; }
  }
  const taxBps = () => Number($("tax").value) || 0;
  function setMaxTax(max) {
    const r = $("tax");
    r.max = String(max);
    r.step = max >= 100 ? "5" : "1";
    if (Number(r.value) > max) r.value = String(max);
    $("taxMax").textContent = fmtPct(max);
    syncTax();
  }
  function syncTax() {
    const r = $("tax");
    $("taxVal").textContent = fmtPct(taxBps());
    r.style.setProperty("--fill", (Number(r.value) / Math.max(1, Number(r.max))) * 100 + "%");
    renderSummary();
  }
  $("tax").addEventListener("input", syncTax);
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
    $("summary").innerHTML = `
      <div><span>Token      </span> ${esc($("name").value || "—")} ($${esc($("symbol").value || "—")})</div>
      <div><span>Network    </span> ${esc(state.chain.name)}</div>
      <div><span>Creator    </span> ${W.address ? short(W.address) : "connect wallet"}</div>
      <div><span>Launch fee </span> ${state.feeWei == null ? "—" : fmtEth(state.feeWei) + " " + state.chain.symbol}</div>
      <div><span>Initial buy</span> ${devBuyWei() > 0n ? fmtEth(devBuyWei()) + " " + state.chain.symbol : "none"}</div>
      <div><span>Creator fee</span> ${fmtPct(taxBps())} per trade</div>
      <div><span>Total      </span> ${state.feeWei == null ? "—" : fmtEth(state.feeWei + devBuyWei()) + " " + state.chain.symbol} + gas</div>`;
    $("deploy").textContent = W.address ? "🚀 Launch token" : "Connect wallet to launch";
  }
  function renderDemo() {
    $("demoNote").innerHTML = state.chain.factory
      ? ""
      : `<span class="demo">DEMO MODE — no launch contract configured for ${esc(state.chain.name)}; launches are simulated locally</span>`;
  }
  W.onChange(() => { renderSummary(); if (state.feeWei == null) loadFee(); });

  const setStatus = (msg, cls = "") => { const s = $("status"); s.className = "status " + cls; s.innerHTML = msg; };

  // read-only factory (public RPC) for fee display
  async function loadFee() {
    const chain = state.chain;
    if (!chain.factory || !window.ethers) return;
    try {
      // public RPC first, then the connected wallet (if it is on this network)
      const providers = [new ethers.JsonRpcProvider(chain.rpc, chain.chainId, { staticNetwork: true })];
      if (W.provider && W.chainId === chain.chainId) providers.unshift(new ethers.BrowserProvider(W.provider));
      let fee = null, maxTax = null;
      for (const rp of providers) {
        try {
          const f = new ethers.Contract(chain.factory, CFG.factoryAbi, rp);
          [fee, maxTax] = await Promise.all([f.launchFee(), f.maxCreatorTaxBps().catch(() => null)]);
          break;
        } catch (_) {}
      }
      if (fee == null) return;
      state.feeWei = fee;
      if (maxTax != null) setMaxTax(Number(maxTax));
      renderSummary();
    } catch (_) {}
  }

  const byteLen = (s) => new TextEncoder().encode(s).length;
  // Pons rejects metadata over its byte caps (MetadataTooLong); check before signing
  function metadataProblem(m) {
    const L = CFG.limits;
    if (byteLen(m.name) > L.name) return `Name is too long (max ${L.name} bytes).`;
    if (byteLen(m.symbol) > L.symbol) return `Ticker is too long (max ${L.symbol} characters).`;
    if (byteLen(m.logo) > L.logo) return `Logo is too large for Pons (max ${L.logo} bytes). Use an https:// or ipfs:// image link.`;
    if (byteLen(m.description) > L.description) return `Description is too long (max ${L.description} bytes).`;
    for (const [k, v] of Object.entries(m.socials)) if (byteLen(v) > L.social) return `${k} link is too long (max ${L.social} bytes).`;
    return "";
  }
  // readable messages for Pons custom errors
  const PONS_MSG = {
    MetadataTooLong: "Name, ticker, logo link or description is longer than Pons allows.",
    InvalidTokenParams: "Pons rejected the token details. Check the name and ticker.",
    CreatorTaxTooHigh: "Creator fee is above the Pons maximum.",
    LaunchFeeNotPaid: "The launch fee changed. Please try again.",
    LaunchEconomicsMismatch: "Pons launch terms just changed. Please try again.",
    NotWhitelisted: "Launching is currently paused on Pons.",
    LaunchConfigDisabled: "This Pons launch configuration is closed.",
    ExemptionListTooLong: "Too many anti-snipe exemptions.",
    SlippageExceeded: "Price moved too much during your initial buy.",
  };
  function launchError(e) {
    if (e.code === "ACTION_REJECTED" || e.code === 4001) return "You rejected the transaction.";
    const name = e.revert && e.revert.name;
    if (name) return PONS_MSG[name] || `Pons reverted with ${name}.`;
    const data = e.data || (e.info && e.info.error && e.info.error.data);
    const sel = typeof data === "string" && data.length >= 10 ? ` (error ${data.slice(0, 10)})` : "";
    return (e.shortMessage || e.reason || e.message || String(e)) + sel;
  }

  const ZERO = "0x0000000000000000000000000000000000000000";
  const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const ZERO_TOPIC = "0x" + "0".repeat(64);

  $("deploy").onclick = async () => {
    const name = $("name").value.trim(), symbol = $("symbol").value.trim(), desc = $("desc").value.trim();
    if (!name || !symbol) return setStatus("Name and ticker are required.", "err");
    if (!W.address && !(await W.connect())) return;
    const btn = $("deploy");
    btn.disabled = true;
    const chain = state.chain;
    if ($("logoUrl").value.trim() && !logoLink()) { btn.disabled = false; return setStatus("Logo link must start with https:// or ipfs:// and be at most 512 bytes.", "err"); }
    if (state.mode === "manual" && !logoLink()) { btn.disabled = false; $("logoReq").hidden = false; return setStatus("Upload your logo (or paste an image link) before launching.", "err"); }
    const logo = logoLink() || logoDataUri(state.seed, symbol);
    const socials = { twitter: $("x").value.trim(), telegram: "", discord: "", website: $("web").value.trim(), farcaster: "" };
    const problem = metadataProblem({ name, symbol, logo, description: desc, socials });
    if (problem) { btn.disabled = false; return setStatus(problem, "err"); }

    try {
      let address, curve = null, tx = null, boughtNote = "";
      if (chain.factory && window.ethers) {
        if (W.chainId !== chain.chainId) { setStatus("Switching to " + esc(chain.name) + "…"); await W.switchChain(chain); }
        const provider = new ethers.BrowserProvider(W.provider);
        const signer = await provider.getSigner();
        const factory = new ethers.Contract(chain.factory, [...CFG.factoryAbi, ...CFG.ponsErrors], signer);

        setStatus("Preparing launch…");
        const devWei = devBuyWei();
        const bps = taxBps();
        const [fee, canLaunch, economics, maxTax, balance] = await Promise.all([
          factory.launchFee(),
          factory.canLaunch(W.address),
          factory.previewLaunchEconomics(chain.launchConfigId, ZERO),
          factory.maxCreatorTaxBps(),
          provider.getBalance(W.address),
        ]);
        if (!canLaunch) throw new Error("Launching is currently disabled for this wallet.");
        if (BigInt(bps) > maxTax) throw new Error(`Creator fee can be at most ${fmtPct(Number(maxTax))}.`);
        if (balance < fee + devWei) throw new Error(`Not enough ${chain.symbol}: you need ${fmtEth(fee + devWei)} ${chain.symbol} plus gas.`);

        const params = {
          name, symbol, logo, description: desc, socials,
          creatorFeeRecipient: W.address,
          creatorTaxBps: bps,
          buybackEnabled: false,
          expectedEconomics: economics,
          salt: ethers.concat([CFG.launchTag, ethers.randomBytes(32 - ethers.getBytes(CFG.launchTag).length)]), // SCOTY marker + random
        };
        // the creator's own wallet skips the opening anti-snipe tax for the initial buy
        const args = [params, chain.launchConfigId, ZERO, devWei > 0n ? [W.address] : []];
        // simulate first: catches reverts and returns the new token address
        [address, curve] = await factory.launchToken.staticCall(...args, { value: fee });

        setStatus("Confirm the transaction in your wallet…");
        const sent = await factory.launchToken(...args, { value: fee });
        tx = sent.hash;
        setStatus(`Waiting for confirmation… <a href="${chain.explorer}/tx/${tx}" target="_blank" rel="noopener">view tx ↗</a>`);
        const rc = await sent.wait();
        if (rc.status !== 1) throw new Error("Transaction reverted.");
        // the new token mints its supply to its curve: read both from the receipt
        const mint = rc.logs.find((l) => l.topics[0] === TRANSFER && l.topics[1] === ZERO_TOPIC && l.topics.length === 3);
        if (mint) { address = ethers.getAddress(mint.address); curve = ethers.getAddress("0x" + mint.topics[2].slice(26)); }

        if (devWei > 0n && curve) {
          try {
            const c = new ethers.Contract(curve, [...CFG.curveAbi, ...CFG.ponsErrors], signer);
            const est = await c.buy.staticCall(devWei, 0, W.address, { value: devWei });
            const minOut = (est * 95n) / 100n; // 5% slippage guard
            setStatus(`$${esc(symbol)} is live! Confirm your initial buy of ${fmtEth(devWei)} ${chain.symbol}…`);
            const b = await c.buy(devWei, minOut, W.address, { value: devWei });
            setStatus(`Buying your supply… <a href="${chain.explorer}/tx/${b.hash}" target="_blank" rel="noopener">view tx ↗</a>`);
            const brc = await b.wait();
            if (brc.status !== 1) throw new Error("buy reverted");
            boughtNote = ` You bought ${fmtTokens(est)} $${esc(symbol)}.`;
          } catch (be) {
            console.error(be);
            boughtNote = ` The initial buy didn't go through (${esc(be.code === "ACTION_REJECTED" ? "rejected" : be.shortMessage || be.message)}).`;
          }
        }
      } else {
        setStatus("Simulating launch (demo mode)…");
        await new Promise((r) => setTimeout(r, 1200));
        address = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, "0")).join("");
      }
      Store.add({ name, symbol, description: desc, image: logo, twitter: socials.twitter, website: socials.website,
        address, curve, tx, chain: chain.key, creator: W.address, createdAt: Date.now(), mcap: 0, change: 0, progress: 0, mine: true, demo: !chain.factory });
      setStatus(`✅ $${esc(symbol)} is live${chain.factory ? "" : " (demo)"}!${boughtNote} Opening your token page…`, "ok");
      setTimeout(() => (location.href = "token.html?address=" + address), boughtNote ? 3500 : 1500);
    } catch (e) {
      console.error(e);
      setStatus("Launch failed: " + esc(launchError(e)), "err");
    } finally {
      btn.disabled = false;
    }
  };

  renderChains(); renderDemo(); syncTax(); loadFee();
})();
