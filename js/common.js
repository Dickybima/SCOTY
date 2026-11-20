// Shared: layout (nav/footer), wallet, storage, logo generator, helpers
(function () {
  const CFG = window.SCOTY_CONFIG;
  const page = document.body.dataset.page;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtUsd = (n) => n >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? "$" + (n / 1e3).toFixed(1) + "K" : "$" + n.toFixed(0);
  const ago = (ts) => { const s = (Date.now() - ts) / 1000; return s < 60 ? "just now" : s < 3600 ? Math.floor(s / 60) + "m ago" : s < 86400 ? Math.floor(s / 3600) + "h ago" : Math.floor(s / 86400) + "d ago"; };

  const short = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");

  // ── Layout ──────────────────────────────────────────────────
  document.getElementById("nav").outerHTML = `
  <header class="nav"><div class="wrap nav-in">
    <a href="index.html" class="brand"><img class="brand-mark" src="assets/logo.png" alt="">SCOTY</a>
    <span class="tag">${CFG.network}</span>
    <nav class="menu">
      <a href="index.html" class="${page === "explore" ? "on" : ""}">Explore</a>
      <a href="create.html" class="${page === "create" ? "on" : ""}">Create</a>
      <a href="profile.html" class="${page === "profile" ? "on" : ""}">Profile</a>
    </nav>
    <button class="wallet" id="walletBtn"><span class="dot"></span><span id="walletLbl">Connect Wallet</span></button>
  </div></header>`;

  document.getElementById("footer").outerHTML = `
  <footer class="foot">
    <a href="index.html" class="brand"><img class="brand-mark" src="assets/logo.png" alt="">SCOTY</a>
    <p>Launch and explore tokens on ${CFG.network}. Your wallet signs every transaction. SCOTY never takes custody of your assets.</p>
    <div class="foot-links"><a href="index.html">Explore</a><a href="create.html">Create</a><a href="profile.html">Profile</a><a href="docs.html">Docs</a><a href="privacy.html">Privacy Policy</a><a href="#">Terms of Use</a></div>
    <p class="fine">SCOTY is a non-custodial, third-party interface to token launch protocols on ${CFG.network}. Transactions may be irreversible and tokens can lose all value. SCOTY provides no custody, warranties, or financial advice.</p>
    <div class="foot-bot"><span>© ${new Date().getFullYear()} SCOTY</span><span>@scoty</span></div>
  </footer>`;

  // ── Wallet (EIP-6963 multi-wallet discovery + picker) ───────
  const W = { address: null, chainId: null, provider: null, info: null, listeners: [] };
  const btn = document.getElementById("walletBtn");
  const lbl = document.getElementById("walletLbl");
  const WKEY = "scoty.wallet";
  const found = new Map(); // rdns -> { info, provider }

  window.addEventListener("eip6963:announceProvider", (e) => {
    const { info, provider } = e.detail || {};
    if (info && provider) { found.set(info.rdns || info.uuid, { info, provider }); if (document.getElementById("walletPicker")?.classList.contains("open")) renderPicker(); }
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  function legacyInjected() {
    const eth = window.ethereum;
    if (!eth || found.size) return [];
    const name = eth.isRabby ? "Rabby" : eth.isCoinbaseWallet ? "Coinbase Wallet" : eth.isOkxWallet ? "OKX Wallet" : eth.isTrust ? "Trust Wallet" : eth.isMetaMask ? "MetaMask" : "Browser Wallet";
    return [{ info: { name, rdns: "injected", icon: "" }, provider: eth }];
  }
  const available = () => [...found.values(), ...legacyInjected()];

  // picker modal
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal" id="walletPicker"><div class="sheet wsheet">
      <button class="close" aria-label="Close">✕</button>
      <h3 style="font-family:'Space Grotesk';font-size:1.3rem;margin-bottom:4px">Connect a wallet</h3>
      <p class="status" style="margin:0 0 16px">Choose the wallet you want to use on ${CFG.network}.</p>
      <div id="wlist" class="wlist"></div>
      <p class="fine" style="margin-top:16px">By connecting you agree to the Terms of Use. SCOTY never holds your funds.</p>
    </div></div>`);
  const picker = document.getElementById("walletPicker");
  const closePicker = () => picker.classList.remove("open");
  picker.querySelector(".close").onclick = closePicker;
  picker.addEventListener("click", (e) => { if (e.target === picker) closePicker(); });

  const iconHTML = (info, name) => info && info.icon
    ? `<img src="${esc(info.icon)}" alt="">`
    : `<span class="wicon-fallback">${(name || "?").charAt(0)}</span>`;

  let pickResolve = null;
  function renderPicker() {
    const list = available();
    const have = new Set(list.map((w) => w.info.rdns));
    const installed = list.map((w, i) =>
      `<button class="wopt" data-i="${i}" type="button">${iconHTML(w.info, w.info.name)}<b>${esc(w.info.name)}</b><small>Detected</small></button>`).join("");
    const missing = CFG.wallets.filter((w) => !have.has(w.rdns)).map((w) =>
      `<a class="wopt dim" href="${w.url}" target="_blank" rel="noopener">${iconHTML(null, w.name)}<b>${esc(w.name)}</b><small>Install ↗</small></a>`).join("");
    document.getElementById("wlist").innerHTML =
      (installed || `<p class="status" style="margin:0 0 6px">No wallet detected in this browser. Install one below, or open SCOTY inside your wallet app's browser on mobile.</p>`) + missing;
    document.querySelectorAll("#wlist button.wopt").forEach((b) => (b.onclick = async () => {
      const w = list[+b.dataset.i];
      b.querySelector("small").textContent = "Connecting…";
      try { await use(w, true); closePicker(); pickResolve && pickResolve(true); }
      catch (err) { b.querySelector("small").textContent = err.code === 4001 ? "Rejected" : "Failed"; }
    }));
  }

  function bindEvents(p) {
    p.on?.("accountsChanged", (a) => { if (W.provider !== p) return; W.address = a[0] || null; refresh(); });
    p.on?.("chainChanged", (c) => { if (W.provider !== p) return; W.chainId = parseInt(c, 16); refresh(); });
  }

  async function use(w, ask) {
    const accs = await w.provider.request({ method: ask ? "eth_requestAccounts" : "eth_accounts" });
    if (!accs[0]) return false;
    W.provider = w.provider; W.info = w.info; W.address = accs[0];
    W.chainId = parseInt(await w.provider.request({ method: "eth_chainId" }), 16);
    try { localStorage.setItem(WKEY, w.info.rdns); } catch (_) {}
    bindEvents(w.provider);
    await refresh();
    return true;
  }

  async function refresh() {
    if (!W.provider || !W.address) {
      btn.classList.remove("connected");
      lbl.textContent = "Connect Wallet";
      W.listeners.forEach((f) => f(W));
      return;
    }
    btn.classList.add("connected");
    const chain = CFG.chains.find((c) => c.chainId === W.chainId);
    let bal = "";
    try {
      const hex = await W.provider.request({ method: "eth_getBalance", params: [W.address, "latest"] });
      const v = Number(BigInt(hex)) / 1e18;
      bal = `<span class="bal">${v === 0 ? "0" : v < 0.0001 ? v.toExponential(3) : v.toFixed(4)} ${chain ? chain.symbol : "ETH"}</span> `;
    } catch (_) {}
    lbl.innerHTML = (chain ? bal : `<span class="bal">Wrong network</span> `) + short(W.address);
    W.listeners.forEach((f) => f(W));
  }

  W.connect = function () {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    renderPicker();
    picker.classList.add("open");
    return new Promise((r) => { pickResolve = r; });
  };

  W.disconnect = function () {
    W.address = W.provider = W.info = null;
    try { localStorage.removeItem(WKEY); } catch (_) {}
    W.provider?.request?.({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] }).catch(() => {});
    refresh();
  };

  W.switchChain = async function (chain) {
    const p = W.provider;
    const hex = "0x" + chain.chainId.toString(16);
    try {
      await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (e) {
      if (e.code !== 4902 && e?.data?.originalError?.code !== 4902) throw e;
      await p.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: hex, chainName: chain.name, rpcUrls: [chain.rpc],
          nativeCurrency: { name: "Ether", symbol: chain.symbol, decimals: 18 },
          blockExplorerUrls: [chain.explorer] }],
      });
    }
    W.chainId = chain.chainId;
    await refresh();
  };

  W.onChange = (f) => W.listeners.push(f);

  // account menu when connected
  document.body.insertAdjacentHTML("beforeend", `<div class="wmenu" id="wmenu">
    <div class="wmenu-h" id="wmenuH"></div>
    <a href="profile.html">My profile</a>
    <button type="button" id="wCopy">Copy address</button>
    <a id="wExplorer" target="_blank" rel="noopener">View on explorer ↗</a>
    <button type="button" id="wSwitch">Switch to ${CFG.network}</button>
    <button type="button" id="wDisc" class="danger">Disconnect</button></div>`);
  const menu = document.getElementById("wmenu");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!W.address) return W.connect();
    const chain = CFG.chains[0];
    document.getElementById("wmenuH").innerHTML = `${iconHTML(W.info, W.info?.name)}<div><b>${esc(W.info?.name || "Wallet")}</b><small>${short(W.address)}</small></div>`;
    document.getElementById("wExplorer").href = `${chain.explorer}/address/${W.address}`;
    document.getElementById("wSwitch").style.display = W.chainId === chain.chainId ? "none" : "";
    const r = btn.getBoundingClientRect();
    menu.style.top = r.bottom + 8 + "px";
    menu.style.right = Math.max(16, innerWidth - r.right) + "px";
    menu.classList.toggle("open");
  });
  document.addEventListener("click", (e) => { if (!menu.contains(e.target)) menu.classList.remove("open"); });
  document.getElementById("wCopy").onclick = (e) => { navigator.clipboard?.writeText(W.address); e.target.textContent = "Copied!"; setTimeout(() => (e.target.textContent = "Copy address"), 1200); };
  document.getElementById("wDisc").onclick = () => { menu.classList.remove("open"); W.disconnect(); };
  document.getElementById("wSwitch").onclick = () => { menu.classList.remove("open"); W.switchChain(CFG.chains[0]).catch(console.error); };

  // silent reconnect to the last used wallet
  setTimeout(() => {
    let last = null;
    try { last = localStorage.getItem(WKEY); } catch (_) {}
    if (!last) return;
    const w = available().find((x) => x.info.rdns === last);
    if (w) use(w, false).catch(() => {});
  }, 300);

  // ── Storage (tokens launched from this browser) ─────────────
  const KEY = "scoty.launches";
  const Store = {
    all() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (_) { return []; } },
    add(t) { try { const l = Store.all(); l.unshift(t); localStorage.setItem(KEY, JSON.stringify(l)); } catch (_) {} },
  };

  // ── Generated logo (deterministic SVG from a seed) ─────────
  function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function logoSVG(seed, text) {
    const h = hash(seed || "scoty");
    const a = h % 360, b = (a + 40 + (h >> 8) % 80) % 360;
    const shapes = ["circle", "rect", "blob"][(h >> 4) % 3];
    const glyph = (text || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
    const deco = shapes === "circle"
      ? `<circle cx="${30 + (h % 40)}" cy="${30 + ((h >> 3) % 40)}" r="34" fill="#fff" opacity=".18"/>`
      : shapes === "rect"
      ? `<rect x="-10" y="58" width="140" height="60" transform="rotate(-18 60 60)" fill="#fff" opacity=".16"/>`
      : `<path d="M10 90 Q40 40 70 70 T130 40 V130 H-10Z" fill="#fff" opacity=".18"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g${h}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${a} 85% 60%)"/><stop offset="1" stop-color="hsl(${b} 85% 52%)"/></linearGradient></defs><rect width="120" height="120" fill="url(#g${h})"/>${deco}<text x="60" y="74" text-anchor="middle" font-family="Space Grotesk,Arial,sans-serif" font-weight="700" font-size="40" fill="#fff">${glyph}</text></svg>`;
  }
  const logoHTML = (t) => (t.image ? `<img src="${t.image}" alt="">` : logoSVG(t.symbol + t.name, t.symbol));

  window.SCOTY = { CFG, W, Store, logoSVG, logoHTML, esc, fmtUsd, ago, short, hash };
})();
