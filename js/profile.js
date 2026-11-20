(function () {
  const { CFG, W, Feed, logoSVG, logoHTML, esc, fmtUsd, ago, short } = window.SCOTY;
  const $ = (id) => document.getElementById(id);
  const chain = CFG.chains[0];
  const viewing = new URLSearchParams(location.search).get("address"); // public profile link

  let addr = null, tab = "positions", positions = null, launches = null, coinPrice = 0, feeWei = 0n, loadId = 0;

  const fmtNum = (n, d = 6) => (n === 0 ? "0" : n < 1e-6 ? n.toExponential(2) : n.toLocaleString("en-US", { maximumFractionDigits: d }));
  const usd = (n) => (n >= 1000 ? fmtUsd(n) : "$" + n.toFixed(2));

  function readProvider() {
    if (W.provider && W.chainId === chain.chainId) return new ethers.BrowserProvider(W.provider);
    return new ethers.JsonRpcProvider(chain.rpc, chain.chainId, { staticNetwork: true });
  }

  // ── decide whose profile to show ───────────────────────────
  function sync() {
    const target = viewing && ethers.isAddress(viewing) ? viewing : W.address;
    const own = !!W.address && !!target && target.toLowerCase() === W.address.toLowerCase();
    $("gate").hidden = !!target;
    $("content").hidden = !target;
    if (!target) return;
    $("disc").hidden = !own;
    $("claim").hidden = !own;
    $("who").textContent = own ? "Your SCOTY profile" : "SCOTY profile";
    if (addr && addr.toLowerCase() === target.toLowerCase()) { renderFees(); return; }
    addr = ethers.getAddress(target);
    load();
  }

  async function load() {
    const id = ++loadId;
    positions = launches = null; feeWei = 0n;
    $("addr").textContent = addr;
    $("avatar").innerHTML = logoSVG(addr, addr.slice(2, 4));
    $("explorerLink").href = `${chain.explorer}/address/${addr}`;
    $("feeEth").textContent = "…"; $("pfUsd").textContent = "…"; $("pfEth").textContent = "";
    renderTab();

    const api = chain.explorerApi;
    const [stats, ethWei, fee, tokens, all] = await Promise.all([
      Feed.getJSON(`${api}/stats`).catch(() => ({})),
      readProvider().getBalance(addr).catch(() => null),
      chain.feeEscrow ? new ethers.Contract(chain.feeEscrow, CFG.feeEscrowAbi, readProvider()).balanceOf(addr).catch(() => null) : null,
      Feed.getJSON(`${api}/addresses/${addr}/tokens?type=ERC-20`).catch(() => null),
      Feed.loadLaunches().catch(() => []),
    ]);
    if (id !== loadId) return;
    coinPrice = Number(stats.coin_price || 0);

    // creator fees
    feeWei = fee == null ? null : fee;
    renderFees();

    // positions
    positions = tokens ? (tokens.items || []).map((it) => {
      const t = it.token || {};
      const amount = Number(it.value || 0) / 10 ** Number(t.decimals || 18);
      const price = Number(t.exchange_rate || 0);
      return { name: t.name || "Unknown", symbol: t.symbol || "???", address: t.address_hash || t.address, image: Feed.safeImg(t.icon_url), amount, value: amount * price };
    }).filter((p) => p.amount > 0).sort((a, b) => b.value - a.value) : [];

    // portfolio
    const eth = ethWei == null ? null : Number(ethers.formatEther(ethWei));
    const total = (eth || 0) * coinPrice + positions.reduce((s, p) => s + p.value, 0);
    $("pfUsd").textContent = eth == null && !tokens ? "—" : usd(total);
    $("pfEth").textContent = eth == null ? "Balance unavailable" : `${fmtNum(eth)} ${chain.symbol} + ${positions.length} token${positions.length === 1 ? "" : "s"}`;

    // launches by this wallet (on-chain + this browser)
    const me = addr.toLowerCase();
    launches = Feed.merge(all).filter((t) => t.creator && t.creator.toLowerCase() === me).sort((a, b) => b.createdAt - a.createdAt);
    renderTab();
  }

  function renderFees() {
    if (feeWei == null) {
      $("feeEth").textContent = "—";
      $("feeUsd").textContent = "Couldn't read creator fees right now";
      $("claim").disabled = true;
      return;
    }
    const eth = Number(ethers.formatEther(feeWei));
    $("feeEth").textContent = `${fmtNum(eth)} ${chain.symbol}`;
    $("feeUsd").textContent = `${usd(eth * coinPrice)} · Across every launch paid to your wallet`;
    $("claim").disabled = !(feeWei > 0n) || !W.address;
  }

  // ── claim ──────────────────────────────────────────────────
  $("claim").onclick = async () => {
    const st = $("claimStatus");
    const set = (m, c = "") => { st.className = "status " + c; st.innerHTML = m; };
    try {
      $("claim").disabled = true;
      if (W.chainId !== chain.chainId) { set("Switching network…"); await W.switchChain(chain); }
      const signer = await new ethers.BrowserProvider(W.provider).getSigner();
      const escrow = new ethers.Contract(chain.feeEscrow, CFG.feeEscrowAbi, signer);
      const amount = await escrow.balanceOf(W.address);
      if (amount === 0n) { set("Nothing to claim yet."); return; }
      set("Confirm the claim in your wallet…");
      const tx = await escrow.claim(amount);
      set(`Claiming… <a href="${chain.explorer}/tx/${tx.hash}" target="_blank" rel="noopener">view tx ↗</a>`);
      await tx.wait();
      set(`✅ Claimed ${fmtNum(Number(ethers.formatEther(amount)))} ${chain.symbol}`, "ok");
      load();
    } catch (e) {
      console.error(e);
      set("Claim failed: " + esc(e.code === "ACTION_REJECTED" ? "you rejected the transaction" : e.shortMessage || e.message), "err");
      renderFees();
    }
  };

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
        <a class="prow" href="${chain.explorer}/token/${esc(p.address)}" target="_blank" rel="noopener">
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
      body.querySelectorAll(".lcard").forEach((b) => (b.onclick = () => (location.href = "index.html?token=" + launches[+b.dataset.i].address)));
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
