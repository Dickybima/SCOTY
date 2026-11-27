// SCOTY launches: the index kept by /api/launches (every entry verified on-chain),
// merged with launches made from this browser, plus a browser cache for instant loads.
(function () {
  const { CFG, W, Store } = window.SCOTY;
  const chain = CFG.chains[0];

  async function getJSON(url) {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }
  const safeImg = (u) => (typeof u === "string" && /^(data:image\/(png|jpe?g|webp|gif|svg\+xml)[;,]|https:\/\/|ipfs:\/\/)/i.test(u) ? u : null);

  // merge indexed launches with ones made from this browser (shown instantly, before indexing)
  function merge(indexed) {
    const map = new Map();
    for (const t of indexed) map.set(t.address.toLowerCase(), t);
    for (const t of Store.all()) {
      if (!t.address || t.chain !== chain.key) continue; // launches from older networks are not shown
      const k = t.address.toLowerCase();
      map.set(k, map.has(k) ? { ...map.get(k), mine: true } : t);
    }
    for (const a of CFG.hiddenTokens || []) map.delete(String(a).toLowerCase());
    const cut = CFG.hideLaunchedBefore || 0;
    const off = (CFG.officialToken || "").toLowerCase();
    for (const [k, t] of map) if (cut && k !== off && (!t.createdAt || t.createdAt < cut)) map.delete(k);
    const me = W.address && W.address.toLowerCase();
    return [...map.values()].map((t) => ({ ...t, mine: t.mine || (me && t.creator && t.creator.toLowerCase() === me) }));
  }

  // Launches from this browser that the index doesn't have yet (e.g. the tab closed
  // before registering) are sent again; the server verifies each on-chain.
  function healIndex(indexed) {
    const have = new Set(indexed.map((t) => t.address.toLowerCase()));
    for (const t of Store.all()) {
      if (t.chain !== chain.key || !t.tx || have.has((t.address || "").toLowerCase())) continue;
      fetch(CFG.launchesUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tx: t.tx }) }).catch(() => {});
    }
  }

  const CACHE_KEY = "scoty.launchCache.elysium.v1";
  function cached() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (c && Array.isArray(c.launches) && Date.now() - c.at < 7 * 864e5) return c.launches;
    } catch (_) {}
    return null;
  }
  function saveCache(launches) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), launches })); } catch (_) {}
  }
  const clean = (t) => ({ ...t, image: safeImg(t.image), twitter: /^https:\/\//.test(t.twitter || "") ? t.twitter : null,
    website: /^https:\/\//.test(t.website || "") ? t.website : null, chain: chain.key, mcap: t.mcap || 0 });

  async function loadLaunches() {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    const r = await fetch(CFG.launchesUrl, { signal: ctl.signal, headers: { accept: "application/json" } }).finally(() => clearTimeout(timer));
    const d = r.ok ? await r.json() : null;
    if (!d || !Array.isArray(d.launches)) throw new Error("launch index unavailable");
    let list = d.launches.map(clean);
    healIndex(list);
    if (window.SCOTY.Market) list = await window.SCOTY.Market.withMarketCaps(list).catch(() => list);
    saveCache(list);
    return list;
  }

  window.SCOTY.Feed = { getJSON, loadLaunches, cached, merge, safeImg };
})();
