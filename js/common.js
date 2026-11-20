// Shared: layout (nav/footer), wallet, storage, logo generator, helpers
(function () {
  const CFG = window.SCOTY_CONFIG;
  const page = document.body.dataset.page;
  const short = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");

  // ── Layout ──────────────────────────────────────────────────
  document.getElementById("nav").outerHTML = `
  <header class="nav"><div class="wrap nav-in">
    <a href="index.html" class="brand"><span class="brand-mark">S</span>SCOTY</a>
    <span class="tag">on ${CFG.protocol}</span>
    <nav class="menu">
      <a href="index.html" class="${page === "explore" ? "on" : ""}">Explore</a>
      <a href="create.html" class="${page === "create" ? "on" : ""}">Create</a>
    </nav>
    <button class="wallet" id="walletBtn"><span class="dot"></span><span id="walletLbl">Connect Wallet</span></button>
  </div></header>`;

  document.getElementById("footer").outerHTML = `
  <footer class="foot">
    <a href="index.html" class="brand"><span class="brand-mark">S</span>SCOTY</a>
    <p>Launch and explore tokens on ${CFG.protocol}. Your wallet signs every transaction. SCOTY never takes custody of your assets.</p>
    <div class="foot-links"><a href="index.html">Explore</a><a href="create.html">Create</a><a href="#">Docs</a><a href="#">Privacy Policy</a><a href="#">Terms of Use</a></div>
    <p class="fine">SCOTY is a non-custodial, third-party interface to the ${CFG.protocol} protocol. Transactions may be irreversible and tokens can lose all value. SCOTY provides no custody, warranties, or financial advice.</p>
    <div class="foot-bot"><span>© ${new Date().getFullYear()} SCOTY</span><span>@scoty</span></div>
  </footer>`;

  // ── Wallet ──────────────────────────────────────────────────
  const W = { address: null, chainId: null, listeners: [] };
  const btn = document.getElementById("walletBtn");
  const lbl = document.getElementById("walletLbl");

  async function refresh() {
    const eth = window.ethereum;
    if (!eth || !W.address) {
      btn.classList.remove("connected");
      lbl.textContent = "Connect Wallet";
      W.listeners.forEach((f) => f(W));
      return;
    }
    btn.classList.add("connected");
    let bal = "";
    try {
      const hex = await eth.request({ method: "eth_getBalance", params: [W.address, "latest"] });
      const v = Number(BigInt(hex)) / 1e18;
      const chain = CFG.chains.find((c) => c.chainId === W.chainId);
      bal = `<span class="bal">${v === 0 ? "0" : v < 0.0001 ? v.toExponential(3) : v.toFixed(4)} ${chain ? chain.symbol : "ETH"}</span> `;
    } catch (_) {}
    lbl.innerHTML = bal + short(W.address);
    W.listeners.forEach((f) => f(W));
  }

  W.connect = async function () {
    const eth = window.ethereum;
    if (!eth) {
      alert("No wallet found. Please install MetaMask or another EVM wallet.");
      return false;
    }
    const [acc] = await eth.request({ method: "eth_requestAccounts" });
    W.address = acc;
    W.chainId = parseInt(await eth.request({ method: "eth_chainId" }), 16);
    await refresh();
    return true;
  };

  W.switchChain = async function (chain) {
    const eth = window.ethereum;
    const hex = "0x" + chain.chainId.toString(16);
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (e) {
      if (e.code !== 4902) throw e;
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: hex, chainName: chain.name, rpcUrls: [chain.rpc],
          nativeCurrency: { name: chain.symbol, symbol: chain.symbol, decimals: 18 },
          blockExplorerUrls: [chain.explorer] }],
      });
    }
    W.chainId = chain.chainId;
    await refresh();
  };

  W.onChange = (f) => W.listeners.push(f);

  btn.addEventListener("click", () => (W.address ? null : W.connect().catch(console.error)));

  if (window.ethereum) {
    window.ethereum.request({ method: "eth_accounts" }).then(async (accs) => {
      if (accs[0]) {
        W.address = accs[0];
        W.chainId = parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16);
        refresh();
      }
    }).catch(() => {});
    window.ethereum.on?.("accountsChanged", (a) => { W.address = a[0] || null; refresh(); });
    window.ethereum.on?.("chainChanged", (c) => { W.chainId = parseInt(c, 16); refresh(); });
  }

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

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtUsd = (n) => n >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? "$" + (n / 1e3).toFixed(1) + "K" : "$" + n.toFixed(0);
  const ago = (ts) => { const s = (Date.now() - ts) / 1000; return s < 60 ? "just now" : s < 3600 ? Math.floor(s / 60) + "m ago" : s < 86400 ? Math.floor(s / 3600) + "h ago" : Math.floor(s / 86400) + "d ago"; };

  window.SCOTY = { CFG, W, Store, logoSVG, logoHTML, esc, fmtUsd, ago, short, hash };
})();
