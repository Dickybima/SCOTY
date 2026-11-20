(function () {
  const { CFG, Store, logoHTML, esc, fmtUsd, ago, short, hash } = window.SCOTY;
  const $ = (id) => document.getElementById(id);

  // Real tokens come from a Robinhood Chain indexer/API (not connected yet).
  const SAMPLE = [];

  let sort = "trending";
  const all = () => [...Store.all(), ...SAMPLE];

  function stats() {
    const l = all();
    $("sTokens").textContent = l.length;
    $("sMcap").textContent = fmtUsd(l.reduce((s, t) => s + (t.mcap || 0), 0));
    $("sGrad").textContent = l.filter((t) => t.progress >= 100).length;
  }

  function render() {
    const q = $("q").value.trim().toLowerCase();
    let l = all().filter((t) => !q || t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q));
    if (sort === "mine") l = l.filter((t) => t.mine);
    if (sort === "new") l.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === "mcap") l.sort((a, b) => b.mcap - a.mcap);
    if (sort === "trending") l.sort((a, b) => (b.change + (b.mine ? 1000 : 0)) - (a.change + (a.mine ? 1000 : 0)));

    $("tokens").innerHTML = l.length ? l.map((t, i) => `
      <button class="tok" data-i="${i}" type="button">
        <div class="tok-top">
          <div class="logo">${logoHTML(t)}</div>
          <div><b>${esc(t.name)}</b><small>$${esc(t.symbol)} · ${ago(t.createdAt)}</small></div>
          ${t.mine ? `<span class="chip mine">${t.demo ? "yours · demo" : "yours"}</span>` : t.progress >= 100 ? '<span class="chip">graduated</span>' : ""}
        </div>
        <p>${esc(t.description)}</p>
        <div class="meta"><span>MC ${fmtUsd(t.mcap)}</span><span class="${t.change >= 0 ? "up" : "down"}">${t.change >= 0 ? "▲" : "▼"} ${Math.abs(t.change).toFixed(1)}%</span></div>
        <div class="curve" title="Bonding curve ${t.progress}%"><i style="width:${Math.min(t.progress, 100)}%"></i></div>
      </button>`).join("")
      : `<div class="empty">${sort === "mine" ? 'You haven\'t launched anything yet. <a href="create.html" style="color:var(--accent);font-weight:600">Create a token →</a>' : (q ? "No tokens match your search." : 'No tokens yet. <a href="create.html" style="color:var(--accent);font-weight:600">Be the first to launch →</a>')}</div>`;

    $("tokens").querySelectorAll(".tok").forEach((b) => (b.onclick = () => open(l[+b.dataset.i])));
  }

  function open(t) {
    const chain = CFG.chains.find((c) => c.key === t.chain) || CFG.chains[0];
    const link = (u, txt) => (u ? `<a class="btn btn-sm" href="${esc(u)}" target="_blank" rel="noopener">${txt}</a>` : "");
    $("sheet").innerHTML = `
      <button class="close" aria-label="Close">✕</button>
      <div class="tok-top"><div class="logo">${logoHTML(t)}</div><div><b style="font-size:1.4rem">${esc(t.name)}</b><small>$${esc(t.symbol)} · ${esc(chain.name)}</small></div></div>
      <p style="color:var(--muted);margin:10px 0 14px">${esc(t.description)}</p>
      <div class="summary">
        <div><span>Market cap </span> ${fmtUsd(t.mcap)}</div>
        <div><span>Bonding   </span> ${t.progress}%${t.progress >= 100 ? " · graduated" : ""}</div>
        <div><span>Creator   </span> ${short(t.creator) || "—"}</div>
        <div><span>Launched  </span> ${ago(t.createdAt)}</div>
      </div>
      <div class="addr">${esc(t.address)}</div>
      <div class="row">${t.sample || t.demo ? "" : link(`${chain.explorer}/token/${t.address}`, "Explorer ↗")}${link(t.twitter, "X ↗")}${link(t.website, "Website ↗")}
        <button class="btn btn-sm" id="copy">Copy address</button></div>
      <div class="trade">
        <button class="btn btn-main" disabled title="Trading not connected yet">Buy</button>
        <button class="btn btn-dark" disabled title="Trading not connected yet">Sell</button>
      </div>
      ${t.sample ? '<p class="status">Sample token for preview.</p>' : t.demo ? '<p class="status">Demo launch — not on-chain.</p>' : ""}`;
    $("modal").classList.add("open");
    $("sheet").querySelector(".close").onclick = close;
    $("copy").onclick = (e) => { navigator.clipboard?.writeText(t.address); e.target.textContent = "Copied!"; };
  }
  const close = () => $("modal").classList.remove("open");
  $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  $("q").addEventListener("input", render);
  $("sort").querySelectorAll("button").forEach((b) => (b.onclick = () => {
    $("sort").querySelectorAll("button").forEach((x) => x.classList.remove("on"));
    b.classList.add("on"); sort = b.dataset.s; render();
  }));

  if (new URLSearchParams(location.search).get("new")) $("sort").querySelector('[data-s="mine"]').click();
  stats(); render();
})();
