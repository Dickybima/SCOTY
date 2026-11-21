// POST /api/upload — stores a token logo in Vercel Blob and returns its public URL.
//
// Pons keeps a token's logo on-chain as a string of at most 512 bytes, so the image
// itself can't go on-chain. The studio uploads it here and stores the short URL instead.
//
// Setup (once): Vercel dashboard → Storage → Create → Blob, connect it to this project.
// That adds the BLOB_READ_WRITE_TOKEN environment variable. Redeploy afterwards.
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

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return json({ error: "Image uploads aren't set up on this site yet. Paste an image link instead." }, 503);
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
    });
    return json({ url: blob.url });
  } catch (e) {
    console.error("upload failed", e);
    return json({ error: "Upload failed. Please try again." }, 502);
  }
}

// GET /api/upload → whether uploads are configured (the studio uses this to show the button)
export function GET() {
  return json({ enabled: !!process.env.BLOB_READ_WRITE_TOKEN });
}
