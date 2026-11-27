// Leverage page: long/short Hyperliquid perps from SCOTY.
(function () {
  const { W, esc } = window.SCOTY;
  const HL = window.SCOTY_HL;
  const $ = (id) => document.getElementById(id);
  const QUICK = ["HYPE", "BTC", "ETH", "SOL", "XRP", "DOGE"];
  const TAKER = 0.00045; // Hyperliquid base taker fee

  const S = {
    markets: [], byCoin: new Map(), coin: null, side: "long", mode: "cross", lev: 10, tf: "1h",
    user: null, agent: null, account: null, spotUsdc: 0, positions: [], mids: {}, candles: [], busy: false,
  };

  // ── formatting ──
  const num = (x) => (x == null || x === "" ? NaN : Number(x));
  function fmtPx(p) {
    p = num(p); if (!isFinite(p)) return "—";
    const a = Math.abs(p);
    const d = a >= 10000 ? 1 : a >= 1000 ? 2 : a >= 10 ? 3 : a >= 1 ? 4 : a >= 0.01 ? 5 : 8;
    return p.toLocaleString("en-US", { minimumFractionDigits: Math.min(d, 2), maximumFractionDigits: d });
  }
  function usd(n, d = 2) { n = num(n); return isFinite(n) ? (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—"; }
  function compact(n) { n = num(n); if (!isFinite(n)) return "—"; const a = Math.abs(n); return a >= 1e9 ? "$" + (n / 1e9).toFixed(2) + "B" : a >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M" : a >= 1e3 ? "$" + (n / 1e3).toFixed(1) + "K" : usd(n); }
  const pct = (x, d = 2) => (x >= 0 ? "+" : "") + (x * 100).toFixed(d) + "%";
  const setStatus = (msg, cls = "") => { const el = $("status"); el.className = "status " + cls; el.innerHTML = msg; };

  // ── markets ──
  async function loadMarkets() {
    const [meta, ctxs] = await HL.meta();
    S.markets = meta.universe.map((u, i) => ({ ...u, asset: i, ctx: ctxs[i] || {} })).filter((m) => !m.isDelisted);
    S.byCoin = new Map(S.markets.map((m) => [m.name, m]));
    for (const m of S.markets) S.mids[m.name] = num(m.ctx.midPx || m.ctx.markPx);
  }
  const market = () => S.byCoin.get(S.coin);

  function renderQuick() {
    $("quick").innerHTML = QUICK.filter((c) => S.byCoin.has(c)).map((c) => `<button type="button" data-c="${c}" class="${c === S.coin ? "on" : ""}">${c}</button>`).join("");
    $("quick").querySelectorAll("button").forEach((b) => (b.onclick = () => pick(b.dataset.c)));
  }
  function renderList() {
    const q = $("coinSearch").value.trim().toUpperCase();
    const rows = S.markets
      .filter((m) => !q || m.name.toUpperCase().includes(q))
      .sort((a, b) => num(b.ctx.dayNtlVlm) - num(a.ctx.dayNtlVlm))
      .slice(0, 80)
      .map((m) => {
        const prev = num(m.ctx.prevDayPx), px = S.mids[m.name] || num(m.ctx.markPx), ch = prev ? px / prev - 1 : 0;
        return `<button type="button" data-c="${esc(m.name)}"><b>${esc(m.name)}</b><span class="pill-s">${m.maxLeverage}x</span><span class="mono">${fmtPx(px)}</span><span class="mono ${ch >= 0 ? "up" : "down"}">${pct(ch)}</span></button>`;
      });
    $("coinList").innerHTML = rows.join("") || '<div class="empty">No market found</div>';
    $("coinList").querySelectorAll("button").forEach((b) => (b.onclick = () => { pick(b.dataset.c); toggleDrop(false); }));
  }
  function toggleDrop(open) {
    $("coinDrop").hidden = !open;
    if (open) { $("coinSearch").value = ""; renderList(); $("coinSearch").focus(); }
  }

  function pick(coin) {
    if (!S.byCoin.has(coin)) return;
    S.coin = coin;
    try { history.replaceState(null, "", "?coin=" + encodeURIComponent(coin)); } catch (_) {}
    try { localStorage.setItem("scoty.lev.coin", coin); } catch (_) {}
    const m = market();
    $("coinSym").textContent = coin + "-USD";
    $("coinMax").textContent = "up to " + m.maxLeverage + "x";
    $("lev").max = m.maxLeverage;
    if (S.lev > m.maxLeverage) S.lev = m.maxLeverage;
    $("lev").value = S.lev;
    const ticks = [1, ...[0.25, 0.5, 0.75].map((f) => Math.max(2, Math.round(m.maxLeverage * f))), m.maxLeverage].filter((v, i, a) => a.indexOf(v) === i);
    $("levTicks").innerHTML = ticks.map((t) => `<button type="button" data-v="${t}">${t}x</button>`).join("");
    $("levTicks").querySelectorAll("button").forEach((b) => (b.onclick = () => setLev(+b.dataset.v)));
    document.title = coin + " Leverage — SCOTY";
    renderQuick(); renderStats(); renderOrder(); loadCandles();
  }

  function renderStats() {
    const m = market(); if (!m) return;
    const c = m.ctx, px = S.mids[m.name] || num(c.markPx), prev = num(c.prevDayPx);
    $("stMark").textContent = fmtPx(num(c.markPx) || px);
    const ch = prev ? px / prev - 1 : 0;
    $("stChg").innerHTML = `<span class="${ch >= 0 ? "up" : "down"}">${pct(ch)} 24h</span>`;
    const f = num(c.funding);
    $("stFund").textContent = isFinite(f) ? pct(f, 4) : "—";
    $("stFundY").textContent = isFinite(f) ? pct(f * 24 * 365, 1) + " / yr" : "";
    $("stOi").textContent = compact(num(c.openInterest) * (num(c.markPx) || px));
    $("stVol").textContent = compact(c.dayNtlVlm);
    $("chVal").textContent = fmtPx(px);
  }

  // ── chart ──
  async function loadCandles() {
    const coin = S.coin, tf = S.tf;
    const span = { "15m": 15 * 60e3 * 120, "1h": 3600e3 * 120, "4h": 4 * 3600e3 * 120, "1d": 86400e3 * 120 }[tf];
    try {
      const c = await HL.candles(coin, tf, Date.now() - span);
      if (coin !== S.coin || tf !== S.tf) return;
      S.candles = (c || []).map((k) => ({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c }));
      drawChart();
    } catch (e) { $("chart").innerHTML = `<div class="chart-empty">Chart unavailable</div>`; }
  }
  function drawChart() {
    const el = $("chart"), K = S.candles;
    if (!K.length) { el.innerHTML = `<div class="chart-empty">No data yet</div>`; return; }
    const live = S.mids[S.coin];
    if (live && K.length) { const k = K[K.length - 1]; k.c = live; k.h = Math.max(k.h, live); k.l = Math.min(k.l, live); }
    const Wd = el.clientWidth || 700, H = el.clientHeight || 260, padR = 70, padY = 12;
    const hi = Math.max(...K.map((k) => k.h)), lo = Math.min(...K.map((k) => k.l)), rng = hi - lo || hi * 0.01 || 1;
    const y = (v) => padY + (hi - v) / rng * (H - 2 * padY);
    const step = (Wd - padR) / K.length, bw = Math.max(1, step * 0.62);
    let body = "";
    K.forEach((k, i) => {
      const x = i * step + step / 2, up = k.c >= k.o, col = up ? "var(--accent)" : "var(--bad)";
      const yo = y(k.o), yc = y(k.c);
      body += `<line x1="${x}" x2="${x}" y1="${y(k.h)}" y2="${y(k.l)}" stroke="${col}" stroke-width="1"/>` +
        `<rect x="${x - bw / 2}" y="${Math.min(yo, yc)}" width="${bw}" height="${Math.max(1, Math.abs(yc - yo))}" fill="${col}" rx="1"/>`;
    });
    const last = K[K.length - 1].c, yl = y(last);
    const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => { const v = hi - f * rng; return `<line x1="0" x2="${Wd - padR}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.05)"/><text x="${Wd - padR + 8}" y="${y(v) + 4}" class="ax">${fmtPx(v)}</text>`; }).join("");
    el.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${Wd} ${H}" preserveAspectRatio="none">${grid}${body}` +
      `<line x1="0" x2="${Wd - padR}" y1="${yl}" y2="${yl}" stroke="rgba(196,181,253,.55)" stroke-dasharray="3 4"/>` +
      `<rect x="${Wd - padR + 2}" y="${yl - 10}" width="${padR - 4}" height="20" rx="5" fill="var(--accent)"/><text x="${Wd - padR + 8}" y="${yl + 4}" class="ax last">${fmtPx(last)}</text></svg>`;
    const first = K[0].o, ch = last / first - 1;
    $("chDelta").textContent = (ch >= 0 ? "▲ " : "▼ ") + Math.abs(ch * 100).toFixed(2) + "%";
    $("chDelta").className = "delta " + (ch >= 0 ? "up" : "down");
  }

  // ── account ──
  async function loadAccount() {
    if (!S.user) return;
    try {
      const [st, sp] = await Promise.all([HL.state(S.user), HL.spot(S.user).catch(() => null)]);
      S.account = st;
      const u = sp?.balances?.find((b) => b.coin === "USDC");
      S.spotUsdc = u ? num(u.total) - num(u.hold || 0) : 0;
      S.positions = (st.assetPositions || []).map((p) => p.position).filter((p) => num(p.szi) !== 0);
    } catch (e) { console.warn("hyperliquid account", e); }
    renderAccount(); renderPositions(); renderOrder();
  }
  const available = () => { const w = num(S.account?.withdrawable); return w > 0 ? w : Math.max(0, S.spotUsdc || 0); };

  function renderAccount() {
    const a = S.account;
    $("acVal").textContent = a ? usd(a.marginSummary?.accountValue) : "—";
    $("acFree").textContent = a ? usd(a.withdrawable) : "—";
    $("acSpot").textContent = S.user ? usd(S.spotUsdc) : "—";
    $("acAgent").innerHTML = !S.user ? "—" : S.agent ? `<span class="ok-t">Enabled</span> · <button class="linkbtn" id="agentOff" type="button">reset</button>` : `<span class="muted">Not enabled</span>`;
    if ($("agentOff")) $("agentOff").onclick = () => { HL.forgetAgent(S.user); S.agent = null; renderAccount(); renderOrder(); };
    $("availLbl").textContent = S.user ? "Available: " + usd(available()) : "";
  }

  function renderPositions() {
    const el = $("positions");
    $("posCount").textContent = S.positions.length ? `(${S.positions.length})` : "";
    if (!S.user) { el.innerHTML = `<div class="empty">Connect your wallet to see your positions.</div>`; return; }
    if (!S.positions.length) { el.innerHTML = `<div class="empty">No open positions.</div>`; return; }
    el.innerHTML = `<div class="pos-row pos-head"><span>Market</span><span>Size</span><span>Entry / Mark</span><span>PnL (ROE)</span><span>Liq. price</span><span></span></div>` +
      S.positions.map((p) => {
        const sz = num(p.szi), long = sz > 0, mark = S.mids[p.coin] || num(p.entryPx), pnl = num(p.unrealizedPnl), roe = num(p.returnOnEquity);
        return `<div class="pos-row">
          <span><b class="${long ? "up" : "down"}">${long ? "Long" : "Short"}</b> ${esc(p.coin)} <span class="pill-s">${p.leverage?.value || "?"}x ${p.leverage?.type === "isolated" ? "iso" : "cross"}</span></span>
          <span class="mono">${Math.abs(sz)} <small class="muted">${usd(p.positionValue)}</small></span>
          <span class="mono">${fmtPx(p.entryPx)} <small class="muted">${fmtPx(mark)}</small></span>
          <span class="mono ${pnl >= 0 ? "up" : "down"}">${usd(pnl)} <small>${isFinite(roe) ? pct(roe) : ""}</small></span>
          <span class="mono">${p.liquidationPx ? fmtPx(p.liquidationPx) : "—"}</span>
          <span><button class="btn btn-sm" type="button" data-close="${esc(p.coin)}">Close</button></span>
        </div>`;
      }).join("");
    el.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => closePos(b.dataset.close, b)));
  }

  // ── order panel ──
  function setLev(v) {
    const m = market(); S.lev = Math.max(1, Math.min(m ? m.maxLeverage : 50, Math.round(v)));
    $("lev").value = S.lev; renderOrder();
  }
  function quote() {
    const m = market(), px = S.mids[S.coin] || num(m?.ctx.markPx), margin = num($("amt").value);
    if (!m || !px || !(margin > 0)) return null;
    const notional = margin * S.lev, sz = HL.roundSz(notional / px, m.szDecimals);
    const mmr = 1 / (2 * m.maxLeverage), long = S.side === "long";
    const liq = long ? px * (1 - (1 / S.lev - mmr)) : px * (1 + (1 / S.lev - mmr));
    return { m, px, margin, notional: sz * px, sz, liq: Math.max(0, liq), fee: sz * px * TAKER };
  }
  function renderOrder() {
    const long = S.side === "long", m = market();
    $("levVal").textContent = S.lev + "x";
    const r = $("lev"); r.style.setProperty("--p", ((S.lev - 1) / Math.max(1, (m?.maxLeverage || 40) - 1)) * 100 + "%");
    $("levTicks").querySelectorAll("button").forEach((b) => b.classList.toggle("on", +b.dataset.v === S.lev));
    const q = quote();
    $("qSize").textContent = q ? `${q.sz} ${S.coin} · ${usd(q.notional)}` : "—";
    $("qEntry").textContent = q ? fmtPx(q.px) : m ? fmtPx(S.mids[S.coin]) : "—";
    $("qLiq").textContent = q ? (S.mode === "isolated" ? fmtPx(q.liq) : "≈ " + fmtPx(q.liq)) : "—";
    $("qFee").textContent = q ? usd(q.fee, 3) : "—";
    const btn = $("goBtn");
    btn.classList.toggle("sellbtn", !long);
    if (S.busy) return;
    btn.disabled = false;
    if (!W.address) btn.textContent = "Connect wallet";
    else if (!S.agent) btn.textContent = "Enable trading";
    else if (!q) { btn.textContent = "Enter margin"; btn.disabled = true; }
    else if (q.notional < 10) { btn.textContent = "Minimum position is $10"; btn.disabled = true; }
    else btn.textContent = `${long ? "Long" : "Short"} ${S.coin} ${S.lev}x`;
  }

  const agentGone = (msg) => /does not exist|not.*(agent|authorized)|unknown.*(agent|signer)|User or API Wallet/i.test(msg || "");
  function friendly(msg) {
    msg = String(msg || "");
    if (/deposit/i.test(msg) && /must|before|first/i.test(msg)) return `Your Hyperliquid account is empty. <a href="https://app.hyperliquid.xyz/portfolio" target="_blank" rel="noopener">Deposit USDC first ↗</a>`;
    if (/insufficient margin|Insufficient/i.test(msg)) return "Not enough margin for this position. Lower the size or leverage, or deposit more USDC.";
    if (/user rejected|denied|4001/i.test(msg)) return "Request rejected in your wallet.";
    if (/could not immediately match/i.test(msg)) return "No liquidity at that price. Try a higher max slippage.";
    return esc(msg.slice(0, 220));
  }

  async function enable() {
    S.busy = true; $("goBtn").disabled = true; $("goBtn").textContent = "Confirm in your wallet…";
    setStatus("Sign once to create a SCOTY trading key. It can only place and close trades on Hyperliquid. It can never withdraw your funds.");
    try {
      S.agent = await HL.approveAgent(W.provider, W.address);
      setStatus("✅ Trading enabled. You can go long or short now.", "ok");
    } catch (e) { setStatus(friendly(e.message || e), "err"); }
    S.busy = false; renderAccount(); renderOrder();
  }

  async function go() {
    if (!W.address) return W.connect();
    if (!S.agent) return enable();
    const q = quote(); if (!q || q.notional < 10) return;
    const long = S.side === "long";
    S.busy = true; const btn = $("goBtn"); btn.disabled = true; btn.textContent = "Placing order…"; setStatus("");
    try {
      await HL.updateLeverage(S.agent, q.m.asset, S.lev, S.mode === "cross");
      const f = await HL.marketOrder(S.agent, { asset: q.m.asset, isBuy: long, sz: q.sz, px: q.px, szDecimals: q.m.szDecimals, slippage: +$("slip").value });
      setStatus(`✅ ${long ? "Long" : "Short"} ${S.coin} ${S.lev}x opened${f.totalSz ? `: ${f.totalSz} ${S.coin} @ ${fmtPx(f.avgPx)}` : ""}.`, "ok");
      $("amt").value = "";
      setTimeout(loadAccount, 600);
    } catch (e) {
      const m = e.message || String(e);
      if (agentGone(m)) { HL.forgetAgent(W.address); S.agent = null; setStatus("Your trading key expired or was replaced. Enable trading again.", "err"); }
      else setStatus(friendly(m), "err");
    }
    S.busy = false; renderAccount(); renderOrder();
  }

  async function closePos(coin, b) {
    const p = S.positions.find((x) => x.coin === coin), m = S.byCoin.get(coin);
    if (!p || !m) return;
    if (!S.agent) return enable();
    const sz = Math.abs(num(p.szi)), isBuy = num(p.szi) < 0, px = S.mids[coin] || num(p.entryPx);
    b.disabled = true; b.textContent = "Closing…";
    try {
      const f = await HL.marketOrder(S.agent, { asset: m.asset, isBuy, sz, px, szDecimals: m.szDecimals, reduceOnly: true, slippage: +$("slip").value });
      setStatus(`✅ Closed ${coin}${f.avgPx ? ` @ ${fmtPx(f.avgPx)}` : ""}.`, "ok");
    } catch (e) {
      const msg = e.message || String(e);
      if (agentGone(msg)) { HL.forgetAgent(W.address); S.agent = null; }
      setStatus(friendly(msg), "err");
    }
    setTimeout(loadAccount, 600);
  }

  // ── wiring ──
  function bind() {
    $("coinBtn").onclick = (e) => { e.stopPropagation(); toggleDrop($("coinDrop").hidden); };
    $("coinDrop").onclick = (e) => e.stopPropagation();
    document.addEventListener("click", () => toggleDrop(false));
    $("coinSearch").oninput = renderList;
    $("coinSearch").onkeydown = (e) => { if (e.key === "Enter") { const b = $("coinList").querySelector("button"); if (b) { pick(b.dataset.c); toggleDrop(false); } } if (e.key === "Escape") toggleDrop(false); };
    $("side").querySelectorAll("button").forEach((b) => (b.onclick = () => {
      S.side = b.dataset.s;
      $("side").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      renderOrder();
    }));
    $("mode").querySelectorAll("button").forEach((b) => (b.onclick = () => {
      S.mode = b.dataset.v; $("mode").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); renderOrder();
    }));
    $("lev").oninput = () => setLev(+$("lev").value);
    $("amt").oninput = () => { $("pct").querySelectorAll("button").forEach((x) => x.classList.remove("on")); renderOrder(); };
    $("pct").querySelectorAll("button").forEach((b) => (b.onclick = () => {
      const a = available(); if (!(a > 0)) { setStatus(S.user ? "No USDC available on Hyperliquid yet." : "Connect your wallet first.", "err"); return; }
      $("amt").value = (Math.floor(a * +b.dataset.v / 100 * 100) / 100).toString();
      $("pct").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); renderOrder();
    }));
    $("tf").querySelectorAll("button").forEach((b) => (b.onclick = () => {
      S.tf = b.dataset.v; $("tf").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); loadCandles();
    }));
    $("goBtn").onclick = go;
    window.addEventListener("resize", () => S.candles.length && drawChart());
  }

  function onWallet() {
    const u = W.address || null;
    if (u !== S.user) {
      S.user = u; S.account = null; S.positions = []; S.spotUsdc = 0;
      S.agent = u ? HL.loadAgent(u) : null;
      renderAccount(); renderPositions(); renderOrder();
      if (u) loadAccount();
    }
  }

  async function tickMids() {
    try {
      const mids = await HL.mids();
      for (const k in mids) S.mids[k] = num(mids[k]);
      renderStats(); renderOrder(); if (S.candles.length) drawChart();
      if (S.positions.length) renderPositions();
    } catch (_) {}
  }

  async function init() {
    bind();
    try { await loadMarkets(); }
    catch (e) { $("chart").innerHTML = `<div class="chart-empty">Couldn't reach Hyperliquid. Try again in a moment.</div>`; setStatus("Couldn't load markets from Hyperliquid.", "err"); return; }
    let start = new URLSearchParams(location.search).get("coin");
    try { start = start || localStorage.getItem("scoty.lev.coin"); } catch (_) {}
    pick(S.byCoin.has(start) ? start : S.byCoin.has("HYPE") ? "HYPE" : S.markets[0].name);
    W.onChange(onWallet); onWallet();
    setInterval(tickMids, 3000);
    setInterval(() => { if (S.user) loadAccount(); }, 6000);
    setInterval(async () => { try { await loadMarkets(); renderStats(); } catch (_) {} }, 30000);
    setInterval(loadCandles, 30000);
  }
  init();
})();
