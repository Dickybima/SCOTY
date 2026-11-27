// Hyperliquid perps client for the Leverage page.
// Reads go to the public /info API. Trades are signed by a local "agent" key the user
// approves once with their own wallet (Hyperliquid's API-wallet model): the agent can place
// and cancel orders for the account but can never withdraw or transfer funds.
(function () {
  const API = "https://api.hyperliquid.xyz";

  // ── minimal msgpack encoder (same byte output as Python's msgpack.packb) ──
  function pack(v) {
    const out = [];
    const u8 = (n) => out.push(n & 255);
    const be = (n, bytes) => { for (let i = bytes - 1; i >= 0; i--) out.push(Number((BigInt(n) >> BigInt(8 * i)) & 255n)); };
    const enc = (x) => {
      if (x === null || x === undefined) return u8(0xc0);
      if (x === true) return u8(0xc3);
      if (x === false) return u8(0xc2);
      if (typeof x === "number" || typeof x === "bigint") {
        if (typeof x === "number" && !Number.isInteger(x)) throw new Error("msgpack: floats are not supported");
        const n = BigInt(x);
        if (n >= 0n) {
          if (n < 128n) return u8(Number(n));
          if (n < 256n) { u8(0xcc); return be(n, 1); }
          if (n < 65536n) { u8(0xcd); return be(n, 2); }
          if (n < 4294967296n) { u8(0xce); return be(n, 4); }
          u8(0xcf); return be(n, 8);
        }
        if (n >= -32n) return u8(Number(n) & 255);
        if (n >= -128n) { u8(0xd0); return be(BigInt.asUintN(8, n), 1); }
        if (n >= -32768n) { u8(0xd1); return be(BigInt.asUintN(16, n), 2); }
        if (n >= -2147483648n) { u8(0xd2); return be(BigInt.asUintN(32, n), 4); }
        u8(0xd3); return be(BigInt.asUintN(64, n), 8);
      }
      if (typeof x === "string") {
        const b = new TextEncoder().encode(x), l = b.length;
        if (l < 32) u8(0xa0 | l); else if (l < 256) { u8(0xd9); u8(l); } else if (l < 65536) { u8(0xda); be(l, 2); } else { u8(0xdb); be(l, 4); }
        for (const c of b) out.push(c);
        return;
      }
      if (Array.isArray(x)) {
        const l = x.length;
        if (l < 16) u8(0x90 | l); else if (l < 65536) { u8(0xdc); be(l, 2); } else { u8(0xdd); be(l, 4); }
        return x.forEach(enc);
      }
      if (typeof x === "object") {
        const ks = Object.keys(x).filter((k) => x[k] !== undefined), l = ks.length;
        if (l < 16) u8(0x80 | l); else if (l < 65536) { u8(0xde); be(l, 2); } else { u8(0xdf); be(l, 4); }
        for (const k of ks) { enc(k); enc(x[k]); }
        return;
      }
      throw new Error("msgpack: unsupported " + typeof x);
    };
    enc(v);
    return new Uint8Array(out);
  }

  // keccak(msgpack(action) ‖ nonce(8 bytes BE) ‖ 0x00)  — no vault, no expiry
  function actionHash(action, nonce) {
    const a = pack(action), buf = new Uint8Array(a.length + 9);
    buf.set(a, 0);
    const n = BigInt(nonce);
    for (let i = 0; i < 8; i++) buf[a.length + i] = Number((n >> BigInt(8 * (7 - i))) & 255n);
    buf[a.length + 8] = 0;
    return ethers.keccak256(buf);
  }

  const L1_DOMAIN = { name: "Exchange", version: "1", chainId: 1337, verifyingContract: "0x0000000000000000000000000000000000000000" };
  const AGENT_TYPES = { Agent: [{ name: "source", type: "string" }, { name: "connectionId", type: "bytes32" }] };

  async function signL1(wallet, action, nonce) {
    const sig = await wallet.signTypedData(L1_DOMAIN, AGENT_TYPES, { source: "a", connectionId: actionHash(action, nonce) });
    const s = ethers.Signature.from(sig);
    return { r: s.r, s: s.s, v: s.v };
  }

  // ── number formatting (Hyperliquid tick/lot rules) ──
  // floatToWire: up to 8 decimals, trailing zeros stripped
  function wire(x) {
    let s = Number(x).toFixed(8);
    if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s === "-0" ? "0" : s;
  }
  // price: 5 significant figures, at most (6 - szDecimals) decimals (perps)
  function roundPx(px, szDecimals) {
    const sig = Number(Number(px).toPrecision(5));
    const d = Math.max(0, 6 - szDecimals);
    return Number(sig.toFixed(d));
  }
  // size: floor to szDecimals
  function roundSz(sz, szDecimals) {
    const f = 10 ** szDecimals;
    return Math.floor(sz * f + 1e-9) / f;
  }

  // ── HTTP ──
  async function post(path, body) {
    const r = await fetch(API + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const text = await r.text();
    let j; try { j = JSON.parse(text); } catch (_) { throw new Error(text || r.statusText); }
    if (!r.ok) throw new Error(typeof j === "string" ? j : j?.error || r.statusText);
    return j;
  }
  const info = (body) => post("/info", body);

  let lastNonce = 0;
  const nextNonce = () => (lastNonce = Math.max(Date.now(), lastNonce + 1));

  async function exchange(wallet, action) {
    const nonce = nextNonce();
    const signature = await signL1(wallet, action, nonce);
    const res = await post("/exchange", { action, nonce, signature, vaultAddress: null, expiresAfter: null });
    if (res?.status !== "ok") throw new Error(typeof res?.response === "string" ? res.response : JSON.stringify(res));
    return res.response;
  }

  // ── agent (API wallet) kept in this browser, per user ──
  const AKEY = (user) => "scoty.hl.agent." + user.toLowerCase();
  function loadAgent(user) {
    try { const k = localStorage.getItem(AKEY(user)); return k ? new ethers.Wallet(k) : null; } catch (_) { return null; }
  }
  function forgetAgent(user) { try { localStorage.removeItem(AKEY(user)); } catch (_) {} }

  // The user signs ApproveAgent with their own wallet (EIP-712, any chain id).
  async function approveAgent(provider, user) {
    const agent = ethers.Wallet.createRandom();
    const chainHex = await provider.request({ method: "eth_chainId" });
    const nonce = nextNonce();
    const action = { type: "approveAgent", signatureChainId: chainHex, hyperliquidChain: "Mainnet", agentAddress: agent.address, agentName: "SCOTY", nonce };
    const typed = {
      domain: { name: "HyperliquidSignTransaction", version: "1", chainId: parseInt(chainHex, 16), verifyingContract: "0x0000000000000000000000000000000000000000" },
      types: {
        EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }],
        "HyperliquidTransaction:ApproveAgent": [{ name: "hyperliquidChain", type: "string" }, { name: "agentAddress", type: "address" }, { name: "agentName", type: "string" }, { name: "nonce", type: "uint64" }],
      },
      primaryType: "HyperliquidTransaction:ApproveAgent",
      message: { hyperliquidChain: "Mainnet", agentAddress: agent.address, agentName: "SCOTY", nonce },
    };
    const sig = await provider.request({ method: "eth_signTypedData_v4", params: [user, JSON.stringify(typed)] });
    const s = ethers.Signature.from(sig);
    const res = await post("/exchange", { action, nonce, signature: { r: s.r, s: s.s, v: s.v }, vaultAddress: null, expiresAfter: null });
    if (res?.status !== "ok") throw new Error(typeof res?.response === "string" ? res.response : JSON.stringify(res));
    try { localStorage.setItem(AKEY(user), agent.privateKey); } catch (_) {}
    return agent;
  }

  // ── actions ──
  const updateLeverage = (agent, asset, leverage, isCross) =>
    exchange(agent, { type: "updateLeverage", asset, isCross, leverage });

  // Market order = aggressive IOC limit at mid ± slippage
  async function marketOrder(agent, { asset, isBuy, sz, px, szDecimals, reduceOnly = false, slippage = 0.05 }) {
    const limit = roundPx(px * (isBuy ? 1 + slippage : 1 - slippage), szDecimals);
    const action = { type: "order", orders: [{ a: asset, b: isBuy, p: wire(limit), s: wire(roundSz(sz, szDecimals)), r: reduceOnly, t: { limit: { tif: "Ioc" } } }], grouping: "na" };
    const res = await exchange(agent, action);
    const st = res?.data?.statuses?.[0];
    if (!st) throw new Error("No response from Hyperliquid");
    if (st.error) throw new Error(st.error);
    return st.filled || st.resting || st;
  }

  // HIP-3 (builder-deployed) markets keep margin per dex. Dex abstraction lets them use the
  // account's main USDC balance automatically; the agent can switch it on once.
  async function ensureDexAbstraction(agent, user) {
    const k = "scoty.hl.dexabs." + user.toLowerCase();
    try { if (localStorage.getItem(k)) return; } catch (_) {}
    try { await exchange(agent, { type: "agentEnableDexAbstraction" }); }
    catch (e) { if (!/already|enabled/i.test(e.message || "")) throw e; }
    try { localStorage.setItem(k, "1"); } catch (_) {}
  }

  window.SCOTY_HL = {
    API, pack, actionHash, signL1, wire, roundPx, roundSz, info, exchange,
    loadAgent, forgetAgent, approveAgent, updateLeverage, marketOrder,
    meta: (dex) => info(dex ? { type: "metaAndAssetCtxs", dex } : { type: "metaAndAssetCtxs" }),
    mids: (dex) => info(dex ? { type: "allMids", dex } : { type: "allMids" }),
    state: (user, dex) => info(dex ? { type: "clearinghouseState", user, dex } : { type: "clearinghouseState", user }),
    perpDexs: () => info({ type: "perpDexs" }),
    ensureDexAbstraction,
    spot: (user) => info({ type: "spotClearinghouseState", user }),
    candles: (coin, interval, startTime) => info({ type: "candleSnapshot", req: { coin, interval, startTime, endTime: Date.now() } }),
    extraAgents: (user) => info({ type: "extraAgents", user }),
  };
})();
