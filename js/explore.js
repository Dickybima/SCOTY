(function () {
  const { CFG, W, Store, logoHTML, esc, fmtUsd, ago, short } = window.SCOTY;
  const $ = (id) => document.getElementById(id);
  const chain = CFG.chains[0];

  let sort = "new";
  let onchain = [];          // SCOTY launches read from chain
  let loading = !!chain.factory;
  let feedError = false;

  // ── On-chain feed: ONLY launches made through SCOTY ─────────
  // Every SCOTY launch calls the factory's launchToken with a salt that
  // starts with CFG.launchTag. We scan the factory's incoming transactions
  // (Blockscout API), decode their input and keep the tagged ones.
  async function getJSON(url) {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }

  const MAX_PAGES = 20; // ~1000 most recent factory txs
  const TAG = CFG.launchTag.toLowerCase();
  const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const ZERO_TOPIC = "0x" + "0".repeat(64);
  const safeImg = (u) => (typeof u === "string" && /^(data:image\/(png|jpe?g|webp|gif|svg\+xml)[;,]|https:\/\/)/i.test(u) ? u : null);

  async function scotyLaunchTxs() {
    const iface = new ethers.Interface(CFG.factoryAbi);
    const selector = iface.getFunction("launchToken").selector;
    const found = [];
    let params = "";
    for (let page = 0; page < MAX_PAGES; page++) {
      const data = await getJSON(`${chain.explorerApi}/addresses/${chain.factory}/transactions?filter=to${params}`);
      for (const tx of data.items || []) {
        if (tx.status && tx.status !== "ok") continue;
        let input = tx.raw_input;
        if (input === undefined) {
          if (tx.method && !/launchToken|a72101af/i.test(tx.method)) continue;
          input = (await getJSON(`${chain.explorerApi}/transactions/${tx.hash}`).catch(() => ({}))).raw_input;
        }
        if (!input || !input.toLowerCase().startsWith(selector)) continue;
        let p;
        try { p = iface.parseTransaction({ data: input }).args[0]; } catch (_) { continue; }
        if (!p.salt.toLowerCase().startsWith(TAG)) continue; // not launched via SCOTY
        found.push({ tx, p });
      }
      const next = data.next_page_params;
      if (!next) break;
      params = "&" + new URLSearchParams(next).toString();
    }
    return found;
  }

  async function tokenAddressOf(hash) {
    const logs = await getJSON(`${chain.explorerApi}/transactions/${hash}/logs`);
    const mint = (logs.items || []).find((l) => l.topics && l.topics[0] === TRANSFER && l.topics[1] === ZERO_TOPIC);
    return mint && (mint.address.hash || mint.address);
  }

  async function loadFeed() {
    if (!chain.factory || !chain.explorerApi || !window.ethers) { loading = false; stats(); render(); return; }
    try {
      const launches = await scotyLaunchTxs();
      onchain = (await Promise.all(launches.map(async ({ tx, p }) => {
        const address = await tokenAddressOf(tx.hash).catch(() => null);
        if (!address) return null;
        const tok = await getJSON(`${chain.explorerApi}/tokens/${address}`).catch(() => ({}));
        return {
          name: p.name, symbol: p.symbol, description: p.description,
          image: safeImg(p.logo), twitter: /^https:\/\//.test(p.socials.twitter) ? p.socials.twitter : null,
          website: /^https:\/\//.test(p.socials.website) ? p.socials.website : null,
          address, creator: (tx.from && (tx.from.hash || tx.from)) || p.creatorFeeRecipient, tx: tx.hash,
          createdAt: tx.timestamp ? Date.parse(tx.timestamp) : Date.now(),
          mcap: Number(tok.circulating_market_cap || 0) || (Number(tok.exchange_rate || 0) * Number(tok.total_supply || 0) / 10 ** Number(tok.decimals || 18)) || 0,
          holders: Number(tok.holders_count || tok.holders || 0),
          change: 0, progress: null, chain: chain.key,
        };
      }))).filter(Boolean);
    } catch (e) {
      console.warn("Explore feed unavailable", e);
      feedError = true;
    }
    loading = false;
    stats(); render(); openFromUrl();
  }

  // merge on-chain launches with ones made from this browser (instant, before indexing)
  function all() {
    const map = new Map();
    for (const t of onchain) map.set(t.address.toLowerCase(), t);
    for (const t of Store.all()) {
      if (!t.address) continue;
      if (t.demo && chain.factory) continue; // hide old demo launches once live
      const k = t.address.toLowerCase();
      map.set(k, map.has(k) ? { ...map.get(k), description: t.description, image: map.get(k).image || t.image, twitter: t.twitter, website: t.website, mine: true } : t);
    }
    const me = W.address && W.address.toLowerCase();
    return [...map.values()].map((t) => ({ ...t, mine: t.mine || (me && t.creator && t.creator.toLowerCase() === me) }));
  }

  function stats() {
    const l = all();
    $("sTokens").textContent = loading ? "…" : l.length;
    $("sMcap").textContent = loading ? "…" : fmtUsd(l.reduce((s, t) => s + (t.mcap || 0), 0));
    $("sGrad").textContent = loading ? "…" : l.reduce((s, t) => s + (t.holders || 0), 0);
  }

  function render() {
    if (loading) { $("tokens").innerHTML = '<div class="empty">Loading launches…</div>'; return; }
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
          ${t.mine ? `<span class="chip mine">${t.demo ? "yours · demo" : "yours"}</span>` : ""}
        </div>
        <p>${esc(t.description || "Launched on Robinhood Chain · " + short(t.address))}</p>
        <div class="meta"><span>MC ${t.mcap ? fmtUsd(t.mcap) : "—"}</span><span>${t.holders ? t.holders + " holders" : "new"}</span></div>
      </button>`).join("")
      : `<div class="empty">${
          sort === "mine" ? 'You haven\'t launched anything yet. <a href="create.html" style="color:var(--accent);font-weight:600">Create a token →</a>'
          : q ? "No tokens match your search."
          : (feedError ? "Couldn't reach the Robinhood Chain explorer right now. " : "") + 'No tokens yet. <a href="create.html" style="color:var(--accent);font-weight:600">Be the first to launch →</a>'}</div>`;

    $("tokens").querySelectorAll(".tok").forEach((b) => (b.onclick = () => open(l[+b.dataset.i])));
  }

  function open(t) {
    const link = (u, txt) => (u ? `<a class="btn btn-sm" href="${esc(u)}" target="_blank" rel="noopener">${txt}</a>` : "");
    $("sheet").innerHTML = `
      <button class="close" aria-label="Close">✕</button>
      <div class="tok-top"><div class="logo">${logoHTML(t)}</div><div><b style="font-size:1.4rem">${esc(t.name)}</b><small>$${esc(t.symbol)} · ${esc(chain.name)}</small></div></div>
      ${t.description ? `<p style="color:var(--muted);margin:10px 0 14px">${esc(t.description)}</p>` : '<div style="height:12px"></div>'}
      <div class="summary">
        <div><span>Market cap</span> ${t.mcap ? fmtUsd(t.mcap) : "—"}</div>
        <div><span>Holders   </span> ${t.holders || "—"}</div>
        <div><span>Creator   </span> ${short(t.creator) || "—"}</div>
        <div><span>Launched  </span> ${ago(t.createdAt)}</div>
      </div>
      <div class="addr">${esc(t.address)}</div>
      <div class="row">${t.demo ? "" : link(`${chain.explorer}/token/${t.address}`, "Explorer ↗")}${t.tx && !t.demo ? link(`${chain.explorer}/tx/${t.tx}`, "Launch tx ↗") : ""}${link(t.twitter, "X ↗")}${link(t.website, "Website ↗")}
        <button class="btn btn-sm" id="copy">Copy address</button></div>
      <div class="trade">
        <button class="btn btn-main" disabled title="Trading coming soon">Buy</button>
        <button class="btn btn-dark" disabled title="Trading coming soon">Sell</button>
      </div>
      ${t.demo ? '<p class="status">Demo launch — not on-chain.</p>' : '<p class="status">Live on Robinhood Chain.</p>'}`;
    $("modal").classList.add("open");
    $("sheet").querySelector(".close").onclick = close;
    $("copy").onclick = (e) => { navigator.clipboard?.writeText(t.address); e.target.textContent = "Copied!"; };
  }
  const close = () => $("modal").classList.remove("open");
  $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  let opened = false;
  function openFromUrl() {
    const a = new URLSearchParams(location.search).get("token");
    if (!a || opened) return;
    const t = all().find((x) => x.address.toLowerCase() === a.toLowerCase());
    if (t) { opened = true; open(t); }
  }

  $("q").addEventListener("input", render);
  $("sort").querySelectorAll("button").forEach((b) => (b.onclick = () => {
    $("sort").querySelectorAll("button").forEach((x) => x.classList.remove("on"));
    b.classList.add("on"); sort = b.dataset.s; render();
  }));
  W.onChange(() => { stats(); render(); });

  stats(); render(); openFromUrl();
  loadFeed();
})();
