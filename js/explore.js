(function () {
  const { CFG, W, Feed, logoHTML, tokenUrl, esc, fmtUsd, ago, short } = window.SCOTY;
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

  stats(); render(); openFromUrl();
  loadFeed();
})();
