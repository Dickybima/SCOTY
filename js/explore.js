(function () {
  const { CFG, W, Feed, Market, logoHTML, tokenUrl, readProvider, imgSrc, esc, fmtUsd, ago, short } = window.SCOTY;
  const $ = (id) => document.getElementById(id);
  const chain = CFG.chains[0];

  let sort = "new";
  let onchain = [];          // SCOTY launches read from chain
  let officialEntry = null;  // the official token, listed even if launched outside SCOTY
  // show the last known list straight away, then refresh it
  const cachedList = Feed.cached();
  if (cachedList) onchain = cachedList;
  let loading = !!chain.factory && !cachedList;
  let feedError = false;

  async function loadFeed() {
    try {
      onchain = await Feed.loadLaunches();
    } catch (e) {
      console.warn("Explore feed unavailable", e);
      feedError = true;
    }
    loading = false;
    stats(); render(); openFromUrl();
  }

  const all = () => {
    const l = Feed.merge(onchain);
    if (officialEntry && !l.some((t) => isOfficial(t.address))) l.push(officialEntry);
    return l;
  };

  function stats() {
    const l = all();
    $("sTokens").textContent = loading ? "…" : l.length;
    $("sMcap").textContent = loading ? "…" : fmtUsd(l.reduce((s, t) => s + (t.mcap || 0), 0));
    $("sGrad").textContent = loading ? "…" : new Set(l.map((t) => (t.creator || "").toLowerCase()).filter(Boolean)).size;
  }

  function render() {
    if (loading) { $("tokens").innerHTML = '<div class="empty"><span class="spin dark"></span> Loading launches…</div>'; return; }
    const q = $("q").value.trim().toLowerCase();
    let l = all().filter((t) => !q || t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q) || t.address.toLowerCase() === q);
    if (sort === "mine") l = l.filter((t) => t.mine);
    if (sort === "new") l.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === "mcap") l.sort((a, b) => b.mcap - a.mcap);
    if (sort === "trending") l.sort((a, b) => (b.mcap || 0) / Math.max(1, (Date.now() - b.createdAt) / 36e5) - (a.mcap || 0) / Math.max(1, (Date.now() - a.createdAt) / 36e5));

    $("tokens").innerHTML = l.length ? l.map((t, i) => `
      <button class="tok" data-i="${i}" type="button">
        <div class="tok-top">
          <div class="logo">${logoHTML(t)}</div>
          <div><b>${esc(t.name)}</b><small>$${esc(t.symbol)}${t.createdAt ? " · " + ago(t.createdAt) : ""}</small></div>
          ${isOfficial(t.address) ? '<span class="chip official">⚓ official</span>' : t.mine ? `<span class="chip mine">${t.demo ? "yours · demo" : "yours"}</span>` : ""}
        </div>
        <p>${esc(t.description || "Launched on " + CFG.network + " · " + short(t.address))}</p>
        <div class="meta"><span>MC ${t.mcap ? fmtUsd(t.mcap) : "—"}</span><span>${short(t.address)}</span></div>
      </button>`).join("")
      : `<div class="empty">${
          sort === "mine" ? 'You haven\'t launched anything yet. <a href="create.html" style="color:var(--accent);font-weight:600">Create a token →</a>'
          : q ? "No tokens match your search."
          : (feedError ? "Couldn't load launches right now. " : "") + 'No tokens yet. <a href="create.html" style="color:var(--accent);font-weight:600">Be the first to launch →</a>'}</div>`;

    $("tokens").querySelectorAll(".tok").forEach((b) => (b.onclick = () => (location.href = tokenUrl(l[+b.dataset.i].address))));
  }

  const close = () => $("modal").classList.remove("open");
  $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  let opened = false;
  function openFromUrl() {
    // old links (?token=0x…) now open the token page
    const a = new URLSearchParams(location.search).get("token");
    if (a && /^0x[0-9a-fA-F]{40}$/.test(a)) location.replace(tokenUrl(a));
  }

  $("q").addEventListener("input", render);
  $("sort").querySelectorAll("button").forEach((b) => (b.onclick = () => {
    $("sort").querySelectorAll("button").forEach((x) => x.classList.remove("on"));
    b.classList.add("on"); sort = b.dataset.s; render();
  }));
  W.onChange(() => { stats(); render(); });

  // ── Official $SCOTY, featured at the top ───────────────────
  const OFFICIAL = (CFG.officialToken || "").toLowerCase();
  function isOfficial(a) { return !!OFFICIAL && !!a && a.toLowerCase() === OFFICIAL; }
  async function loadOfficial() {
    if (!OFFICIAL || !window.ethers || !/^0x[0-9a-f]{40}$/.test(OFFICIAL)) return;
    const el = $("official");
    const addr = ethers.getAddress(OFFICIAL);
    const href = tokenUrl(addr);
    const paint = (d) => {
      el.innerHTML = `
        <a class="off-logo" href="${href}"><img src="assets/logo.png?v=3" alt=""></a>
        <div class="off-main">
          <span class="off-badge">⚓ Official token</span>
          <a class="off-name" href="${href}">${esc(d.name || "SCOTY")} <span>$${esc(d.symbol || "SCOTY")}</span></a>
          <div class="off-stats">
            <div><small>Market cap</small><b>${d.mcap ? fmtUsd(d.mcap) : "—"}</b></div>
            <div><small>Price</small><b>${d.price ? "$" + (d.price >= 1 ? d.price.toFixed(2) : d.price.toPrecision(3)) : "—"}</b></div>
            <div><small>Network</small><b>${esc(CFG.network)}</b></div>
          </div>
        </div>
        <div class="off-cta">
          <a class="btn btn-main" href="${href}">Trade $${esc(d.symbol || "SCOTY")} →</a>
          <button class="btn" type="button" id="offCa">Copy CA</button>
          <span class="off-ca mono">${short(addr)}</span>
        </div>`;
      el.hidden = false;
      $("offCa").onclick = (e) => { navigator.clipboard?.writeText(addr); e.target.textContent = "Copied!"; setTimeout(() => (e.target.textContent = "Copy CA"), 1200); };
    };
    paint({ symbol: "SCOTY" });
    const d = {};
    try {
      const rp = readProvider(chain);
      const token = new ethers.Contract(addr, CFG.tokenAbi, rp);
      const [name, symbol] = await Promise.all([token.name().catch(() => null), token.symbol().catch(() => null)]);
      Object.assign(d, { name, symbol });
      const idx = Feed.merge(onchain).find((t) => t.address.toLowerCase() === OFFICIAL);
      const launch = idx && idx.poolId ? idx : await Market.findLaunch(addr, rp).catch(() => null);
      if (launch) {
        const [[priced], usd] = await Promise.all([Market.withMarketCaps([{ ...launch, address: addr }]), Market.hypeUsd()]);
        d.creator = launch.creator; d.createdAt = launch.createdAt; d.description = idx && idx.description;
        d.mcap = priced.mcap; d.price = priced.priceHype && usd ? priced.priceHype * usd : 0;
        d.launch = launch;
      }
    } catch (e) { console.warn("official token unavailable", e); }
    paint(d);
    loadBurn(addr, d).catch((e) => console.warn("burn stats unavailable", e));
    if (d.name || d.symbol) {
      officialEntry = {
        name: d.name || "SCOTY", symbol: d.symbol || "SCOTY", description: d.description || "The official SCOTY token.",
        image: d.logo || null, address: addr, creator: d.creator, createdAt: d.createdAt || 0,
        mcap: d.mcap || 0, chain: chain.key, ...(d.launch ? { poolId: d.launch.poolId, quoteIsCurrency0: d.launch.quoteIsCurrency0, supply: d.launch.supply } : {}),
      };
      stats(); render();
    }
  }

  // ── Burned $SCOTY ──
  async function loadBurn(addr, d) {
    const el = $("burn"), rp = readProvider(chain);
    const token = new ethers.Contract(addr, CFG.tokenAbi, rp);
    const sinks = (CFG.burnAddresses || []).map((a) => ethers.getAddress(a));
    const [dec, total, ...bals] = await Promise.all([token.decimals().catch(() => 18n), token.totalSupply(), ...sinks.map((a) => token.balanceOf(a).catch(() => 0n))]);
    const one = 10n ** BigInt(dec);
    const initial = BigInt(CFG.supply || 0) * one;
    const toNum = (v) => Number(v / one) + Number(v % one) / Number(one);
    const burnedRaw = bals.reduce((s, b) => s + b, 0n) + (initial > total ? initial - total : 0n);
    const burned = toNum(burnedRaw);
    const supply = toNum(initial > total ? initial : total) || 1;
    const share = burned / supply;
    const fmtAmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + "B" : n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
    const sym = esc(d.symbol || "SCOTY");
    const paint = (rows) => {
      el.innerHTML = `
        <div class="burn-main">
          <span class="burn-badge">🔥 Burned</span>
          <div class="burn-amt"><b>${fmtAmt(burned)}</b> <span>$${sym}</span></div>
          <div class="burn-sub"><b>${(share * 100).toFixed(share < 0.01 ? 3 : 2)}%</b> of the supply is gone forever${d.price && burned ? ` · ≈ ${fmtUsd(burned * d.price)}` : ""}</div>
          <div class="pgbar burn-bar"><i style="width:${Math.min(100, Math.max(share > 0 ? 0.6 : 0, share * 100))}%"></i></div>
          <div class="burn-links">${sinks.map((a) => `<a class="link mono" href="${chain.addressUrl(a)}" target="_blank" rel="noopener">Burn address ${short(a)} ↗</a>`).join("")}</div>
        </div>
        <div class="burn-list">
          <small>Recent burns</small>
          ${rows === null ? `<div class="burn-row muted">Loading…</div>` : rows.length ? rows.map((r) => `<a class="burn-row" href="${chain.txUrl(r.tx)}" target="_blank" rel="noopener"><span>🔥 ${fmtAmt(r.amount)} $${sym}</span><span class="muted">${r.ts ? ago(r.ts) : ""} ↗</span></a>`).join("") : `<div class="burn-row muted">No burns yet. Stay tuned.</div>`}
        </div>`;
      el.hidden = false;
    };
    paint(null);
    let rows = [];
    try {
      const T = ethers.id("Transfer(address,address,uint256)");
      const zero = ethers.zeroPadValue(ethers.ZeroAddress, 32);
      const to = [...sinks, ethers.ZeroAddress].map((a) => ethers.zeroPadValue(a, 32));
      const logs = await rp.getLogs({ address: addr, topics: [T, null, to], fromBlock: chain.factoryDeployBlock || 0, toBlock: "latest" });
      const last = logs.filter((l) => l.topics[1] !== zero).slice(-5).reverse();
      rows = await Promise.all(last.map(async (l) => {
        const b = await rp.getBlock(l.blockNumber).catch(() => null);
        return { tx: l.transactionHash, amount: toNum(BigInt(l.data)), ts: b ? b.timestamp * 1000 : 0 };
      }));
    } catch (e) { console.warn("burn history unavailable", e); }
    paint(rows);
  }

  stats(); render(); openFromUrl();
  loadOfficial();
  loadFeed();

})();
