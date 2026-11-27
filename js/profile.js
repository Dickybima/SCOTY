(function () {
  const { CFG, W, Feed, Market, logoSVG, logoHTML, esc, fmtUsd, ago, short } = window.SCOTY;
  const $ = (id) => document.getElementById(id);
  const chain = CFG.chains[0];
  const viewing = new URLSearchParams(location.search).get("address"); // public profile link

  let addr = null, tab = "positions", positions = null, launches = null, coinPrice = 0, loadId = 0;

  const fmtNum = (n, d = 6) => (n === 0 ? "0" : n < 1e-6 ? n.toExponential(2) : n.toLocaleString("en-US", { maximumFractionDigits: d }));
  const usd = (n) => (n >= 1000 ? fmtUsd(n) : "$" + n.toFixed(2));

  const readProvider = () => window.SCOTY.readProvider(chain);

  // ── decide whose profile to show ───────────────────────────
  function sync() {
    const target = viewing && ethers.isAddress(viewing) ? viewing : W.address;
    const own = !!W.address && !!target && target.toLowerCase() === W.address.toLowerCase();
    $("gate").hidden = !!target;
    $("content").hidden = !target;
    if (!target) return;
    $("disc").hidden = !own;
    $("who").textContent = own ? "Your SCOTY profile" : "SCOTY profile";
    if (addr && addr.toLowerCase() === target.toLowerCase()) return;
    addr = ethers.getAddress(target);
    load();
  }

  async function load() {
    const id = ++loadId;
    positions = launches = null;
    $("addr").textContent = addr;
    $("avatar").innerHTML = logoSVG(addr, addr.slice(2, 4));
    $("explorerLink").href = chain.addressUrl(addr);
    $("montraProfile").href = CFG.protocolUrl;
    $("feeEth").textContent = "…"; $("pfUsd").textContent = "…"; $("pfEth").textContent = "";
    renderTab();

    const rp = readProvider();
    const [hypeUsd, hypeWei, all] = await Promise.all([
      Market.hypeUsd(),
      rp.getBalance(addr).catch(() => null),
      Feed.loadLaunches().catch(() => Feed.cached() || []),
    ]);
    if (id !== loadId) return;
    coinPrice = hypeUsd;
    const list = Feed.merge(all);

    // launches by this wallet
    const me = addr.toLowerCase();
    launches = list.filter((t) => t.creator && t.creator.toLowerCase() === me).sort((a, b) => b.createdAt - a.createdAt);
    $("feeEth").textContent = String(launches.length);
    $("feeUsd").textContent = launches.length === 1 ? "Coin launched on SCOTY" : "Coins launched on SCOTY";

    // positions: balances of SCOTY coins, valued at each pool's price
    const withPx = await Market.withMarketCaps(list.filter((t) => t.poolId)).catch(() => list);
    const bal = await Promise.all(withPx.map((t) => new ethers.Contract(t.address, CFG.tokenAbi, rp).balanceOf(addr).catch(() => 0n)));
    if (id !== loadId) return;
    positions = withPx.map((t, i) => {
      const amount = Number(ethers.formatUnits(bal[i], 18));
      return { ...t, amount, value: amount * (t.priceHype || 0) * coinPrice };
    }).filter((p) => p.amount > 0).sort((a, b) => b.value - a.value);

    // portfolio
    const hype = hypeWei == null ? null : Number(ethers.formatEther(hypeWei));
    const total = (hype || 0) * coinPrice + positions.reduce((s, p) => s + p.value, 0);
    $("pfUsd").textContent = hype == null ? "—" : coinPrice ? usd(total) : fmtNum(hype) + " " + chain.symbol;
    $("pfEth").textContent = hype == null ? "Balance unavailable" : `${fmtNum(hype)} ${chain.symbol} + ${positions.length} SCOTY coin${positions.length === 1 ? "" : "s"}`;
    renderTab();
  }

  // ── tabs ───────────────────────────────────────────────────
  $("ptabs").querySelectorAll("button").forEach((b) => (b.onclick = () => {
    $("ptabs").querySelectorAll("button").forEach((x) => x.classList.remove("on"));
    b.classList.add("on"); tab = b.dataset.t; renderTab();
  }));

  function renderTab() {
    const body = $("pbody");
    if (tab === "positions") {
      if (!positions) { body.innerHTML = '<div class="empty">Loading positions…</div>'; return; }
      if (!positions.length) { body.innerHTML = '<div class="empty">No token positions yet. <a href="index.html">Explore tokens →</a></div>'; return; }
      body.innerHTML = `<div class="plist">${positions.map((p) => `
        <a class="prow" href="token.html?address=${esc(p.address)}">
          <div class="logo">${logoHTML(p)}</div>
          <div class="prow-main"><b>${esc(p.name)}</b><small>${fmtNum(p.amount, 2)} ${esc(p.symbol)}</small></div>
          <span class="mono">${p.value ? usd(p.value) : "—"}</span>
        </a>`).join("")}</div>`;
    } else {
      if (!launches) { body.innerHTML = '<div class="empty">Loading launches…</div>'; return; }
      if (!launches.length) { body.innerHTML = '<div class="empty">No launches yet. <a href="create.html">Launch your first token →</a></div>'; return; }
      body.innerHTML = `<div class="lgrid">${launches.map((t, i) => `
        <button class="lcard" data-i="${i}" type="button">
          <div class="lcard-img">${logoHTML(t)}</div>
          <div class="lcard-txt"><b>${esc(t.name)}</b><small>$${esc(t.symbol)} · ${ago(t.createdAt)}</small>
          <span class="mono">${t.mcap ? "MC " + fmtUsd(t.mcap) : "new"}${t.holders ? " · " + t.holders + " holders" : ""}</span></div>
        </button>`).join("")}</div>`;
      body.querySelectorAll(".lcard").forEach((b) => (b.onclick = () => (location.href = "token.html?address=" + launches[+b.dataset.i].address)));
    }
  }

  // ── identity buttons ───────────────────────────────────────
  $("copyAddr").onclick = (e) => { navigator.clipboard?.writeText(addr); e.target.textContent = "Copied!"; setTimeout(() => (e.target.textContent = "Copy address"), 1200); };
  $("share").onclick = async (e) => {
    const url = new URL("profile.html?address=" + addr, location.href).href;
    if (navigator.share) { try { await navigator.share({ title: "SCOTY profile", url }); return; } catch (_) {} }
    navigator.clipboard?.writeText(url); e.target.textContent = "Link copied!"; setTimeout(() => (e.target.textContent = "Share"), 1200);
  };
  $("disc").onclick = () => { W.disconnect(); };
  $("gateBtn").onclick = () => W.connect();

  W.onChange(sync);
  // wait briefly for silent wallet reconnect before showing the gate
  $("content").hidden = true;
  setTimeout(sync, viewing ? 0 : 600);
})();
