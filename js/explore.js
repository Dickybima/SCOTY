(function () {
  const { CFG, W, Feed, logoHTML, esc, fmtUsd, ago, short } = window.SCOTY;
  const $ = (id) => document.getElementById(id);
  const chain = CFG.chains[0];

  let sort = "new";
  let onchain = [];          // SCOTY launches read from chain
  let loading = !!chain.factory;
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
