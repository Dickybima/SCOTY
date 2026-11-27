// Token page: live chart, market cap, trades, and buy/sell on the coin's Montra pool
// (Uniswap v4 on Elysium, traded through Montra's LaunchRouter).
(function () {
  const { CFG, W, Feed, Market, Store, logoSVG, tokenImg, isOfficialToken, OFFICIAL_LOGO, readProvider, esc, ago, short } = window.SCOTY;
  const $ = (id) => document.getElementById(id);
  const chain = CFG.chains[0];
  const BPS = 10000n;
  const ZERO = "0x0000000000000000000000000000000000000000";
  const address = new URLSearchParams(location.search).get("address") || "";

  const S = {
    launch: null, key: null, poolId: null, buyIsZeroForOne: true, symbol: "", name: "", decimals: 18, supply: CFG.supply,
    priceHype: 0, usd: 0, feePct: null, window: 0, trades: [], lastBlock: 0,
    myHype: null, myTok: null, side: "buy", busy: false, quote: null, quoteFor: "",
  };

  // ── formatting ─────────────────────────────────────────────
  const num = (x, d = 2) => x.toLocaleString("en-US", { maximumFractionDigits: d });
  function compact(x) {
    const a = Math.abs(x);
    if (a >= 1e12) return num(x / 1e12, 2) + "T";
    if (a >= 1e9) return num(x / 1e9, 2) + "B";
    if (a >= 1e6) return num(x / 1e6, 2) + "M";
    if (a >= 1e3) return num(x / 1e3, 2) + "K";
    return num(x, a < 1 ? 4 : 2);
  }
  function small(x) {
    if (x === 0) return "0";
    if (x >= 1) return num(x, 4);
    const z = Math.max(0, Math.floor(-Math.log10(x)));
    return x.toFixed(Math.min(18, z + 3));
  }
  const usd = (x) => (x >= 1 ? "$" + compact(x) : "$" + small(x));
  const hype = (x) => (x >= 0.0001 || x === 0 ? num(x, 6) : x.toExponential(2)) + " HYPE";
  const f18 = (w) => Number(ethers.formatUnits(w, 18));
  const tokF = (w) => Number(ethers.formatUnits(w, S.decimals));
  const mcapOf = (p) => (S.usd ? p * S.supply * S.usd : p * S.supply);
  const fmtMcap = (p) => (S.usd ? usd(mcapOf(p)) : hype(p * S.supply));
  const WINDOW_LABEL = (s) => (!s ? "no anti-snipe" : s < 60 ? s + "s anti-snipe" : s / 60 + "m anti-snipe");

  // ── load ───────────────────────────────────────────────────
  async function findLaunch(rp) {
    const lc = address.toLowerCase();
    const pick = (list) => list && list.find((t) => t.address && t.address.toLowerCase() === lc && t.poolId);
    let l = pick(Feed.cached());
    if (!l) l = pick(await Feed.loadLaunches().catch(() => null));
    if (l && l.key) return l;
    const chainL = await Market.findLaunch(address, rp).catch((e) => { console.warn(e); return null; });
    return chainL ? { ...(l || {}), ...chainL } : l || null;
  }

  async function load() {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return fail("Token not found.");
    const rp = readProvider(chain);
    const token = new ethers.Contract(address, CFG.tokenAbi, rp);
    let supply;
    try {
      [S.name, S.symbol, S.decimals, supply] = await Promise.all([
        token.name(), token.symbol(), token.decimals().then(Number).catch(() => 18), token.totalSupply(),
      ]);
    } catch (e) {
      console.warn(e);
      return fail(`Couldn't load this token from ${chain.name}. Check your connection and refresh.`);
    }
    S.supply = tokF(supply);
    S.launch = await findLaunch(rp);
    if (!S.launch || !S.launch.poolId) return fail(`This token wasn't launched on ${CFG.protocol}.`);
    S.poolId = S.launch.poolId;
    S.key = S.launch.key;
    // native HYPE is currency0 in Montra's HYPE pools: buying the coin swaps 0 → 1
    S.buyIsZeroForOne = S.launch.quoteIsCurrency0 !== false;

    renderHead(S.launch);
    $("tkMsg").hidden = true;
    $("tk").hidden = false;
    document.title = `${S.name} ($${S.symbol}) — SCOTY`;

    const f = new ethers.Contract(chain.factory, CFG.factoryAbi, rp);
    f.getConfig(S.launch.configId).then((c) => {
      S.feePct = Number(c.totalFeePips) / 10000;
      S.window = Number(c.earlyBuyFeeStartPips) > 0 ? Number(c.earlyBuyFeeWindow) : 0;
      renderStats();
    }).catch(() => {});

    await Promise.all([refreshPrice(), refreshTrades(), refreshBalances()]);
    setInterval(() => { refreshPrice().then(renderAll); refreshTrades(); }, 15000);
  }
  function fail(msg) { $("tkMsg").textContent = msg; }

  function renderHead(l) {
    const logo = l && Feed.safeImg(l.image);
    $("tkLogo").innerHTML = isOfficialToken(address) ? `<img src="${OFFICIAL_LOGO}" alt="">`
      : logo ? tokenImg(logo, { symbol: S.symbol, name: S.name }) : logoSVG(S.symbol + S.name, S.symbol);
    $("tkName").textContent = S.name;
    $("tkSym").textContent = "$" + S.symbol;
    $("tkPhase").textContent = CFG.protocol;
    const links = [];
    if (l && /^https:\/\//.test(l.twitter || "")) links.push(`<a class="btn btn-sm" href="${esc(l.twitter)}" target="_blank" rel="noopener">X ↗</a>`);
    if (l && /^https:\/\//.test(l.website || "")) links.push(`<a class="btn btn-sm" href="${esc(l.website)}" target="_blank" rel="noopener">Website ↗</a>`);
    links.push(`<button class="btn btn-sm" id="copyCa" type="button">Copy CA</button>`);
    $("tkLinks").innerHTML = links.join("");
    $("copyCa").onclick = (e) => { navigator.clipboard?.writeText(address); e.target.textContent = "Copied!"; setTimeout(() => (e.target.textContent = "Copy CA"), 1200); };
    $("montraLink").href = chain.montraTokenUrl(address);

    $("about").hidden = false;
    $("tkDesc").textContent = (l && l.description) || `Launched on ${CFG.protocol}.`;
    $("tkAddr").textContent = short(address); $("tkAddr").href = chain.tokenUrl(address);
    $("tkCreator").textContent = l && l.creator ? short(l.creator) : "—";
    if (l && l.creator) $("tkCreator").href = "profile.html?address=" + l.creator;
    $("tkPool").textContent = S.poolId ? S.poolId.slice(0, 10) + "…" + S.poolId.slice(-6) : "—";
  }

  async function refreshPrice() {
    try {
      const sv = new ethers.Contract(chain.stateView, CFG.stateViewAbi, readProvider(chain));
      const [s0, u] = await Promise.all([sv.getSlot0(S.poolId), Market.hypeUsd()]);
      S.priceHype = Market.priceFromSqrt(s0.sqrtPriceX96, S.launch.quoteIsCurrency0);
      S.usd = u;
    } catch (e) { console.warn("price read failed", e); }
  }

  // trades: the PoolManager's Swap events for this pool, newest first
  async function refreshTrades() {
    const rp = readProvider(chain);
    const pm = new ethers.Interface(CFG.poolManagerAbi);
    const topic = pm.getEvent("Swap").topicHash;
    const latest = await rp.getBlockNumber().catch(() => 0);
    if (!latest) return;
    const start = S.lastBlock ? S.lastBlock + 1 : Number(S.launch.block || chain.factoryDeployBlock);
    const logs = [];
    const fetchRange = (from, to) => rp.getLogs({ address: chain.poolManager, topics: [topic, S.poolId], fromBlock: from, toBlock: to });
    try {
      logs.push(...await fetchRange(start, latest));
    } catch (_) {
      // the RPC limits wide ranges: walk back in chunks from the newest block
      let to = latest, size = 200000;
      for (let i = 0; i < 60 && to >= start && logs.length < 300; i++) {
        const from = Math.max(start, to - size + 1);
        try { logs.push(...await fetchRange(from, to)); to = from - 1; }
        catch (_) { if (size <= 2000) break; size = Math.floor(size / 4); }
      }
    }
    S.lastBlock = latest;
    const fresh = [];
    for (const l of logs) {
      let ev;
      try { ev = pm.parseLog(l); } catch (_) { continue; }
      if (!ev) continue;
      const a0 = ev.args.amount0, a1 = ev.args.amount1;
      // amounts are the swapper's deltas: positive = received from the pool
      const coinDelta = S.buyIsZeroForOne ? a1 : a0;
      const hypeDelta = S.buyIsZeroForOne ? a0 : a1;
      const buy = coinDelta > 0n;
      const h = f18(hypeDelta < 0n ? -hypeDelta : hypeDelta);
      const t = tokF(coinDelta < 0n ? -coinDelta : coinDelta);
      if (!(t > 0)) continue;
      fresh.push({ buy, eth: h, tok: t, price: h / t, block: l.blockNumber, idx: l.index ?? l.logIndex ?? 0, tx: l.transactionHash });
    }
    const seen = new Set(S.trades.map((t) => t.tx + ":" + t.idx));
    S.trades = [...fresh.filter((t) => !seen.has(t.tx + ":" + t.idx)), ...S.trades].sort((a, b) => b.block - a.block || b.idx - a.idx);
    const need = [...new Set(S.trades.slice(0, 40).filter((t) => !t.time).map((t) => t.block))];
    const times = {};
    await Promise.all(need.map(async (n) => { const b = await rp.getBlock(n).catch(() => null); if (b) times[n] = b.timestamp * 1000; }));
    for (const t of S.trades) if (!t.time && times[t.block]) t.time = times[t.block];
    renderAll();
  }

  async function refreshBalances() {
    if (!W.address) { S.myHype = S.myTok = null; renderTrade(); return; }
    try {
      const rp = readProvider(chain);
      const token = new ethers.Contract(address, CFG.tokenAbi, rp);
      [S.myHype, S.myTok] = await Promise.all([rp.getBalance(W.address), token.balanceOf(W.address)]);
    } catch (_) { S.myHype = S.myTok = null; }
    renderTrade();
  }

  // ── render ─────────────────────────────────────────────────
  function renderAll() { renderStats(); renderChart(); renderTrades(); renderTrade(); }

  function renderStats() {
    const p = S.priceHype;
    $("stMcap").textContent = p ? fmtMcap(p) : "—";
    $("stMcapEth").textContent = p && S.usd ? hype(p * S.supply) : "";
    $("stPrice").textContent = p ? (S.usd ? usd(p * S.usd) : hype(p)) : "—";
    $("stPriceEth").textContent = p && S.usd ? small(p) + " HYPE" : "";
    $("stSupply").textContent = compact(S.supply);
    $("stTax").textContent = S.feePct == null ? "—" : S.feePct + "%";
    $("stFee").textContent = S.feePct == null ? "" : WINDOW_LABEL(S.window);
  }

  let hoverIdx = null;
  function renderChart() {
    const pts = S.trades.slice().reverse().map((t) => ({ p: t.price, time: t.time }));
    const now = S.priceHype;
    if (now) pts.push({ p: now, time: Date.now(), live: true });
    const el = $("chart");
    if (pts.length < 2) {
      el.innerHTML = `<div class="chart-empty">No trades yet — be the first to buy.</div>`;
      $("chVal").textContent = now ? fmtMcap(now) : "—";
      $("chDelta").textContent = ""; $("chNote").textContent = "";
      return;
    }
    const W0 = 640, H0 = 240, pad = 8;
    const vals = pts.map((x) => mcapOf(x.p));
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi === lo) { hi *= 1.05; lo *= 0.95; }
    const X = (i) => pad + (i / (pts.length - 1)) * (W0 - pad * 2);
    const Y = (v) => pad + (1 - (v - lo) / (hi - lo)) * (H0 - pad * 2);
    const line = vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
    const up = vals[vals.length - 1] >= vals[0];
    const col = up ? "var(--accent)" : "var(--bad)";
    el.innerHTML = `
      <svg viewBox="0 0 ${W0} ${H0}" preserveAspectRatio="none" class="chart-svg">
        <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${up ? "#befd08" : "#ff5c5c"}" stop-opacity=".28"/><stop offset="1" stop-color="${up ? "#befd08" : "#ff5c5c"}" stop-opacity="0"/></linearGradient></defs>
        <polygon points="${X(0)},${H0} ${line} ${X(vals.length - 1)},${H0}" fill="url(#cg)"/>
        <polyline points="${line}" fill="none" stroke="${col}" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
        <line id="chX" x1="0" x2="0" y1="0" y2="${H0}" stroke="rgba(255,255,255,.25)" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" style="display:none"/>
      </svg>
      <div class="chart-dot" id="chDot" style="color:${col}"></div>
      <div class="chart-y"><span>${S.usd ? usd(hi) : hype(hi)}</span><span>${S.usd ? usd(lo) : hype(lo)}</span></div>`;
    const show = (i) => {
      const v = vals[i], pt = pts[i];
      $("chVal").textContent = S.usd ? usd(v) : hype(v);
      const d = ((v - vals[0]) / vals[0]) * 100;
      $("chDelta").textContent = (d >= 0 ? "▲ " : "▼ ") + Math.abs(d).toFixed(2) + "%";
      $("chDelta").className = "delta " + (d >= 0 ? "up" : "down");
      $("chNote").textContent = pt.live ? "now" : pt.time ? ago(pt.time) : `trade ${i + 1} of ${pts.length - 1}`;
      const dot = $("chDot");
      dot.style.left = (X(i) / W0) * 100 + "%";
      dot.style.top = (Y(v) / H0) * 100 + "%";
    };
    show(hoverIdx != null && hoverIdx < pts.length ? hoverIdx : pts.length - 1);
    const svg = el.querySelector("svg");
    const move = (e) => {
      const r = svg.getBoundingClientRect();
      const x = ((("touches" in e ? e.touches[0].clientX : e.clientX) - r.left) / r.width) * W0;
      const i = Math.max(0, Math.min(pts.length - 1, Math.round(((x - pad) / (W0 - pad * 2)) * (pts.length - 1))));
      hoverIdx = i; show(i);
      const xl = svg.querySelector("#chX"); xl.style.display = ""; xl.setAttribute("x1", X(i)); xl.setAttribute("x2", X(i));
    };
    const leave = () => { hoverIdx = null; show(pts.length - 1); svg.querySelector("#chX").style.display = "none"; };
    svg.addEventListener("mousemove", move); svg.addEventListener("touchmove", move, { passive: true });
    svg.addEventListener("mouseleave", leave); svg.addEventListener("touchend", leave);
  }

  function renderTrades() {
    const el = $("txs");
    if (!S.trades.length) { el.innerHTML = '<div class="empty">No trades yet.</div>'; return; }
    el.innerHTML = `<div class="txrow txhead"><span>Type</span><span>HYPE</span><span>${esc(S.symbol)}</span><span>Tx</span><span>Time</span></div>` +
      S.trades.slice(0, 40).map((t) => `
        <a class="txrow" href="${chain.txUrl(t.tx)}" target="_blank" rel="noopener">
          <span class="${t.buy ? "buy" : "sell"}">${t.buy ? "Buy" : "Sell"}</span>
          <span class="mono">${num(t.eth, 5)}</span>
          <span class="mono">${compact(t.tok)}</span>
          <span class="mono">${short(t.tx)}</span>
          <span class="muted">${t.time ? ago(t.time) : "—"}</span>
        </a>`).join("");
  }

  // ── trade box ──────────────────────────────────────────────
  function amountWei() {
    const v = $("amt").value.trim();
    if (!v || !(Number(v) > 0)) return 0n;
    try { return ethers.parseUnits(v, S.side === "buy" ? 18 : S.decimals); } catch (_) { return 0n; }
  }
  const zeroForOne = () => (S.side === "buy" ? S.buyIsZeroForOne : !S.buyIsZeroForOne);

  // exact quote from Montra's router (it returns what swapExactIn would pay)
  let quoteTimer = null;
  function requestQuote() {
    clearTimeout(quoteTimer);
    const inWei = amountWei();
    const tag = S.side + ":" + inWei;
    if (inWei === 0n || !S.key) { S.quote = null; S.quoteFor = tag; return renderTrade(); }
    quoteTimer = setTimeout(async () => {
      try {
        const r = new ethers.Contract(chain.router, CFG.routerAbi, readProvider(chain));
        const out = await r.quoteExactIn.staticCall(S.key, zeroForOne(), inWei);
        if (S.side + ":" + amountWei() === tag) { S.quote = out; S.quoteFor = tag; renderTrade(); }
      } catch (e) { console.warn("quote failed", e); S.quote = null; S.quoteFor = tag; renderTrade(); }
    }, 250);
  }

  function renderTrade() {
    const buy = S.side === "buy";
    $("seg").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.s === S.side));
    $("amtLbl").textContent = buy ? "You pay" : "You sell";
    $("amtUnit").textContent = buy ? "HYPE" : S.symbol || "TOKEN";
    const bal = buy ? S.myHype : S.myTok;
    $("balLbl").textContent = bal == null ? "" : "Balance: " + (buy ? num(f18(bal), 5) + " HYPE" : compact(tokF(bal)) + " " + S.symbol);
    const chips = buy ? ["0.1", "0.5", "1", "5"] : ["25%", "50%", "75%", "Max"];
    const ck = chips.join();
    if ($("qChips").dataset.k !== ck) {
      $("qChips").dataset.k = ck;
      $("qChips").innerHTML = chips.map((c) => `<button type="button" data-v="${c}">${c}</button>`).join("");
      $("qChips").querySelectorAll("button").forEach((b) => (b.onclick = () => {
        const v = b.dataset.v;
        if (v.endsWith("%") || v === "Max") {
          if (S.myTok == null) return;
          const pct = v === "Max" ? 100n : BigInt(parseInt(v));
          $("amt").value = ethers.formatUnits((S.myTok * pct) / 100n, S.decimals);
        } else $("amt").value = v;
        requestQuote();
      }));
    }
    const inWei = amountWei();
    const fresh = S.quoteFor === S.side + ":" + inWei;
    const q = fresh ? S.quote : null;
    let outF = null, impact = null;
    if (q != null && inWei > 0n) {
      outF = buy ? tokF(q) : f18(q);
      const inF = buy ? f18(inWei) : tokF(inWei);
      if (S.priceHype) impact = buy ? (inF / outF) / S.priceHype - 1 : 1 - (outF / inF) / S.priceHype;
    }
    $("qOut").textContent = inWei === 0n ? "—" : !fresh ? "…" : outF == null ? "—" : buy ? compact(outF) + " " + S.symbol : hype(outF);
    $("qImpact").textContent = impact == null ? "—" : (Math.max(0, impact) * 100).toFixed(2) + "%";
    $("qImpact").className = impact != null && impact > 0.05 ? "warn" : "";
    $("qFees").textContent = S.feePct == null ? "—" : S.feePct + "% Montra fee";

    const btn = $("tradeBtn");
    btn.classList.toggle("sellbtn", !buy);
    let label, disabled = false;
    if (!S.key) { label = "Pool not found"; disabled = true; }
    else if (!W.address) label = "Connect wallet";
    else if (W.chainId !== chain.chainId) label = "Switch to " + chain.name;
    else if (inWei === 0n) { label = "Enter an amount"; disabled = true; }
    else if (bal != null && inWei > bal) { label = "Insufficient balance"; disabled = true; }
    else if (!fresh || q == null) { label = fresh ? "No quote" : "Getting quote…"; disabled = true; }
    else label = (buy ? "Buy $" : "Sell $") + S.symbol;
    btn.textContent = S.busy ? "Confirm in wallet…" : label;
    btn.disabled = disabled || S.busy;
  }

  const setStatus = (m, c = "") => { const s = $("tradeStatus"); s.className = "status " + c; s.innerHTML = m; };
  function tradeError(e) {
    if (e.code === "ACTION_REJECTED" || e.code === 4001) return "You rejected the transaction.";
    if (/insufficient funds/i.test(e.message || "")) return "Not enough HYPE for the amount plus gas.";
    if (/slippage|minOut|too little|INSUFFICIENT_OUTPUT/i.test((e.shortMessage || "") + (e.reason || "") + (e.message || ""))) return "Price moved past your slippage limit. Try again or raise slippage.";
    return e.shortMessage || e.reason || e.message || String(e);
  }

  async function trade() {
    if (!W.address) return W.connect();
    if (W.chainId !== chain.chainId) { await W.switchChain(chain).catch(() => {}); return renderTrade(); }
    const inWei = amountWei();
    if (inWei === 0n || !S.key) return;
    const slip = BigInt($("slip").value);
    S.busy = true; renderTrade(); setStatus("");
    try {
      const signer = await new ethers.BrowserProvider(W.provider).getSigner();
      const router = new ethers.Contract(chain.router, CFG.routerAbi, signer);
      const buy = S.side === "buy";
      if (!buy) {
        const tk = new ethers.Contract(address, CFG.tokenAbi, signer);
        if ((await tk.allowance(W.address, chain.router)) < inWei) {
          setStatus(`One-time approval so Montra's router can sell your $${esc(S.symbol)}…`);
          await (await tk.approve(chain.router, ethers.MaxUint256)).wait();
        }
      }
      const est = await router.quoteExactIn.staticCall(S.key, zeroForOne(), inWei);
      const params = { key: S.key, zeroForOne: zeroForOne(), amountIn: inWei, minOut: (est * (BPS - slip)) / BPS,
        recipient: W.address, deadline: BigInt(Math.floor(Date.now() / 1000) + 600) };
      const tx = await router.swapExactIn(params, { value: buy ? inWei : 0n });
      setStatus(`Waiting for confirmation… <a href="${chain.txUrl(tx.hash)}" target="_blank" rel="noopener">view tx ↗</a>`);
      const rc = await tx.wait();
      if (rc.status !== 1) throw new Error("Transaction reverted.");
      setStatus(`✅ ${buy ? "Bought" : "Sold"} $${esc(S.symbol)}. <a href="${chain.txUrl(tx.hash)}" target="_blank" rel="noopener">view tx ↗</a>`, "ok");
      $("amt").value = ""; S.quote = null;
      await Promise.all([refreshPrice(), refreshBalances()]);
      refreshTrades();
    } catch (e) {
      console.error(e);
      setStatus(esc(tradeError(e)), "err");
    } finally {
      S.busy = false; renderAll();
    }
  }

  $("seg").querySelectorAll("button").forEach((b) => (b.onclick = () => { S.side = b.dataset.s; $("amt").value = ""; S.quote = null; setStatus(""); renderTrade(); }));
  $("amt").addEventListener("input", requestQuote);
  $("slip").addEventListener("change", renderTrade);
  $("tradeBtn").onclick = trade;
  W.onChange(() => { refreshBalances(); });

  if (!window.ethers) return fail("Couldn't load the blockchain library. Check your connection and refresh.");
  load();
})();
