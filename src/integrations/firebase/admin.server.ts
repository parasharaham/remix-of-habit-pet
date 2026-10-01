/**
 * Server-only Firebase access that works on Cloudflare Workers.
 *
 * `firebase-admin` needs Node internals, so we sign a service-account JWT with
 * Web Crypto, exchange it for an OAuth access token, and call the Firestore
 * REST API directly. Security rules are bypassed — verify the caller first.
 */

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const SCOPES = [
  "https://www.googleapis.com/auth/datastore",
  "https://www.googleapis.com/auth/firebase",
  "https://www.googleapis.com/auth/identitytoolkit",
].join(" ");

let cachedToken: { token: string; expiresAt: number } | undefined;

function readServiceAccount(): ServiceAccount {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
  const sa = JSON.parse(raw) as ServiceAccount;
  if (!sa.client_email || !sa.private_key || !sa.project_id) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing required fields");
  }
  return sa;
}

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signJwt(sa: ServiceAccount, claims: Record<string, unknown>): Promise<string> {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify(claims));
  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(sig)}`;
}

export async function getGoogleAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const sa = readServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const assertion = await signJwt(sa, {
    iss: sa.client_email,
    scope: SCOPES,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  });
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed [${res.status}]: ${text}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

/**
 * Mint a Firebase custom token so a user signed in elsewhere can be signed in
 * to Firebase with the same uid (used during the cut-over).
 */
export async function createFirebaseCustomToken(uid: string, claims?: Record<string, unknown>) {
  const sa = readServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  return signJwt(sa, {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 3600,
    uid,
    ...(claims ? { claims } : {}),
  });
}

// ---------- Firestore REST ----------

type FsValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } };

export function toFs(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  if (typeof v === "object") {
    const fields: Record<string, FsValue> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val !== undefined) fields[k] = toFs(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

export function fromFs(v: any): unknown {
  if (!v || typeof v !== "object") return null;
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(fromFs);
  if ("mapValue" in v) return fieldsToObject(v.mapValue.fields ?? {});
  return null;
}

function fieldsToObject(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(fields)) out[k] = fromFs(val);
  return out;
}

function docsBase(): string {
  const sa = readServiceAccount();
  return `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
}

async function fsFetch(url: string, init?: RequestInit) {
  const token = await getGoogleAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), authorization: `Bearer ${token}`, "content-type": "application/json" },
  });
  return res;
}

export async function fsGetDoc<T = Record<string, unknown>>(path: string): Promise<(T & { id: string }) | null> {
  const res = await fsFetch(`${docsBase()}/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore get failed [${res.status}]: ${await res.text()}`);
  const json = (await res.json()) as { name: string; fields?: Record<string, unknown> };
  return { id: json.name.split("/").pop()!, ...(fieldsToObject(json.fields ?? {}) as T) };
}

/** Create or merge-update a document. */
export async function fsSetDoc(path: string, data: Record<string, unknown>, merge = true): Promise<void> {
  const fields = (toFs(data) as { mapValue: { fields: Record<string, FsValue> } }).mapValue.fields;
  const params = new URLSearchParams();
  if (merge) for (const k of Object.keys(fields)) params.append("updateMask.fieldPaths", k);
  const qs = params.toString();
  const res = await fsFetch(`${docsBase()}/${path}${qs ? `?${qs}` : ""}`, {
    method: "PATCH",
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Firestore write failed [${res.status}]: ${await res.text()}`);
}

export async function fsDeleteDoc(path: string): Promise<void> {
  const res = await fsFetch(`${docsBase()}/${path}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`Firestore delete failed [${res.status}]: ${await res.text()}`);
}

/** Simple equality query on one collection. */
export async function fsQueryEq<T = Record<string, unknown>>(
  collection: string,
  field: string,
  value: unknown,
  limit = 500,
): Promise<Array<T & { id: string }>> {
  const res = await fsFetch(`${docsBase()}:runQuery`, {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: toFs(value) } },
        limit,
      },
    }),
  });
  if (!res.ok) throw new Error(`Firestore query failed [${res.status}]: ${await res.text()}`);
  const rows = (await res.json()) as Array<{ document?: { name: string; fields?: Record<string, unknown> } }>;
  return rows
    .filter((r) => r.document)
    .map((r) => ({ id: r.document!.name.split("/").pop()!, ...(fieldsToObject(r.document!.fields ?? {}) as T) }));
}
