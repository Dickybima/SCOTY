(function () {
  const { CFG, W, Feed, logoHTML, tokenUrl, readProvider, imgSrc, esc, fmtUsd, ago, short } = window.SCOTY;
  const $ = (id) => document.getElementById(id);
  const chain = CFG.chains[0];

  let sort = "new";
  let onchain = [];          // SCOTY launches read from chain
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

  const all = () => Feed.merge(onchain);

  function stats() {
    const l = all();
    $("sTokens").textContent = loading ? "…" : l.length;
    $("sMcap").textContent = loading ? "…" : fmtUsd(l.reduce((s, t) => s + (t.mcap || 0), 0));
    $("sGrad").textContent = loading ? "…" : l.reduce((s, t) => s + (t.holders || 0), 0);
  }

  function render() {
    if (loading) { $("tokens").innerHTML = '<div class="empty"><span class="spin dark"></span> Loading launches…</div>'; return; }
    const q = $("q").value.trim().toLowerCase();
    let l = all().filter((t) => !q || t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q) || t.address.toLowerCase() === q);
    if (sort === "mine") l = l.filter((t) => t.mine);
    if (sort === "new") l.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === "mcap") l.sort((a, b) => b.mcap - a.mcap);
    if (sort === "trending") l.sort((a, b) => (b.holders || 0) - (a.holders || 0) || b.mcap - a.mcap);

    $("tokens").innerHTML = l.length ? l.map((t, i) => `
      <button class="tok" data-i="${i}" type="button">
        <div class="tok-top">
          <div class="logo">${logoHTML(t)}</div>
          <div><b>${esc(t.name)}</b><small>$${esc(t.symbol)} · ${ago(t.createdAt)}</small></div>
          ${isOfficial(t.address) ? '<span class="chip official">⚓ official</span>' : t.mine ? `<span class="chip mine">${t.demo ? "yours · demo" : "yours"}</span>` : ""}
        </div>
        <p>${esc(t.description || "Launched on Robinhood Chain · " + short(t.address))}</p>
        <div class="meta"><span>MC ${t.mcap ? fmtUsd(t.mcap) : "—"}</span><span>${t.holders ? t.holders + " holders" : "new"}</span></div>
      </button>`).join("")
      : `<div class="empty">${
          sort === "mine" ? 'You haven\'t launched anything yet. <a href="create.html" style="color:var(--accent);font-weight:600">Create a token →</a>'
          : q ? "No tokens match your search."
          : (feedError ? "Couldn't reach the Robinhood Chain explorer right now. " : "") + 'No tokens yet. <a href="create.html" style="color:var(--accent);font-weight:600">Be the first to launch →</a>'}</div>`;

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
      const pg = d.progress == null ? null : Math.min(100, d.progress);
      el.innerHTML = `
        <a class="off-logo" href="${href}">${d.logo ? `<img src="${esc(imgSrc(d.logo))}" alt="">` : '<img src="assets/logo.png?v=2" alt="">'}</a>
        <div class="off-main">
          <span class="off-badge">⚓ Official token</span>
          <a class="off-name" href="${href}">${esc(d.name || "SCOTY")} <span>$${esc(d.symbol || "SCOTY")}</span></a>
          <div class="off-stats">
            <div><small>Market cap</small><b>${d.mcap ? fmtUsd(d.mcap) : "—"}</b></div>
            <div><small>Price</small><b>${d.price ? "$" + (d.price >= 1 ? d.price.toFixed(2) : d.price.toPrecision(3)) : "—"}</b></div>
            <div><small>Holders</small><b>${d.holders ? d.holders.toLocaleString("en-US") : "—"}</b></div>
            <div><small>Bonding</small><b>${d.graduated ? "Graduated" : pg == null ? "—" : pg.toFixed(1) + "%"}</b></div>
          </div>
          ${!d.graduated && pg != null ? `<div class="pgbar"><i style="width:${pg}%"></i></div>` : ""}
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
      const factory = new ethers.Contract(chain.factory, CFG.factoryAbi, rp);
      const [name, symbol, info, lt] = await Promise.all([
        token.name().catch(() => null), token.symbol().catch(() => null),
        token.getTokenInfo().catch(() => null), factory.getLaunchedToken(addr).catch(() => null),
      ]);
      Object.assign(d, { name, symbol, logo: info && Feed.safeImg(info.tokenLogo) });
      if (lt && lt.exists) {
        d.graduated = Number(lt.phase) > 0;
        const c = new ethers.Contract(lt.curve, CFG.curveAbi, rp);
        const [res, raised, threshold, supply, stats, tok] = await Promise.all([
          c.getReserves(), c.realQuoteReserve(), c.graduationThreshold(), token.totalSupply().catch(() => 10n ** 27n),
          Feed.getJSON(`${chain.explorerApi}/stats`).catch(() => ({})), Feed.getJSON(`${chain.explorerApi}/tokens/${addr}`).catch(() => ({})),
        ]);
        const ethUsd = Number(stats.coin_price || 0);
        const pEth = Number(res[1]) > 0 ? Number(res[0]) / Number(res[1]) : 0;
        d.price = pEth * ethUsd;
        d.mcap = d.price * Number(ethers.formatUnits(supply, 18));
        d.progress = threshold > 0n ? (Number(raised) / Number(threshold)) * 100 : null;
        d.holders = Number(tok.holders_count || 0);
      }
    } catch (e) { console.warn("official token unavailable", e); }
    paint(d);
  }

  stats(); render(); openFromUrl();
  loadOfficial();
  loadFeed();

})();
