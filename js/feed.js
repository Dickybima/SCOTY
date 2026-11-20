// Shared on-chain data: SCOTY launches, merged with local launches
(function () {
  const { CFG, W, Store } = window.SCOTY;
  const chain = CFG.chains[0];

  // ── On-chain feed: ONLY launches made through SCOTY ─────────
  // Every SCOTY launch calls the factory's launchToken with a salt that
  // starts with CFG.launchTag. We scan the factory's incoming transactions
  // (Blockscout API), decode their input and keep the tagged ones.
  async function getJSON(url) {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }

  const MAX_PAGES = 20; // ~1000 most recent factory txs
  const TAG = CFG.launchTag.toLowerCase();
  const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const ZERO_TOPIC = "0x" + "0".repeat(64);
  const safeImg = (u) => (typeof u === "string" && /^(data:image\/(png|jpe?g|webp|gif|svg\+xml)[;,]|https:\/\/)/i.test(u) ? u : null);

  async function scotyLaunchTxs() {
    const iface = new ethers.Interface(CFG.factoryAbi);
    const selector = iface.getFunction("launchToken").selector;
    const found = [];
    let params = "";
    for (let page = 0; page < MAX_PAGES; page++) {
      const data = await getJSON(`${chain.explorerApi}/addresses/${chain.factory}/transactions?filter=to${params}`);
      for (const tx of data.items || []) {
        if (tx.status && tx.status !== "ok") continue;
        let input = tx.raw_input;
        if (input === undefined) {
          if (tx.method && !/launchToken|a72101af/i.test(tx.method)) continue;
          input = (await getJSON(`${chain.explorerApi}/transactions/${tx.hash}`).catch(() => ({}))).raw_input;
        }
        if (!input || !input.toLowerCase().startsWith(selector)) continue;
        let p;
        try { p = iface.parseTransaction({ data: input }).args[0]; } catch (_) { continue; }
        if (!p.salt.toLowerCase().startsWith(TAG)) continue; // not launched via SCOTY
        found.push({ tx, p });
      }
      const next = data.next_page_params;
      if (!next) break;
      params = "&" + new URLSearchParams(next).toString();
    }
    return found;
  }

  async function tokenAddressOf(hash) {
    const logs = await getJSON(`${chain.explorerApi}/transactions/${hash}/logs`);
    const mint = (logs.items || []).find((l) => l.topics && l.topics[0] === TRANSFER && l.topics[1] === ZERO_TOPIC);
    return mint && (mint.address.hash || mint.address);
  }

  // All SCOTY launches found on-chain (newest first)
  async function loadLaunches() {
    if (!chain.factory || !chain.explorerApi || !window.ethers) return [];
    const launches = await scotyLaunchTxs();
    return (await Promise.all(launches.map(async ({ tx, p }) => {
      const address = await tokenAddressOf(tx.hash).catch(() => null);
      if (!address) return null;
      const tok = await getJSON(`${chain.explorerApi}/tokens/${address}`).catch(() => ({}));
      return {
        name: p.name, symbol: p.symbol, description: p.description,
        image: safeImg(p.logo), twitter: /^https:\/\//.test(p.socials.twitter) ? p.socials.twitter : null,
        website: /^https:\/\//.test(p.socials.website) ? p.socials.website : null,
        address, creator: (tx.from && (tx.from.hash || tx.from)) || p.creatorFeeRecipient, tx: tx.hash,
        createdAt: tx.timestamp ? Date.parse(tx.timestamp) : Date.now(),
        mcap: Number(tok.circulating_market_cap || 0) || (Number(tok.exchange_rate || 0) * Number(tok.total_supply || 0) / 10 ** Number(tok.decimals || 18)) || 0,
        holders: Number(tok.holders_count || tok.holders || 0),
        change: 0, progress: null, chain: chain.key,
      };
    }))).filter(Boolean);
  }

  // merge on-chain launches with ones made from this browser (instant, before indexing)
  function merge(onchain) {
    const map = new Map();
    for (const t of onchain) map.set(t.address.toLowerCase(), t);
    for (const t of Store.all()) {
      if (!t.address) continue;
      if (t.demo && chain.factory) continue; // hide old demo launches once live
      const k = t.address.toLowerCase();
      map.set(k, map.has(k) ? { ...map.get(k), description: t.description, image: map.get(k).image || t.image, twitter: t.twitter, website: t.website, mine: true } : t);
    }
    const me = W.address && W.address.toLowerCase();
    return [...map.values()].map((t) => ({ ...t, mine: t.mine || (me && t.creator && t.creator.toLowerCase() === me) }));
  }


  window.SCOTY.Feed = { getJSON, loadLaunches, merge, safeImg };
})();
