// Token page: live chart, market cap, holders, trades, and buy/sell on the Pons V2 curve.
(function () {
  const { CFG, W, Feed, Store, logoSVG, tokenImg, isOfficialToken, OFFICIAL_LOGO, readProvider, esc, ago, short } = window.SCOTY;
  const $ = (id) => document.getElementById(id);
  const chain = CFG.chains[0];
  const api = chain.explorerApi;
  const BPS = 10000n;
  const ZERO = "0x0000000000000000000000000000000000000000";
  const address = new URLSearchParams(location.search).get("address") || "";

  const S = {
    curve: null, phase: 0, graduated: false, creator: null, symbol: "", name: "", decimals: 18, supply: 1e9,
    q: 0n, t: 0n, sellable: 0n, raised: 0n, threshold: 0n, feeBps: 0n, taxBps: 0n,
    ethUsd: 0, trades: [], myEth: null, myTok: null, side: "buy", busy: false,
  };

  // ── formatting ─────────────────────────────────────────────
  const num = (x, d = 2) => x.toLocaleString("en-US", { maximumFractionDigits: d });
  function compact(x) {
    const a = Math.abs(x);
    if (a >= 1e9) return num(x / 1e9, 2) + "B";
    if (a >= 1e6) return num(x / 1e6, 2) + "M";
    if (a >= 1e3) return num(x / 1e3, 2) + "K";
    return num(x, a < 1 ? 4 : 2);
  }
  function small(x) { // tiny prices: keep 3 significant digits
    if (x === 0) return "0";
    if (x >= 1) return num(x, 4);
    const z = Math.max(0, Math.floor(-Math.log10(x)));
    return x.toFixed(Math.min(18, z + 3));
  }
  const usd = (x) => (x >= 1 ? "$" + compact(x) : "$" + small(x));
  const eth = (x) => (x >= 0.0001 || x === 0 ? num(x, 6) : x.toExponential(2)) + " ETH";
  const f18 = (w) => Number(ethers.formatUnits(w, 18));
  const tokF = (w) => Number(ethers.formatUnits(w, S.decimals));
  const priceEth = () => (S.t > 0n ? Number(S.q) / Number(S.t) : 0);
  const mcapOf = (p) => (S.ethUsd ? p * S.supply * S.ethUsd : p * S.supply);
  const fmtMcap = (p) => (S.ethUsd ? usd(mcapOf(p)) : eth(p * S.supply));

  async function getJSON(url) { return Feed.getJSON(url); }

  // ── load ───────────────────────────────────────────────────
  async function load() {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return fail("Token not found.");
    const rp = readProvider(chain);
    const factory = new ethers.Contract(chain.factory, CFG.factoryAbi, rp);
    const token = new ethers.Contract(address, CFG.tokenAbi, rp);
    let lt;
    try {
      [lt, S.name, S.symbol, S.decimals] = await Promise.all([
        factory.getLaunchedToken(address), token.name(), token.symbol(), token.decimals().then(Number).catch(() => 18),
      ]);
    } catch (e) {
      console.warn(e);
      const local = Store.all().find((t) => t.address && t.address.toLowerCase() === address.toLowerCase());
      if (local && local.demo) return fail("This is a demo launch, so there is nothing to trade.");
      return fail("Couldn't load this token from Robinhood Chain. Check your connection and refresh.");
    }
    if (!lt.exists) return fail("This token wasn't launched on Pons.");
    S.curve = lt.curve;
    S.phase = Number(lt.phase);
    S.creator = lt.creatorFeeRecipient && lt.creatorFeeRecipient !== ZERO ? lt.creatorFeeRecipient : lt.deployer;
    S.taxBps = BigInt(lt.creatorTaxBps);

    const [info, supply] = await Promise.all([token.getTokenInfo().catch(() => null), token.totalSupply().catch(() => 10n ** 27n)]);
    S.supply = tokF(supply);
    renderHead(info);
    $("tkMsg").hidden = true;
    $("tk").hidden = false;
    document.title = `${S.name} ($${S.symbol}) — SCOTY`;

    await Promise.all([refreshCurve(), refreshMeta(), refreshTrades(), refreshBalances()]);
    setInterval(() => { refreshCurve().then(renderAll); refreshTrades(); }, 15000);
  }
  function fail(msg) { $("tkMsg").textContent = msg; }

  function renderHead(info) {
    const logo = info && Feed.safeImg(info.tokenLogo);
    $("tkLogo").innerHTML = isOfficialToken(address) ? `<img src="${OFFICIAL_LOGO}" alt="">`
      : logo ? tokenImg(logo, { symbol: S.symbol, name: S.name }) : logoSVG(S.symbol + S.name, S.symbol);
    $("tkName").textContent = S.name;
    $("tkSym").textContent = "$" + S.symbol;
    const links = [];
    const soc = info && info.tokenSocials;
    if (soc && /^https:\/\//.test(soc.twitter)) links.push(`<a class="btn btn-sm" href="${esc(soc.twitter)}" target="_blank" rel="noopener">X ↗</a>`);
    if (soc && /^https:\/\//.test(soc.website)) links.push(`<a class="btn btn-sm" href="${esc(soc.website)}" target="_blank" rel="noopener">Website ↗</a>`);
    links.push(`<button class="btn btn-sm" id="copyCa" type="button">Copy CA</button>`);
    $("tkLinks").innerHTML = links.join("");
    $("copyCa").onclick = (e) => { navigator.clipboard?.writeText(address); e.target.textContent = "Copied!"; setTimeout(() => (e.target.textContent = "Copy CA"), 1200); };

    $("about").hidden = false;
    $("tkDesc").textContent = (info && info.tokenDescription) || "Launched on SCOTY.";
    $("tkAddr").textContent = short(address); $("tkAddr").href = `${chain.explorer}/token/${address}`;
    $("tkCreator").textContent = short(S.creator); $("tkCreator").href = "profile.html?address=" + S.creator;
    $("tkCurve").textContent = short(S.curve); $("tkCurve").href = `${chain.explorer}/address/${S.curve}`;
  }

  async function refreshCurve() {
    const c = new ethers.Contract(S.curve, CFG.curveAbi, readProvider(chain));
    try {
      const [res, sellable, raised, threshold, feeBps, taxBps, graduated] = await Promise.all([
        c.getReserves(), c.sellableTokens(), c.realQuoteReserve(), c.graduationThreshold(),
        c.feeBps(), c.creatorTaxBps().catch(() => S.taxBps), c.graduated().catch(() => false),
      ]);
      S.q = res[0]; S.t = res[1]; S.sellable = sellable; S.raised = raised; S.threshold = threshold;
      S.feeBps = BigInt(feeBps); S.taxBps = BigInt(taxBps); S.graduated = graduated || S.phase > 0;
    } catch (e) { console.warn("curve read failed", e); }
  }

  async function refreshMeta() {
    const [stats, tok] = await Promise.all([getJSON(`${api}/stats`).catch(() => ({})), getJSON(`${api}/tokens/${address}`).catch(() => ({}))]);
    S.ethUsd = Number(stats.coin_price || 0);
    S.holders = Number(tok.holders_count || tok.holders || 0);
    renderAll();
  }

  // trades from the curve's CurveBuy / CurveSell events (Blockscout logs, newest first)
  async function refreshTrades() {
    const iface = new ethers.Interface(CFG.curveAbi);
    const out = [];
    let params = "";
    try {
      for (let page = 0; page < 8; page++) {
        const data = await getJSON(`${api}/addresses/${S.curve}/logs${params}`);
        for (const l of data.items || []) {
          let ev;
          try { ev = iface.parseLog({ topics: (l.topics || []).filter(Boolean), data: l.data }); } catch (_) { continue; }
          if (!ev || (ev.name !== "CurveBuy" && ev.name !== "CurveSell")) continue;
          const buy = ev.name === "CurveBuy";
          const ethAmt = f18(buy ? ev.args.quoteIn : ev.args.quoteOut);
          const tokAmt = tokF(buy ? ev.args.tokensOut : ev.args.tokensIn);
          if (!(tokAmt > 0)) continue;
          out.push({ buy, eth: ethAmt, tok: tokAmt, price: ethAmt / tokAmt, who: buy ? ev.args.recipient : ev.args.seller,
            block: Number(l.block_number), idx: Number(l.index || 0), tx: l.transaction_hash || l.tx_hash });
        }
        if (!data.next_page_params) break;
        params = "?" + new URLSearchParams(data.next_page_params).toString();
      }
    } catch (e) { console.warn("trades unavailable", e); }
    out.sort((a, b) => b.block - a.block || b.idx - a.idx);
    // timestamps for the newest trades
    const blocks = [...new Set(out.slice(0, 40).map((t) => t.block))];
    const times = {};
    await Promise.all(blocks.map(async (n) => {
      const b = await getJSON(`${api}/blocks/${n}`).catch(() => null);
      if (b && b.timestamp) times[n] = Date.parse(b.timestamp);
    }));
    for (const t of out) t.time = times[t.block] || null;
    S.trades = out;
    renderAll();
  }

  async function refreshBalances() {
    if (!W.address) { S.myEth = S.myTok = null; renderTrade(); return; }
    try {
      const rp = readProvider(chain);
      const token = new ethers.Contract(address, CFG.tokenAbi, rp);
      [S.myEth, S.myTok] = await Promise.all([rp.getBalance(W.address), token.balanceOf(W.address)]);
    } catch (_) { S.myEth = S.myTok = null; }
    renderTrade();
  }

  // ── render ─────────────────────────────────────────────────
  function renderAll() { renderStats(); renderChart(); renderTrades(); renderTrade(); }

  function renderStats() {
    const p = priceEth();
    $("stMcap").textContent = p ? fmtMcap(p) : "—";
    $("stMcapEth").textContent = p && S.ethUsd ? eth(p * S.supply) : "";
    $("stPrice").textContent = p ? (S.ethUsd ? usd(p * S.ethUsd) : eth(p)) : "—";
    $("stPriceEth").textContent = p && S.ethUsd ? small(p) + " ETH" : "";
    $("stHolders").textContent = S.holders ? num(S.holders, 0) : "—";
    $("stTax").textContent = (Number(S.taxBps) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 }) + "%";
    $("stFee").textContent = S.feeBps ? "+ " + Number(S.feeBps) / 100 + "% protocol" : "";
    const pg = S.threshold > 0n ? Math.min(100, (Number(S.raised) / Number(S.threshold)) * 100) : 0;
    $("pgPct").textContent = (S.graduated ? 100 : pg).toFixed(pg < 10 ? 2 : 1) + "%";
    $("pgFill").style.width = (S.graduated ? 100 : pg) + "%";
    $("pgNote").textContent = S.graduated
      ? "Graduated: this token now trades in its Uniswap v4 pool with permanently locked liquidity."
      : `${eth(f18(S.raised))} of ${eth(f18(S.threshold))} raised. When the curve fills, the token graduates into a Uniswap v4 pool with permanently locked liquidity.`;
    $("tkPhase").textContent = S.graduated ? "Graduated" : "On curve";
    $("tkPhase").classList.toggle("grad", S.graduated);
  }

  let hoverIdx = null;
  function renderChart() {
    const pts = S.trades.slice().reverse().map((t) => ({ p: t.price, time: t.time }));
    const now = priceEth();
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
      <div class="chart-y"><span>${S.ethUsd ? usd(hi) : eth(hi)}</span><span>${S.ethUsd ? usd(lo) : eth(lo)}</span></div>`;
    const show = (i) => {
      const v = vals[i], pt = pts[i];
      $("chVal").textContent = S.ethUsd ? usd(v) : eth(v);
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
    el.innerHTML = `<div class="txrow txhead"><span>Type</span><span>ETH</span><span>${esc(S.symbol)}</span><span>Wallet</span><span>Time</span></div>` +
      S.trades.slice(0, 40).map((t) => `
        <a class="txrow" href="${chain.explorer}/tx/${esc(t.tx)}" target="_blank" rel="noopener">
          <span class="${t.buy ? "buy" : "sell"}">${t.buy ? "Buy" : "Sell"}</span>
          <span class="mono">${num(t.eth, 5)}</span>
          <span class="mono">${compact(t.tok)}</span>
          <span class="mono">${short(t.who)}</span>
          <span class="muted">${t.time ? ago(t.time) : "—"}</span>
        </a>`).join("");
  }

  // ── trade box ──────────────────────────────────────────────
  function amountWei() {
    const v = $("amt").value.trim();
    if (!v || !(Number(v) > 0)) return 0n;
    try { return ethers.parseUnits(v, S.side === "buy" ? 18 : S.decimals); } catch (_) { return 0n; }
  }
  function quote(inWei) {
    if (inWei <= 0n || S.t === 0n) return null;
    const fee = S.feeBps, tax = S.taxBps;
    if (S.side === "buy") {
      const net = inWei - (inWei * fee) / BPS - (inWei * tax) / BPS;
      if (net <= 0n) return null;
      let out = (net * S.t) / (S.q + net);
      if (S.sellable > 0n && out > S.sellable) out = S.sellable;
      const exec = Number(net) / Number(out), spot = Number(S.q) / Number(S.t);
      return { out, outF: tokF(out), impact: exec / spot - 1, fees: f18(inWei - net) };
    }
    const gross = (inWei * S.q) / (S.t + inWei);
    const net = (gross * (BPS - fee - tax)) / BPS;
    const spotVal = Number(inWei) * (Number(S.q) / Number(S.t));
    return { out: net, outF: f18(net), impact: 1 - Number(gross) / spotVal, fees: f18(gross - net) };
  }

  function renderTrade() {
    const buy = S.side === "buy";
    $("seg").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.s === S.side));
    $("amtLbl").textContent = buy ? "You pay" : "You sell";
    $("amtUnit").textContent = buy ? "ETH" : S.symbol || "TOKEN";
    const bal = buy ? S.myEth : S.myTok;
    $("balLbl").textContent = bal == null ? "" : "Balance: " + (buy ? num(f18(bal), 5) + " ETH" : compact(tokF(bal)) + " " + S.symbol);
    const chips = buy ? ["0.01", "0.05", "0.1", "0.5"] : ["25%", "50%", "75%", "Max"];
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
        renderTrade();
      }));
    }
    const inWei = amountWei();
    const q = quote(inWei);
    $("qOut").textContent = q ? (buy ? compact(q.outF) + " " + S.symbol : eth(q.outF)) : "—";
    $("qImpact").textContent = q ? (q.impact * 100).toFixed(2) + "%" : "—";
    $("qImpact").className = q && q.impact > 0.05 ? "warn" : "";
    $("qFees").textContent = q ? eth(q.fees) : "—";

    const btn = $("tradeBtn");
    btn.classList.toggle("sellbtn", !buy);
    let label, disabled = false;
    if (S.graduated) { label = "Graduated — trade on Uniswap v4"; disabled = true; }
    else if (!W.address) label = "Connect wallet";
    else if (W.chainId !== chain.chainId) label = "Switch to " + chain.name;
    else if (inWei === 0n) { label = "Enter an amount"; disabled = true; }
    else if (bal != null && inWei > bal) { label = "Insufficient balance"; disabled = true; }
    else label = (buy ? "Buy $" : "Sell $") + S.symbol;
    btn.textContent = S.busy ? "Confirm in wallet…" : label;
    btn.disabled = disabled || S.busy;
  }

  const setStatus = (m, c = "") => { const s = $("tradeStatus"); s.className = "status " + c; s.innerHTML = m; };
  const MSG = {
    SlippageExceeded: "Price moved past your slippage limit. Try again or raise slippage.",
    CurveGraduated: "This token has graduated. Trade it on Uniswap v4.",
    NativeValueMismatch: "ETH sent did not match the amount. Try again.",
    InsufficientOutputAmount: "Amount too small.",
    InsufficientLiquidity: "Not enough liquidity on the curve for that trade.",
  };
  function tradeError(e) {
    if (e.code === "ACTION_REJECTED" || e.code === 4001) return "You rejected the transaction.";
    const n = e.revert && e.revert.name;
    if (n) return MSG[n] || "Pons reverted with " + n + ".";
    if (/insufficient funds/i.test(e.message || "")) return "Not enough ETH for the amount plus gas.";
    return e.shortMessage || e.reason || e.message || String(e);
  }

  async function trade() {
    if (!W.address) return W.connect();
    if (W.chainId !== chain.chainId) { await W.switchChain(chain).catch(() => {}); return renderTrade(); }
    const inWei = amountWei();
    if (inWei === 0n) return;
    const slip = BigInt($("slip").value);
    S.busy = true; renderTrade(); setStatus("");
    try {
      const signer = await new ethers.BrowserProvider(W.provider).getSigner();
      const c = new ethers.Contract(S.curve, [...CFG.curveAbi, ...CFG.ponsErrors], signer);
      let tx;
      if (S.side === "buy") {
        const est = await c.buy.staticCall(inWei, 0, W.address, { value: inWei });
        tx = await c.buy(inWei, (est * (BPS - slip)) / BPS, W.address, { value: inWei });
      } else {
        const tk = new ethers.Contract(address, CFG.tokenAbi, signer);
        if ((await tk.allowance(W.address, S.curve)) < inWei) {
          setStatus(`One-time approval so the curve can take your $${esc(S.symbol)} when you sell…`);
          await (await tk.approve(S.curve, ethers.MaxUint256)).wait();
        }
        const est = await c.sell.staticCall(inWei, 0, W.address);
        tx = await c.sell(inWei, (est * (BPS - slip)) / BPS, W.address);
      }
      setStatus(`Waiting for confirmation… <a href="${chain.explorer}/tx/${tx.hash}" target="_blank" rel="noopener">view tx ↗</a>`);
      const rc = await tx.wait();
      if (rc.status !== 1) throw new Error("Transaction reverted.");
      setStatus(`✅ ${S.side === "buy" ? "Bought" : "Sold"} $${esc(S.symbol)}. <a href="${chain.explorer}/tx/${tx.hash}" target="_blank" rel="noopener">view tx ↗</a>`, "ok");
      $("amt").value = "";
      await Promise.all([refreshCurve(), refreshBalances()]);
      refreshTrades();
    } catch (e) {
      console.error(e);
      setStatus(esc(tradeError(e)), "err");
    } finally {
      S.busy = false; renderAll();
    }
  }

  $("seg").querySelectorAll("button").forEach((b) => (b.onclick = () => { S.side = b.dataset.s; $("amt").value = ""; setStatus(""); renderTrade(); }));
  $("amt").addEventListener("input", renderTrade);
  $("slip").addEventListener("change", renderTrade);
  $("tradeBtn").onclick = trade;
  W.onChange(() => { refreshBalances(); });

  if (!window.ethers) return fail("Couldn't load the blockchain library. Check your connection and refresh.");
  load();
})();
