// POST /api/upload — stores a token logo (image) or token metadata (JSON) in Vercel Blob
// and returns its public URL, which goes into the Montra launch.
//
// Setup (once): Vercel dashboard → Storage → Create → Blob (Public), connect it to this
// project, then redeploy. Works with a read-write token or with OIDC + BLOB_STORE_ID.
import { put } from "@vercel/blob";
import { blobAuth, json } from "./_blob.js";

const MAX_IMAGE = 1024 * 1024;   // 1 MB (the studio resizes to 512 px first)
const MAX_JSON = 8 * 1024;       // metadata is a few hundred bytes
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

// Trust the file's bytes, not the client's content-type header.
function sniff(b) {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

// Token metadata: a small, flat JSON object of known fields only.
const META_FIELDS = ["name", "symbol", "description", "image", "twitter", "telegram", "website", "createdOn"];
function cleanMetadata(text) {
  let o;
  try { o = JSON.parse(text); } catch (_) { return null; }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const out = {};
  for (const k of META_FIELDS) {
    if (o[k] == null || o[k] === "") continue;
    if (typeof o[k] !== "string" || o[k].length > 1000) return null;
    if ((k === "image" || k === "twitter" || k === "telegram" || k === "website") && !/^(https:\/\/|ipfs:\/\/)/i.test(o[k])) return null;
    out[k] = o[k];
  }
  return out.name && out.symbol ? out : null;
}

export async function POST(request) {
  const auth = blobAuth(request);
  if (!auth) return json({ error: "Image uploads aren't set up on this site yet.", code: "NO_BLOB_TOKEN" }, 503);
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_IMAGE) return json({ error: "File is larger than 1 MB." }, 413);

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length === 0) return json({ error: "Nothing received." }, 400);
  if (bytes.length > MAX_IMAGE) return json({ error: "File is larger than 1 MB." }, 413);

  let path, body, type;
  if ((request.headers.get("content-type") || "").startsWith("application/json")) {
    if (bytes.length > MAX_JSON) return json({ error: "Metadata is too large." }, 413);
    const meta = cleanMetadata(new TextDecoder().decode(bytes));
    if (!meta) return json({ error: "Invalid token metadata." }, 400);
    path = "metadata/token.json"; body = JSON.stringify(meta); type = "application/json";
  } else {
    type = sniff(bytes);
    if (!type) return json({ error: "Only PNG, JPEG, WebP or GIF images are allowed." }, 415);
    path = `logos/logo.${EXT[type]}`; body = Buffer.from(bytes);
  }

  try {
    const blob = await put(path, body, { access: "public", contentType: type, addRandomSuffix: true, cacheControlMaxAge: 31536000, ...auth.options });
    return json({ url: blob.url });
  } catch (e) {
    console.error("upload failed", e);
    return json({ error: "Upload failed. Please try again.", code: "BLOB_ERROR", detail: String((e && e.message) || e).slice(0, 200) }, 502);
  }
}

// GET /api/upload → quick health check: open it in a browser to see if uploads are on
export function GET(request) {
  const auth = blobAuth(request);
  return json({
    enabled: !!auth && (auth.kind !== "oidc" || auth.oidc),
    auth: auth ? auth.kind : null,
    variable: auth ? auth.variable : null,
    oidcToken: auth && auth.kind === "oidc" ? auth.oidc : undefined,
    hint: !auth
      ? "No Blob store found. Connect a Vercel Blob store to this project (Storage → Blob → Connect), then redeploy."
      : auth.kind === "oidc" && !auth.oidc
      ? "Blob store found, but no Vercel OIDC token reached the function. Check Settings → Security → OIDC Federation is enabled, then redeploy."
      : "Uploads are ready.",
  });
}
