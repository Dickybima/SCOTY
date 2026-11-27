// Shared Vercel Blob credentials for the functions in /api (files starting with _ are not routes).
//
// A store connects to a project in one of two ways:
//  1. a read-write token (BLOB_READ_WRITE_TOKEN, or a custom-prefixed name; the value
//     always starts with vercel_blob_rw_), or
//  2. OIDC: the store id (BLOB_STORE_ID, value starts with store_) plus the Vercel OIDC
//     token, which Vercel sends to the function in the x-vercel-oidc-token header.
export function blobAuth(request) {
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

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
