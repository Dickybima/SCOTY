// POST /api/upload — stores a token logo in Vercel Blob and returns its public URL.
//
// Pons keeps a token's logo on-chain as a string of at most 512 bytes, so the image
// itself can't go on-chain. The studio uploads it here and stores the short URL instead.
//
// Setup (once): Vercel dashboard → Storage → Create → Blob (Public), connect it to this
// project, then redeploy. Works with a read-write token or with OIDC + BLOB_STORE_ID.
import { put } from "@vercel/blob";

const MAX_BYTES = 1024 * 1024; // 1 MB (the studio resizes to 512 px WebP first)
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

// Blob credentials, in either of the two ways Vercel connects a store:
//  1. a read-write token (BLOB_READ_WRITE_TOKEN, or a custom-prefixed name; the value
//     always starts with vercel_blob_rw_), or
//  2. OIDC: the store id (BLOB_STORE_ID, value starts with store_) plus the Vercel OIDC
//     token, which Vercel sends to the function in the x-vercel-oidc-token header.
function blobAuth(request) {
  const env = process.env;
  let rw = env.BLOB_READ_WRITE_TOKEN ? { name: "BLOB_READ_WRITE_TOKEN", value: env.BLOB_READ_WRITE_TOKEN } : null;
  if (!rw) for (const [name, value] of Object.entries(env)) if (typeof value === "string" && value.startsWith("vercel_blob_rw_")) { rw = { name, value }; break; }
  if (rw) return { kind: "read-write token", variable: rw.name, options: { token: rw.value } };

  let store = env.BLOB_STORE_ID ? { name: "BLOB_STORE_ID", value: env.BLOB_STORE_ID } : null;
  if (!store) for (const [name, value] of Object.entries(env)) if (/STORE_ID$/.test(name) && typeof value === "string" && value.startsWith("store_")) { store = { name, value }; break; }
  if (store) {
    const oidc = (request && request.headers.get("x-vercel-oidc-token")) || env.VERCEL_OIDC_TOKEN || "";
    return { kind: "oidc", variable: store.name, oidc: !!oidc, options: { storeId: store.value, ...(oidc ? { oidcToken: oidc } : {}) } };
  }
  return null;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(request) {
  const auth = blobAuth(request);
  if (!auth) {
    return json({ error: "Image uploads aren't set up on this site yet.", code: "NO_BLOB_TOKEN" }, 503);
  }
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) return json({ error: "Image is larger than 1 MB." }, 413);

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length === 0) return json({ error: "No image received." }, 400);
  if (bytes.length > MAX_BYTES) return json({ error: "Image is larger than 1 MB." }, 413);

  const type = sniff(bytes);
  if (!type) return json({ error: "Only PNG, JPEG, WebP or GIF images are allowed." }, 415);

  try {
    const blob = await put(`logos/logo.${EXT[type]}`, Buffer.from(bytes), {
      access: "public",
      contentType: type,
      addRandomSuffix: true,
      cacheControlMaxAge: 31536000,
      ...auth.options,
    });
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
