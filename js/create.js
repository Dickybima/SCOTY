(function () {
  const { CFG, W, Store, logoSVG, esc, short } = window.SCOTY;
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
      ["p2", "p3", "p4"].forEach((id) => $(id).classList.remove("locked"));
      renderLogo(); renderSummary();
      btn.disabled = false;
      btn.innerHTML = "✦ Regenerate";
      $("p2").scrollIntoView({ behavior: "smooth", block: "start" });
    }, 650);
  };

  // ── Step 02 ───────────────────────────────────────────────
  function renderLogo() {
    $("logo").innerHTML = state.image ? `<img src="${state.image}" alt="logo">` : logoSVG(state.seed, $("symbol").value);
  }
  $("symbol").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); renderLogo(); renderSummary(); });
  ["name", "desc"].forEach((id) => $(id).addEventListener("input", renderSummary));
  $("reroll").onclick = () => { state.image = null; state.seed = Math.random().toString(36); renderLogo(); };
  $("upload").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 1024 * 1024) { alert("Please choose an image under 1 MB."); return; }
    const rd = new FileReader();
    rd.onload = () => { state.image = rd.result; renderLogo(); };
    rd.readAsDataURL(f);
  };

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

  // shrink logo so it is cheap to store on-chain
  function shrinkImage(dataUrl, size = 128) {
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas"); c.width = c.height = size;
        const ctx = c.getContext("2d");
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        let out = c.toDataURL("image/webp", 0.8);
        if (!out.startsWith("data:image/webp")) out = c.toDataURL("image/jpeg", 0.8);
        res(out);
      };
      img.onerror = () => res(dataUrl);
      img.src = dataUrl;
    });
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
    const logo = state.image ? await shrinkImage(state.image) : "data:image/svg+xml;utf8," + encodeURIComponent(logoSVG(state.seed, symbol));
    const socials = { twitter: $("x").value.trim(), telegram: "", discord: "", website: $("web").value.trim(), farcaster: "" };

    try {
      let address, curve = null, tx = null, boughtNote = "";
      if (chain.factory && window.ethers) {
        if (W.chainId !== chain.chainId) { setStatus("Switching to " + esc(chain.name) + "…"); await W.switchChain(chain); }
        const provider = new ethers.BrowserProvider(W.provider);
        const signer = await provider.getSigner();
        const factory = new ethers.Contract(chain.factory, CFG.factoryAbi, signer);

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
            const c = new ethers.Contract(curve, CFG.curveAbi, signer);
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
      Store.add({ name, symbol, description: desc, image: logo.startsWith("data:image/svg") ? null : logo, twitter: socials.twitter, website: socials.website,
        address, curve, tx, chain: chain.key, creator: W.address, createdAt: Date.now(), mcap: 0, change: 0, progress: 0, mine: true, demo: !chain.factory });
      setStatus(`✅ $${esc(symbol)} is live${chain.factory ? "" : " (demo)"}!${boughtNote} Taking you to Explore…`, "ok");
      setTimeout(() => (location.href = "index.html?token=" + address), boughtNote ? 3500 : 1500);
    } catch (e) {
      console.error(e);
      const msg = e.code === "ACTION_REJECTED" || e.code === 4001 ? "You rejected the transaction." : e.shortMessage || e.reason || e.message || String(e);
      setStatus("Launch failed: " + esc(msg), "err");
    } finally {
      btn.disabled = false;
    }
  };

  renderChains(); renderDemo(); syncTax(); loadFee();
})();
