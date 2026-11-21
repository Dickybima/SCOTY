// GET /api/launches — every token launched through SCOTY, ready for Explore.
//
// Finding SCOTY launches means scanning the Pons V2 factory's transactions and keeping
// the launchToken calls whose salt starts with the SCOTY marker. Doing that in every
// visitor's browser is slow, so this function does it once and Vercel's CDN caches the
// result (fresh for 30 s, then served stale while it refreshes in the background).
import { Interface, getAddress } from "ethers";

const API = "https://robinhoodchain.blockscout.com/api/v2";
const FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const TAG = "0x53434f5459"; // "SCOTY" — must match launchTag in js/config.js
const LAUNCH_ABI = [
  "function launchToken((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 expectedEconomics,bytes32 salt) params, uint256 launchConfigId, address pairToken, address[] snipeTaxExemptions) payable returns (address token, address curve)",
];
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_TOPIC = "0x" + "0".repeat(64);
const MAX_PAGES = 20;      // ~1000 most recent factory transactions
const DEADLINE_MS = 22000; // stop scanning in time to answer

const okImg = (u) => (typeof u === "string" && /^(data:image\/(png|jpe?g|webp|gif|svg\+xml)[;,]|https:\/\/|ipfs:\/\/)/i.test(u) ? u : null);
const okUrl = (u) => (typeof u === "string" && /^https:\/\//.test(u) ? u : null);

async function getJSON(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(url + " → " + r.status);
  return r.json();
}

// run fn over items, `limit` at a time
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]).catch(() => null); }
  }));
  return out;
}

export async function GET() {
  const t0 = Date.now();
  const iface = new Interface(LAUNCH_ABI);
  const selector = iface.getFunction("launchToken").selector;
  const found = [];
  let params = "", pages = 0, complete = true;

  try {
    for (; pages < MAX_PAGES; pages++) {
      if (Date.now() - t0 > DEADLINE_MS) { complete = false; break; }
      const data = await getJSON(`${API}/addresses/${FACTORY}/transactions?filter=to${params}`);
      const need = [];
      for (const tx of data.items || []) {
        if (tx.status && tx.status !== "ok") continue;
        if (tx.raw_input === undefined && tx.method && !/launchToken|a72101af/i.test(tx.method)) continue;
        need.push(tx);
      }
      // list items normally carry raw_input; fetch the few that don't
      await pool(need.filter((t) => t.raw_input === undefined), 6, async (t) => {
        t.raw_input = (await getJSON(`${API}/transactions/${t.hash}`)).raw_input;
      });
      for (const tx of need) {
        const input = tx.raw_input;
        if (!input || !input.toLowerCase().startsWith(selector)) continue;
        let p;
        try { p = iface.parseTransaction({ data: input }).args[0]; } catch (_) { continue; }
        if (!p.salt.toLowerCase().startsWith(TAG)) continue;
        found.push({ tx, p });
      }
      if (!data.next_page_params) break;
      params = "&" + new URLSearchParams(data.next_page_params).toString();
    }
  } catch (e) {
    console.error("scan failed", e);
    complete = false;
    if (!found.length) return Response.json({ error: "Explorer unavailable" }, { status: 502, headers: { "cache-control": "no-store" } });
  }

  const launches = (await pool(found, 8, async ({ tx, p }) => {
    const logs = await getJSON(`${API}/transactions/${tx.hash}/logs`);
    const mint = (logs.items || []).find((l) => l.topics && l.topics[0] === TRANSFER && l.topics[1] === ZERO_TOPIC);
    if (!mint) return null;
    const address = getAddress(mint.address.hash || mint.address);
    const tok = await getJSON(`${API}/tokens/${address}`).catch(() => ({}));
    return {
      name: p.name, symbol: p.symbol, description: p.description,
      image: okImg(p.logo), twitter: okUrl(p.socials.twitter), website: okUrl(p.socials.website),
      address, creator: (tx.from && (tx.from.hash || tx.from)) || p.creatorFeeRecipient, tx: tx.hash,
      createdAt: tx.timestamp ? Date.parse(tx.timestamp) : Date.now(),
      mcap: Number(tok.circulating_market_cap || 0) || (Number(tok.exchange_rate || 0) * Number(tok.total_supply || 0) / 10 ** Number(tok.decimals || 18)) || 0,
      holders: Number(tok.holders_count || tok.holders || 0),
    };
  })).filter(Boolean);

  return Response.json(
    { launches, pages, complete, generatedAt: Date.now(), tookMs: Date.now() - t0 },
    { headers: { "cache-control": complete ? "public, s-maxage=30, stale-while-revalidate=600" : "public, s-maxage=10, stale-while-revalidate=60" } },
  );
}
