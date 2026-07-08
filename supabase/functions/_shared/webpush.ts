// Web Push — VAPID JWT (RFC 8292) + ECE aes128gcm (RFC 8291).
// Pure WebCrypto, zero dependencies. Runs on Deno Deploy.

// ── Helpers ────────────────────────────────────────────────────

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function u16be(n: number): Uint8Array {
  return new Uint8Array([(n >> 8) & 0xff, n & 0xff]);
}

function u32be(n: number): Uint8Array {
  return new Uint8Array([(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
}

const enc = new TextEncoder();

// ── VAPID JWT (RFC 8292) ───────────────────────────────────────

/** Import a raw 32-byte VAPID private key as ECDSA P-256. */
async function importVapidPrivateKey(raw: Uint8Array): Promise<CryptoKey> {
  // Build JWK from raw 32-byte d + we need to derive the public point.
  // Easier: import as PKCS8. But raw is just "d". Use JWK import.
  // We need x,y from d. Derive via crypto.subtle.
  // Actually the simplest: import raw d as JWK with x,y computed.
  // But WebCrypto can't derive x,y from d alone without an import.
  // Solution: import raw private key bytes via a JWK where x,y are derived
  // from a key generation roundtrip. But we don't have x,y at this point.
  //
  // Better approach: accept the private key as base64url-encoded 32-byte scalar,
  // and the public key as base64url-encoded 65-byte uncompressed point.
  // The caller provides both (from secrets). This avoids point derivation.
  throw new Error("Use importVapidKeys instead");
}

interface VapidKeys {
  privateKey: CryptoKey;
  publicKeyBytes: Uint8Array; // 65 bytes, uncompressed
}

/**
 * Import VAPID keys from base64url-encoded strings.
 * @param privateB64 - 32-byte private scalar, base64url
 * @param publicB64 - 65-byte uncompressed public point, base64url
 */
async function importVapidKeys(privateB64: string, publicB64: string): Promise<VapidKeys> {
  const privBytes = b64urlDecode(privateB64);
  const pubBytes = b64urlDecode(publicB64);

  // Extract x, y from uncompressed public key (04 || x || y)
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new Error("VAPID public key must be 65 bytes uncompressed (04 || x || y)");
  }
  const x = b64url(pubBytes.slice(1, 33));
  const y = b64url(pubBytes.slice(33, 65));
  const d = b64url(privBytes);

  const jwk: JsonWebKey = {
    kty: "EC", crv: "P-256", x, y, d, ext: true,
  };

  const privateKey = await crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );

  return { privateKey, publicKeyBytes: pubBytes };
}

/** Create a signed VAPID Authorization header (RFC 8292). */
async function createVapidAuth(
  endpoint: string,
  keys: VapidKeys,
  subject: string,
  expSeconds = 86400,
): Promise<{ authorization: string; cryptoKey: string }> {
  const url = new URL(endpoint);
  const aud = `${url.protocol}//${url.host}`;
  const exp = Math.floor(Date.now() / 1000) + expSeconds;

  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(enc.encode(JSON.stringify({ aud, exp, sub: subject })));
  const input = enc.encode(`${header}.${payload}`);

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, keys.privateKey, input,
  );

  // WebCrypto returns DER-encoded signature. Convert to raw r||s (64 bytes).
  const rawSig = derToRaw(new Uint8Array(sig));
  const token = `${header}.${payload}.${b64url(rawSig)}`;

  return {
    authorization: `vapid t=${token}, k=${b64url(keys.publicKeyBytes)}`,
    cryptoKey: `p256ecdsa=${b64url(keys.publicKeyBytes)}`,
  };
}

/** Convert DER-encoded ECDSA signature to raw r||s (64 bytes). */
function derToRaw(der: Uint8Array): Uint8Array {
  // DER: 0x30 <len> 0x02 <rLen> <r> 0x02 <sLen> <s>
  // Some WebCrypto implementations return raw 64 bytes directly.
  if (der.length === 64) return der;

  const raw = new Uint8Array(64);
  let offset = 2; // skip 0x30 <len>

  // r
  offset++; // skip 0x02
  const rLen = der[offset++];
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen < 32 ? 32 - rLen : 0;
  raw.set(der.slice(rStart, offset + rLen), rDest);
  offset += rLen;

  // s
  offset++; // skip 0x02
  const sLen = der[offset++];
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen < 32 ? 64 - sLen : 32;
  raw.set(der.slice(sStart, offset + sLen), sDest);

  return raw;
}

