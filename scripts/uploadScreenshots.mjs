// One-off: uploads app-store-prep/screenshots/*.png to App Store Connect as
// 6.9" iPhone display screenshots on the given localization. Reuses the same
// JWT (ES256) auth approach as appStoreConnect.mjs, extended with the raw
// PUT-to-pre-signed-URL + checksum-commit flow the appScreenshots resource
// needs (not just JSON request/response like every other resource this repo
// has scripted against so far).
//
// Usage: ASC_KEY_ID=... ASC_ISSUER_ID=... ASC_KEY_PATH=... node scripts/uploadScreenshots.mjs <localizationId> <file1.png> [file2.png ...]
import { readFileSync } from 'fs';
import { createSign, createHash } from 'crypto';
import { basename } from 'path';

const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;
const KEY_PATH = process.env.ASC_KEY_PATH;
if (!KEY_ID || !ISSUER_ID || !KEY_PATH) {
  console.error('Missing ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH env vars');
  process.exit(1);
}

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
  const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${base64url(signature)}`;
}

async function api(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${makeToken()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    console.error(`HTTP ${res.status}`, JSON.stringify(json, null, 2));
    throw new Error(`API error: ${method} ${path}`);
  }
  return json;
}

const [, , localizationId, ...files] = process.argv;
if (!localizationId || files.length === 0) {
  console.error('Usage: node scripts/uploadScreenshots.mjs <localizationId> <file1.png> [file2.png ...]');
  process.exit(1);
}

async function main() {
  let setId;
  if (localizationId === '--set') {
    setId = files.shift();
    console.log(`Reusing existing appScreenshotSet ${setId}...`);
  } else {
    console.log(`Creating appScreenshotSet (6.9" iPhone, API enum APP_IPHONE_67) for localization ${localizationId}...`);
    const setRes = await api('POST', '/v1/appScreenshotSets', {
      data: {
        type: 'appScreenshotSets',
        attributes: { screenshotDisplayType: 'APP_IPHONE_67' },
        relationships: {
          appStoreVersionLocalization: {
            data: { type: 'appStoreVersionLocalizations', id: localizationId },
          },
        },
      },
    });
    setId = setRes.data.id;
    console.log(`  -> set id: ${setId}`);
  }

  for (const file of files) {
    const data = readFileSync(file);
    const fileName = basename(file);
    const checksum = createHash('md5').update(data).digest('hex');
    console.log(`\n[${fileName}] ${data.length} bytes, md5=${checksum}`);

    const createRes = await api('POST', '/v1/appScreenshots', {
      data: {
        type: 'appScreenshots',
        attributes: { fileName, fileSize: data.length },
        relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } },
      },
    });
    const screenshotId = createRes.data.id;
    const ops = createRes.data.attributes.uploadOperations;
    console.log(`  created ${screenshotId}, ${ops.length} upload operation(s)`);

    for (const op of ops) {
      const headers = {};
      for (const h of op.requestHeaders) headers[h.name] = h.value;
      const chunk = data.subarray(op.offset, op.offset + op.length);
      const putRes = await fetch(op.url, { method: op.method, headers, body: chunk });
      if (!putRes.ok) {
        throw new Error(`Upload PUT failed for ${fileName}: HTTP ${putRes.status} ${await putRes.text()}`);
      }
    }
    console.log('  uploaded bytes, committing...');

    await api('PATCH', `/v1/appScreenshots/${screenshotId}`, {
      data: {
        type: 'appScreenshots',
        id: screenshotId,
        attributes: { sourceFileChecksum: checksum, uploaded: true },
      },
    });

    // Poll briefly for Apple's own asset processing to confirm the upload.
    let state = 'AWAITING_UPLOAD';
    for (let i = 0; i < 10 && state !== 'COMPLETE' && state !== 'FAILED'; i++) {
      await new Promise(r => setTimeout(r, 1500));
      const check = await api('GET', `/v1/appScreenshots/${screenshotId}`);
      state = check.data.attributes.assetDeliveryState.state;
    }
    console.log(`  assetDeliveryState: ${state}`);
  }

  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
