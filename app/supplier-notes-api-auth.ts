/** A separate, revocable automation credential; never a browser session. */
export function isSupplierNotesApiScope(pathname: string, method: string) {
  if (pathname === "/api/supplier-notes") return method === "GET" || method === "POST";
  if (pathname === "/api/supplier-notes/masters") return method === "GET";
  return method === "GET" && /^\/supplier\/nota-supplier\/download\/[^/]+$/.test(pathname);
}

export async function validateSupplierNotesApiToken(
  authorization: string | null,
  tokenHash: string | undefined,
  expiresAt: string | undefined,
  now = Date.now(),
) {
  if (!tokenHash || !/^[a-f0-9]{64}$/i.test(tokenHash)) return false;
  const expiry = expiresAt ? Date.parse(expiresAt) : NaN;
  if (!Number.isFinite(expiry) || expiry <= now) return false;
  const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43,256})$/i);
  if (!match) return false;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(match[1])));
  let mismatch = 0;
  for (let i = 0; i < digest.length; i++) {
    mismatch |= digest[i] ^ Number.parseInt(tokenHash.slice(i * 2, i * 2 + 2), 16);
  }
  return mismatch === 0;
}
