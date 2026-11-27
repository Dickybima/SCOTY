// Montra market data on Elysium, read straight from the chain:
//  · pool prices from the Uniswap v4 StateView (getSlot0)
//  · HYPE in USD from CoinGecko
//  · a token's launch (pool key, creator, time) from Montra's TokenLaunched event
(function () {
  const { CFG, readProvider } = window.SCOTY;
  const chain = CFG.chains[0];
  const Q96 = 2 ** 96;

  // HYPE → USD, cached for a minute
  let usdCache = null;
  async function hypeUsd() {
    if (usdCache && Date.now() - usdCache.at < 60000) return usdCache.v;
    try {
      const c = JSON.parse(localStorage.getItem("scoty.hypeUsd") || "null");
      if (c && Date.now() - c.at < 60000) { usdCache = c; return c.v; }
    } catch (_) {}
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${chain.coingeckoId}&vs_currencies=usd`);
      const d = await r.json();
      const v = Number(d[chain.coingeckoId] && d[chain.coingeckoId].usd) || 0;
      usdCache = { v, at: Date.now() };
      try { localStorage.setItem("scoty.hypeUsd", JSON.stringify(usdCache)); } catch (_) {}
      return v;
    } catch (_) { return usdCache ? usdCache.v : 0; }
  }

  // Pair (quote) token info: native HYPE or an ERC-20 like KNTQ
  const ZERO = "0x0000000000000000000000000000000000000000";
  const isNative = (q) => !q || String(q).toLowerCase() === ZERO;
  const pairCache = {};
  async function pairInfo(quote, provider) {
    if (isNative(quote)) return { native: true, address: ZERO, symbol: chain.symbol, decimals: 18 };
    const k = String(quote).toLowerCase();
    if (pairCache[k]) return pairCache[k];
    const known = (CFG.pairs || []).find((p) => p.address.toLowerCase() === k);
    try { const c = JSON.parse(localStorage.getItem("scoty.pair." + k) || "null"); if (c) return (pairCache[k] = c); } catch (_) {}
    const t = new ethers.Contract(quote, ["function symbol() view returns (string)", "function decimals() view returns (uint8)"], provider || readProvider(chain));
    const [symbol, decimals] = await Promise.all([t.symbol().catch(() => (known && known.symbol) || "TOKEN"), t.decimals().then(Number).catch(() => 18)]);
    const info = { native: false, address: ethers.getAddress(quote), symbol: (known && known.symbol) || symbol, decimals };
    try { localStorage.setItem("scoty.pair." + k, JSON.stringify(info)); } catch (_) {}
    return (pairCache[k] = info);
  }

  // USD price of a pair token: HYPE from CoinGecko, others from CoinGecko (if configured) or DexScreener
  const qUsd = {};
  async function quoteUsd(quote) {
    if (isNative(quote)) return hypeUsd();
    const k = String(quote).toLowerCase();
    if (qUsd[k] && Date.now() - qUsd[k].at < 60000) return qUsd[k].v;
    let v = 0;
    const known = (CFG.pairs || []).find((p) => p.address.toLowerCase() === k);
    try {
      if (known && known.coingeckoId) {
        const d = await (await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${known.coingeckoId}&vs_currencies=usd`)).json();
        v = Number(d[known.coingeckoId] && d[known.coingeckoId].usd) || 0;
      }
      if (!v) {
        const d = await (await fetch(`https://api.dexscreener.com/latest/dex/tokens/${quote}`)).json();
        const pr = (d.pairs || []).filter((x) => x.baseToken && x.baseToken.address.toLowerCase() === k && Number(x.priceUsd) > 0)
          .sort((a, b) => Number((b.liquidity || {}).usd || 0) - Number((a.liquidity || {}).usd || 0))[0];
        v = pr ? Number(pr.priceUsd) : 0;
      }
    } catch (_) {}
    qUsd[k] = { v, at: Date.now() };
    return v;
  }

  // Price of the coin in its pair token (HYPE for HYPE pairs) from a pool's sqrtPriceX96.
  // In v4 the price is currency1 per currency0; native HYPE always sorts first (currency0).
  function priceFromSqrt(sqrtPriceX96, quoteIsCurrency0) {
    const r = Number(sqrtPriceX96) / Q96;
    const p1per0 = r * r;
    if (!(p1per0 > 0)) return 0;
    return quoteIsCurrency0 !== false ? 1 / p1per0 : p1per0;
  }

  // HYPE price per coin for many launches at once (one StateView call each, batched by the provider)
  async function prices(launches, provider) {
    const sv = new ethers.Contract(chain.stateView, CFG.stateViewAbi, provider || readProvider(chain));
    const out = {};
    await Promise.all(launches.filter((l) => l && l.poolId).map(async (l) => {
      try {
        const s = await sv.getSlot0(l.poolId);
        out[l.address.toLowerCase()] = priceFromSqrt(s.sqrtPriceX96, l.quoteIsCurrency0);
      } catch (_) {}
    }));
    return out;
  }

  const supplyOf = (l) => {
    try { return Number(ethers.formatUnits(BigInt(l.supply || "0"), 18)) || CFG.supply; } catch (_) { return CFG.supply; }
  };

  // Fill in mcap (USD) for a list of launches
  async function withMarketCaps(launches) {
    if (!window.ethers || !launches.length) return launches;
    const quotes = [...new Set(launches.map((l) => (isNative(l.quote) ? ZERO : String(l.quote).toLowerCase())))];
    const [px, usds] = await Promise.all([prices(launches), Promise.all(quotes.map((q) => quoteUsd(q).catch(() => 0)))]);
    const usdOf = Object.fromEntries(quotes.map((q, i) => [q, usds[i]]));
    return launches.map((l) => {
      const p = px[l.address.toLowerCase()];
      if (p == null) return l;
      const usd = usdOf[isNative(l.quote) ? ZERO : String(l.quote).toLowerCase()] || 0;
      return { ...l, priceHype: p, priceQuote: p, priceUsd: usd ? p * usd : 0, mcapHype: p * supplyOf(l), mcap: usd ? p * supplyOf(l) * usd : l.mcap || 0 };
    });
  }

  // A token's Montra launch, found on-chain (for coins that are not in SCOTY's index)
  async function findLaunch(token, provider) {
    provider = provider || readProvider(chain);
    const fI = new ethers.Interface(CFG.factoryAbi);
    const pI = new ethers.Interface(CFG.poolManagerAbi);
    const topic = fI.getEvent("TokenLaunched").topicHash;
    const logs = await provider.getLogs({
      address: chain.factory, fromBlock: chain.factoryDeployBlock, toBlock: "latest",
      topics: [topic, ethers.zeroPadValue(token, 32)],
    });
    if (!logs.length) return null;
    const log = logs[0];
    const ev = fI.parseLog(log).args;
    const rc = await provider.getTransactionReceipt(log.transactionHash);
    let key = null;
    for (const l of (rc && rc.logs) || []) {
      if (l.address.toLowerCase() !== chain.poolManager.toLowerCase()) continue;
      try {
        const x = pI.parseLog(l);
        if (x && x.name === "Initialize" && x.args.id === ev.poolId) key = { currency0: x.args.currency0, currency1: x.args.currency1, fee: Number(x.args.fee), tickSpacing: Number(x.args.tickSpacing), hooks: x.args.hooks };
      } catch (_) {}
    }
    const block = await provider.getBlock(log.blockNumber).catch(() => null);
    return {
      address: ethers.getAddress(token), creator: ev.creator, feeRecipient: ev.feeRecipient, poolId: ev.poolId,
      configId: Number(ev.configId), quote: ev.quote, quoteIsCurrency0: ev.quoteIsCurrency0, supply: ev.supply.toString(),
      key, tx: log.transactionHash, block: log.blockNumber, createdAt: block ? block.timestamp * 1000 : 0,
    };
  }

  window.SCOTY.Market = { hypeUsd, quoteUsd, pairInfo, isNative, prices, priceFromSqrt, withMarketCaps, findLaunch, supplyOf };
})();
