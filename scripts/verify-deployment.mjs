import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createWorkerSource } from './build-pwa.mjs';

const input = process.argv[2];
const artifactDirectory = process.argv[3];
if (!input || !artifactDirectory) throw new Error('Usage: node scripts/verify-deployment.mjs https://OWNER.github.io/csk/ ACTUAL_ACTIONS_ARTIFACT_DIRECTORY');
const base = new URL(input);
if (base.protocol !== 'https:' || base.pathname !== '/csk/') throw new Error('Expected the actual HTTPS /csk/ deployment URL');
const results = [];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const artifact = name => readFileSync(path.join(artifactDirectory, name));
async function resource(relativePath, kind, expected, strictRedirect = false) {
  const url = new URL(relativePath, base);
  if (url.origin !== base.origin || !url.pathname.startsWith('/csk/')) throw new Error('Resource escaped deployment scope');
  const response = await fetch(url, { redirect: strictRedirect ? 'error' : 'follow', cache: 'no-store', signal: AbortSignal.timeout(30000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  const type = response.headers.get('content-type') || '';
  let passed = response.status === 200 && response.url.startsWith(base.origin + '/csk/');
  if (kind === 'html') passed &&= type.includes('text/html') && bytes.toString().includes('<html');
  if (kind === 'js') passed &&= /(?:javascript|ecmascript)/i.test(type) && !bytes.toString().trimStart().startsWith('<');
  if (kind === 'css') passed &&= type.includes('text/css');
  if (kind === 'manifest') passed &&= /application\/(?:manifest\+json|json)/i.test(type);
  if (kind === 'json') passed &&= type.includes('application/json');
  if (kind === 'png') passed &&= type.includes('image/png') && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (expected) passed &&= sha256(bytes) === expected;
  const result = { path: url.pathname + url.search, status: response.status, contentType: type, bytes: bytes.length, passed, ...(expected ? { sha256: sha256(bytes), expectedSha256: expected } : {}) };
  results.push(result);
  if (!passed) throw new Error(`Live check failed: ${JSON.stringify(result)}`);
  return { bytes, response };
}
const failures = [];
try {
  for (const page of ['', 'chart/', 'library/', 'library/search/?q=%E7%B4%AB%E5%BE%AE', 'knowledge/', 'heming/', 'privacy/', 'terms/']) {
    await resource(page, 'html');
  }
  const manifestResponse = await resource('manifest.webmanifest', 'manifest');
  const manifest = JSON.parse(manifestResponse.bytes.toString());
  if (!isDeepStrictEqual(manifest, JSON.parse(artifact('manifest.webmanifest')))) throw new Error('Live Manifest differs from the actual Actions artifact');
  if (manifest.name !== '紫微斗数' || manifest.display !== 'standalone' || manifest.id !== '/csk/' || manifest.scope !== '/csk/' || manifest.start_url !== '/csk/') throw new Error('Live Manifest identity/scope mismatch');
  for (const size of ['192x192', '512x512']) if (!manifest.icons?.some(icon => icon.sizes === size && icon.type === 'image/png' && (icon.purpose || 'any').split(' ').includes('any'))) throw new Error(`Required app icon missing: ${size}`);
  if (!manifest.icons.some(icon => icon.sizes === '512x512' && icon.type === 'image/png' && icon.purpose?.split(' ').includes('maskable'))) throw new Error('Maskable icon missing');
  for (const icon of manifest.icons) {
    const { bytes } = await resource(icon.src, 'png');
    if (icon.sizes !== `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`) throw new Error(`PNG dimensions mismatch: ${icon.src}`);
  }
  const apple = await resource('icons/apple-touch-icon.png', 'png');
  if (apple.bytes.readUInt32BE(16) !== 180 || apple.bytes.readUInt32BE(20) !== 180) throw new Error('Apple touch icon must be 180x180');
  const worker = await resource('sw.js', 'js', sha256(artifact('sw.js')), true);
  const { bytes } = await resource('precache-manifest.json', 'json');
  const precache = JSON.parse(bytes.toString());
  if (!isDeepStrictEqual(precache, JSON.parse(artifact('precache-manifest.json')))) throw new Error('Live precache differs from the actual Actions artifact');
  if (precache.basePath !== '/csk' || !Array.isArray(precache.entries) || !precache.entries.some(e => e.url === '/csk/') || !precache.entries.some(e => e.url === '/csk/chart/')) throw new Error('Precache scope/core mismatch');
  const urls = new Set();
  for (const entry of precache.entries) {
    if (typeof entry.url !== 'string' || !entry.url.startsWith('/csk/') || urls.has(entry.url) || !/^[0-9a-f]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0) throw new Error('Malformed/duplicate core resource');
    urls.add(entry.url);
  }
  if (!precache.entries.some(e => e.url.endsWith('.js')) || !precache.entries.some(e => e.url.endsWith('.css')) || sha256(JSON.stringify(precache.entries)).slice(0, 20) !== precache.version) throw new Error('Incomplete core resources or invalid version hash');
  if (worker.bytes.toString() !== createWorkerSource(precache)) throw new Error('SW does not match the deployed manifest/template');
  for (let index = 0; index < precache.entries.length; index += 5) {
    const batch = await Promise.allSettled(precache.entries.slice(index, index + 5).map(entry => resource(entry.url, entry.url.endsWith('.js') ? 'js' : entry.url.endsWith('.css') ? 'css' : entry.url.endsWith('.png') ? 'png' : 'asset', entry.sha256)));
    for (const item of batch) if (item.status === 'rejected') failures.push(String(item.reason));
  }
  if (failures.length) throw new Error('Some live core resources failed; no successful deployment verification is reported');
  await resource('LICENSE.txt', 'text');
  await resource('THIRD_PARTY_NOTICES.txt', 'text');
  results.push({ check: 'Manifest standalone, icon dimensions and Service Worker scope', passed: true });
  console.log(`Live deployment ${precache.version}: ${precache.entries.length} core resource hashes verified.`);
} catch (error) { failures.push(String(error)); }
mkdirSync('docs/deploy-evidence', { recursive: true });
writeFileSync('docs/deploy-evidence/live-resources.json', JSON.stringify({ url: base.href, checkedAt: new Date().toISOString(), results, failures, passed: failures.length === 0 }, null, 2) + '\n');
console.log(`${results.filter(r => r.passed).length} live resource checks passed; ${failures.length} failures.`);
for (const failure of failures) console.error(failure);
if (failures.length) process.exitCode = 1;
