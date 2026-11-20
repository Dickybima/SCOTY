(function () {
  const { CFG, Store, logoHTML, esc, fmtUsd, ago, short, hash } = window.SCOTY;
  const $ = (id) => document.getElementById(id);

  // Sample tokens shown until a Pons v2 indexer/API is connected.
  const now = Date.now(), H = 3600e3;
  const SAMPLE = [
    ["Couch Cat", "CCAT", "A cat that trades memes from the couch and never leaves the sofa.", 182000, 12.4, 64, 5],
    ["Monday Frog", "MFROG", "Only buys the dip on Mondays. Strict schedule, zero exceptions.", 96500, -4.2, 41, 9],
    ["Nap Panda", "NAPDA", "Stakes while it sleeps. Wakes up for green candles only.", 1240000, 33.1, 100, 30],
    ["Orbit Pizza", "ZZA", "A slice of pepperoni orbiting the moon at 3,000 mph.", 54000, 8.8, 22, 2],
    ["Rug Sweeper", "SWEEP", "A tiny robot that cleans up after rug pulls. Very busy.", 310000, -1.6, 77, 14],
    ["Quack Pump", "QUACK", "Quacks every time the chart goes up. Loud ducks only.", 23800, 51.0, 9, 0.6],
    ["Dev Brew", "BREW", "Coffee for devs shipping at 3am. Gas paid in caffeine.", 141000, 3.3, 58, 22],
    ["Pixel Drake", "PXD", "An 8-bit dragon guarding the liquidity pool. Do not poke.", 670000, -7.9, 92, 48],
  ].map(([name, symbol, description, mcap, change, progress, hrs]) => ({
    name, symbol, description, mcap, change, progress, chain: CFG.chains[0].key,
    createdAt: now - hrs * H,
    address: "0x" + (hash(symbol).toString(16) + hash(name).toString(16) + hash(symbol + name).toString(16) + "0000000000").slice(0, 40),
    creator: "0x" + (hash(name + "c").toString(16) + hash(symbol + "c").toString(16) + "00000000000000000000").slice(0, 40),
    sample: true,
  }));

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
      : `<div class="empty">${sort === "mine" ? 'You haven\'t launched anything yet. <a href="create.html" style="color:var(--accent);font-weight:600">Create a token →</a>' : "No tokens match your search."}</div>`;

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
        <button class="btn btn-main" disabled title="Connect Pons v2 trading to enable">Buy</button>
        <button class="btn btn-dark" disabled title="Connect Pons v2 trading to enable">Sell</button>
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
