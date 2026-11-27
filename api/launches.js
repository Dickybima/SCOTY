// /api/launches — the index of tokens launched through SCOTY on Montra (Elysium).
//
//   GET                → { launches: [...] }   (CDN-cached for a few seconds)
//   POST { tx: 0x… }   → verifies that transaction on-chain and adds the launch
//
// A launch is accepted only if the transaction succeeded, called the Montra
// LaunchFactory's launch(), and its salt starts with the SCOTY marker. Everything
// stored is read from the chain (the calldata, the TokenLaunched event and the
// pool's Initialize event), never from the request. The index lives in Vercel Blob.
import { Interface, JsonRpcProvider, getAddress, isHexString } from "ethers";
import { get, put, BlobPreconditionFailedError } from "@vercel/blob";
import { blobAuth, json } from "./_blob.js";

const CHAIN_ID = 99901;
const RPC = process.env.ELYSIUM_RPC || "https://rpc-elysium-mainnet.t.conduit.xyz";
const FACTORY = "0x38d3ef3a06d18fa3286fb5deafe611be725fcd15";
const POOL_MANAGER = "0xe2e105d3f7209a9da11f83ccf3e7398a753823f1";
const TAG = "0x53434f5459"; // "SCOTY" — must match launchTag in js/config.js
const INDEX = "scoty/launches.json";

const factoryI = new Interface([
  "function launch((string name, string symbol, string metadataURI, (string logo, string description, (string telegram, string twitter, string discord, string website, string extra) socials) profile, uint256 configId, uint256 supply, bytes32 salt, address[] feeRecipients, uint16[] feeShares, uint256 firstBuyAmount, uint256 firstBuyMinOut, (uint256 deadline, uint8 v, bytes32 r, bytes32 s) permit) p) payable returns (address token, bytes32 poolId)",
  "event TokenLaunched(address indexed token, address indexed creator, bytes32 indexed poolId, uint256 configId, address quote, bool quoteIsCurrency0, uint256 supply, int24 startTick, address feeRecipient, bool feeLocked, uint256 firstBuyIn, uint256 firstBuyOut)",
]);
const pmI = new Interface([
  "event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)",
]);

const okUrl = (u) => (typeof u === "string" && /^(https:\/\/|ipfs:\/\/)/i.test(u) && u.length <= 512 ? u : null);
const okImg = (u) => (typeof u === "string" && (/^(https:\/\/|ipfs:\/\/)/i.test(u) || /^data:image\/(png|jpe?g|webp|gif|svg\+xml)[;,]/i.test(u)) && u.length <= 2048 ? u : null);

async function readIndex(auth) {
  const r = await get(INDEX, { access: "public", useCache: false, ...auth.options }).catch((e) => {
    if (e && /not.?found/i.test(e.name + e.message)) return null;
    throw e;
  });
  if (!r || r.statusCode !== 200) return { launches: [], etag: null };
  const text = await new Response(r.stream).text();
  let data = {};
  try { data = JSON.parse(text); } catch (_) {}
  return { launches: Array.isArray(data.launches) ? data.launches : [], etag: r.blob.etag };
}

async function writeIndex(auth, launches, etag) {
  return put(INDEX, JSON.stringify({ updatedAt: Date.now(), launches }), {
    access: "public", contentType: "application/json", addRandomSuffix: false, cacheControlMaxAge: 60,
    ...(etag ? { ifMatch: etag } : { allowOverwrite: true }), ...auth.options,
  });
}

// Read a launch from the chain; throws a message the studio can show.
async function verifyLaunch(hash) {
  const rpc = new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
  const [tx, rc] = await Promise.all([rpc.getTransaction(hash), rpc.getTransactionReceipt(hash)]);
  if (!tx || !rc) throw new Error("Transaction not found yet. Try again in a few seconds.");
  if (rc.status !== 1) throw new Error("That transaction failed.");
  if (!tx.to || tx.to.toLowerCase() !== FACTORY) throw new Error("Not a Montra launch.");
  let p;
  try { p = factoryI.parseTransaction({ data: tx.data, value: tx.value }).args[0]; } catch (_) { throw new Error("Not a Montra launch."); }
  if (!p.salt.toLowerCase().startsWith(TAG)) throw new Error("Not launched through SCOTY.");

  let ev = null, init = null;
  for (const log of rc.logs) {
    const a = log.address.toLowerCase();
    try {
      if (a === FACTORY) { const x = factoryI.parseLog(log); if (x && x.name === "TokenLaunched") ev = x.args; }
      else if (a === POOL_MANAGER) { const x = pmI.parseLog(log); if (x && x.name === "Initialize") init = x.args; }
    } catch (_) {}
  }
  if (!ev) throw new Error("Launch event not found.");
  if (init && init.id !== ev.poolId) init = null;
  const block = await rpc.getBlock(rc.blockNumber);
  const prof = p.profile;
  return {
    address: getAddress(ev.token),
    name: p.name, symbol: p.symbol,
    description: String(prof.description || "").slice(0, 1000),
    image: okImg(prof.logo), metadataURI: okUrl(p.metadataURI),
    twitter: okUrl(prof.socials.twitter), telegram: okUrl(prof.socials.telegram), website: okUrl(prof.socials.website),
    creator: getAddress(ev.creator), feeRecipient: getAddress(ev.feeRecipient),
    poolId: ev.poolId, configId: Number(ev.configId), quote: getAddress(ev.quote), quoteIsCurrency0: ev.quoteIsCurrency0,
    supply: ev.supply.toString(), firstBuyIn: ev.firstBuyIn.toString(),
    key: init ? { currency0: getAddress(init.currency0), currency1: getAddress(init.currency1), fee: Number(init.fee), tickSpacing: Number(init.tickSpacing), hooks: getAddress(init.hooks) } : null,
    tx: hash, block: rc.blockNumber, createdAt: block ? block.timestamp * 1000 : Date.now(),
  };
}

export async function GET(request) {
  const auth = blobAuth(request);
  if (!auth) return json({ launches: [], note: "Index storage not configured" }, 200, { "cache-control": "public, s-maxage=30" });
  try {
    const { launches } = await readIndex(auth);
    launches.sort((a, b) => b.createdAt - a.createdAt);
    return json({ launches, generatedAt: Date.now() }, 200, { "cache-control": "public, s-maxage=5, stale-while-revalidate=120" });
  } catch (e) {
    console.error("index read failed", e);
    return json({ error: "Index unavailable" }, 502);
  }
}

export async function POST(request) {
  const auth = blobAuth(request);
  if (!auth) return json({ error: "Index storage not configured" }, 503);
  let body = {};
  try { body = await request.json(); } catch (_) {}
  const hash = String(body.tx || "");
  if (!isHexString(hash, 32)) return json({ error: "Send { tx: <launch transaction hash> }" }, 400);

  let entry;
  try { entry = await verifyLaunch(hash.toLowerCase()); }
  catch (e) { return json({ error: e.message || "Couldn't verify that launch." }, 422); }

  for (let attempt = 0; attempt < 5; attempt++) {
    const { launches, etag } = await readIndex(auth);
    const existing = launches.find((l) => l.address.toLowerCase() === entry.address.toLowerCase());
    if (existing) return json({ ok: true, launch: existing, added: false });
    try {
      await writeIndex(auth, [entry, ...launches], etag);
      return json({ ok: true, launch: entry, added: true });
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError || /precondition/i.test(String(e && e.message))) continue; // someone wrote first; retry
      console.error("index write failed", e);
      return json({ error: "Couldn't save the launch. Try again." }, 502);
    }
  }
  return json({ error: "The index is busy. Try again." }, 503);
}
