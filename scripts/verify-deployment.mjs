import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/verify-deployment.mjs https://OWNER.github.io/csk/');
const base = new URL(input);
if (base.protocol !== 'https:' || base.pathname !== '/csk/') throw new Error('Expected the actual HTTPS /csk/ deployment URL');
const results = [];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function resource(path, kind, expected) {
  const url = new URL(path, base);
  if (url.origin !== base.origin || !url.pathname.startsWith('/csk/')) throw new Error('Resource escaped deployment scope');
  const response = await fetch(url, { redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(30000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  const type = response.headers.get('content-type') || '';
  let passed = response.status === 200 && response.url.startsWith(base.origin + '/csk/');
  if (kind === 'html') passed &&= type.includes('text/html') && bytes.toString().includes('<html');
  if (kind === 'js') passed &&= /(?:javascript|ecmascript)/i.test(type) && !bytes.toString().trimStart().startsWith('<');
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
  if (manifest.name !== '紫微斗数' || manifest.display !== 'standalone' || manifest.scope !== '/csk/' || manifest.start_url !== '/csk/') throw new Error('Live Manifest identity/scope mismatch');
  for (const icon of manifest.icons) {
    const { bytes } = await resource(icon.src, 'png');
    if (icon.sizes !== `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`) throw new Error(`PNG dimensions mismatch: ${icon.src}`);
  }
  await resource('icons/apple-touch-icon.png', 'png');
  const worker = await resource('sw.js', 'js');
  if (!worker.bytes.toString().includes('const BASE = "/csk";')) throw new Error('SW base path mismatch');
  const { bytes } = await resource('precache-manifest.json', 'json');
  const precache = JSON.parse(bytes.toString());
  if (precache.basePath !== '/csk' || !Array.isArray(precache.entries) || !precache.entries.some(e => e.url === '/csk/')) throw new Error('Precache scope/core mismatch');
  for (let index = 0; index < precache.entries.length; index += 5) {
    const batch = await Promise.allSettled(precache.entries.slice(index, index + 5).map(entry => resource(entry.url, entry.url.endsWith('.js') ? 'js' : entry.url.endsWith('.png') ? 'png' : 'asset', entry.sha256)));
    for (const item of batch) if (item.status === 'rejected') failures.push(String(item.reason));
  }
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
