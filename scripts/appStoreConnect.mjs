// Minimal App Store Connect API client — JWT (ES256) auth using only Node's
// built-in crypto module, no external dependencies. Credentials are never
// hardcoded here; read from env vars so the key file itself stays outside
// this git repo entirely.
//
// Usage: ASC_KEY_ID=... ASC_ISSUER_ID=... ASC_KEY_PATH=... node scripts/appStoreConnect.mjs <METHOD> <path> [jsonBodyFile]
// Example: node scripts/appStoreConnect.mjs GET /v1/apps
import { readFileSync } from 'fs';
import { createSign } from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;
const KEY_PATH = process.env.ASC_KEY_PATH;
if (!KEY_ID || !ISSUER_ID || !KEY_PATH) {
  console.error('Missing ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH env vars');
  process.exit(1);
}

// Works for both a string (header/payload JSON) and a Buffer (the binary signature).
function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeToken() {
  const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 1190, aud: 'appstoreconnect-v1' };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const privateKey = readFileSync(KEY_PATH, 'utf-8');
  const signer = createSign('sha256');
  signer.update(signingInput);
  signer.end();
  // JWS ES256 needs the raw (R||S) signature format, not DER — Node's
  // 'ieee-p1363' encoding option produces exactly that.
  const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${base64url(signature)}`;
}

const [, , method, path, bodyFile] = process.argv;
if (!method || !path) {
  console.error('Usage: node scripts/appStoreConnect.mjs <METHOD> <path> [jsonBodyFile]');
  process.exit(1);
}

const token = makeToken();
const url = `https://api.appstoreconnect.apple.com${path}`;
const init = {
  method,
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
};
if (bodyFile) init.body = readFileSync(bodyFile, 'utf-8');

const res = await fetch(url, init);
const text = await res.text();
console.log(`HTTP ${res.status}`);
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}
if (!res.ok) process.exit(1);