// ── ECE aes128gcm (RFC 8291) ───────────────────────────────────

interface PushSubscription {
  endpoint: string;
  p256dh: string;   // base64url, 65 bytes uncompressed
  authKey: string;  // base64url, 16 bytes
}

/** HKDF-SHA256 extract + expand (RFC 5869). */
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  // Extract
  const key = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));

  // Expand
  const infoKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const t = new Uint8Array(await crypto.subtle.sign("HMAC", infoKey, concat(info, new Uint8Array([1]))));
  return t.slice(0, length);
}

function createInfo(
  type: string,
  clientPublic: Uint8Array,
  serverPublic: Uint8Array,
): Uint8Array {
  // "Content-Encoding: <type>\0"
  // + "P-256\0"
  // + <2-byte client key length> + <client key>
  // + <2-byte server key length> + <server key>
  const typeBytes = enc.encode(`Content-Encoding: ${type}\0`);
  const p256 = enc.encode("P-256\0");
  return concat(
    typeBytes,
    p256,
    u16be(clientPublic.length), clientPublic,
    u16be(serverPublic.length), serverPublic,
  );
}

/**
 * Encrypt a payload for Web Push using aes128gcm (RFC 8188 + RFC 8291).
 * Returns the full encrypted body ready to POST.
 */
async function encryptPayload(
  sub: PushSubscription,
  payload: Uint8Array,
): Promise<{ body: Uint8Array; localPublicKey: Uint8Array }> {
  const clientPublicBytes = b64urlDecode(sub.p256dh);
  const clientAuthBytes = b64urlDecode(sub.authKey);

  // Generate ephemeral ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"],
  );
  const localPublicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey),
  );

  // Import client public key
  const clientKey = await crypto.subtle.importKey(
    "raw", clientPublicBytes, { name: "ECDH", namedCurve: "P-256" }, false, [],
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey }, localKeyPair.privateKey, 256,
    ),
  );

  // IKM (RFC 8291 §3.3): HKDF(auth_secret, ecdh_secret, auth_info, 32)
  const authInfo = concat(
    enc.encode("WebPush: info\0"),
    clientPublicBytes,
    localPublicKey,
  );
  const ikm = await hkdf(clientAuthBytes, sharedSecret, authInfo, 32);

  // Salt: 16 random bytes
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // CEK: HKDF(salt, ikm, cek_info, 16)
  const cekInfo = enc.encode("Content-Encoding: aes128gcm\0");
  const cek = await hkdf(salt, ikm, cekInfo, 16);

  // Nonce: HKDF(salt, ikm, nonce_info, 12)
  const nonceInfo = enc.encode("Content-Encoding: nonce\0");
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // Pad the plaintext: payload + 0x02 (final record delimiter)
  const padded = concat(payload, new Uint8Array([2]));

  // AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded),
  );

  // aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = u32be(padded.length + 16); // record size = plaintext + tag (16 bytes)
  const header = concat(
    salt,
    rs,
    new Uint8Array([localPublicKey.length]),
    localPublicKey,
  );

  return { body: concat(header, encrypted), localPublicKey };
}

// ── Public API ─────────────────────────────────────────────────

export interface SendResult {
  endpoint: string;
  status: number;
  ok: boolean;
  gone: boolean; // 404 or 410 → subscription should be deleted
}

let _keys: VapidKeys | null = null;

async function getKeys(): Promise<VapidKeys> {
  if (_keys) return _keys;
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  if (!priv || !pub) throw new Error("VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY not set");
  _keys = await importVapidKeys(priv, pub);
  return _keys;
}

/**
 * Send a Web Push notification to a single subscription.
 * Returns status info; caller handles cleanup of gone subscriptions.
 */
export async function sendPush(
  sub: PushSubscription,
  payloadJson: Record<string, unknown>,
  ttl = 86400,
): Promise<SendResult> {
  const keys = await getKeys();
  const vapid = await createVapidAuth(
    sub.endpoint, keys, "mailto:support@championtrackpro.com",
  );

  const raw = enc.encode(JSON.stringify(payloadJson));
  const { body } = await encryptPayload(sub, raw);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Authorization": vapid.authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": String(ttl),
      "Urgency": "high",
    },
    body,
  });

  return {
    endpoint: sub.endpoint,
    status: res.status,
    ok: res.status >= 200 && res.status < 300,
    gone: res.status === 404 || res.status === 410,
  };
}
