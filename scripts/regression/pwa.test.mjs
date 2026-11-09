import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createPrecache, createWorkerSource, normalizeBasePath, buildPwa } from '../build-pwa.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let passed = 0;
async function check(label, run) { await run(); passed++; console.log(`PASS ${label}`); }
const origin = 'https://ziwei.example';
const absolute = input => new URL(typeof input === 'string' ? input : input.url, origin).href;

function harness(manifest) {
  const listeners = new Map();
  const storage = new Map();
  const network = new Map();
  let offline = false;
  let claimed = 0;
  class MemoryCache {
    entries = new Map();
    async match(request) { return this.entries.get(absolute(request))?.clone(); }
    async put(request, response) { this.entries.set(absolute(request), response.clone()); }
    async delete(request) { return this.entries.delete(absolute(request)); }
    async keys() { return [...this.entries.keys()].map(url => new Request(url)); }
  }
  const caches = {
    async open(name) { if (!storage.has(name)) storage.set(name, new MemoryCache()); return storage.get(name); },
    async keys() { return [...storage.keys()]; },
    async delete(name) { return storage.delete(name); },
  };
  class WorkerRequest extends Request {
    constructor(input, init) { super(absolute(input), init); }
  }
  const self = { location: { origin }, clients: { async claim() { claimed++; } }, addEventListener: (type, listener) => listeners.set(type, listener) };
  const fetch = async request => {
    if (offline) throw new TypeError('Network unavailable');
    const body = network.get(absolute(request));
    if (body === undefined) return new Response('missing', { status: 404 });
    return body instanceof Response ? body.clone() : new Response(body);
  };
  const context = vm.createContext({ self, caches, fetch, URL, Request: WorkerRequest, Response, crypto: webcrypto, Uint8Array, console });
  vm.runInContext(createWorkerSource(manifest), context);
  const dispatch = async (type, props = {}) => {
    const pending = [];
    let response;
    const event = { ...props, waitUntil(promise) { pending.push(promise); }, respondWith(promise) { response = promise; } };
    listeners.get(type)(event);
    let result;
    if (response) result = await response;
    let index = 0;
    while (index < pending.length) await pending[index++];
    return result;
  };
  return { storage, caches, network, dispatch, setOffline(value) { offline = value; }, claimed: () => claimed };
}

const temporary = await mkdtemp(path.join(os.tmpdir(), 'ziwei-pwa-test-'));
try {
  const fixtures = {
    'index.html': '<html>home</html>', 'chart/index.html': '<html>chart</html>',
    'manifest.webmanifest': '{}', 'icons/icon-192.png': 'icon192', 'icons/icon-512.png': 'icon512',
    'icons/apple-touch-icon.png': 'apple180', '_next/static/chart.js': 'console.log("engine")',
    'chart/index.txt': 'chart flight data', 'chart/__next._tree.txt': 'chart segment tree', 'library/index.html': 'only cache after visiting',
  };
  for (const [file, body] of Object.entries(fixtures)) {
    await mkdir(path.dirname(path.join(temporary, file)), { recursive: true });
    await writeFile(path.join(temporary, file), body);
  }
  const manifest = await createPrecache(temporary);
  const createInstalled = async () => {
    const worker = harness(manifest);
    for (const entry of manifest.entries) {
      const file = entry.url === '/' ? 'index.html' : entry.url === '/chart/' ? 'chart/index.html' : entry.url.slice(1);
      worker.network.set(absolute(entry.url), fixtures[file]);
    }
    await worker.dispatch('install');
    return worker;
  };

  await check('content hash deterministic; core included, reference HTML excluded', async () => {
    assert.deepEqual(await createPrecache(temporary), manifest);
    assert.ok(manifest.entries.some(entry => entry.url === '/chart/'));
    assert.ok(manifest.entries.some(entry => entry.url === '/_next/static/chart.js'));
    assert.ok(manifest.entries.some(entry => entry.url === '/chart/__next._tree.txt'));
    assert.ok(!manifest.entries.some(entry => entry.url === '/library/index.html'));
  });

  await check('missing core build resource rejects generation', async () => {
    await rm(path.join(temporary, 'icons/apple-touch-icon.png'));
    await assert.rejects(createPrecache(temporary), /missing/);
    await writeFile(path.join(temporary, 'icons/apple-touch-icon.png'), fixtures['icons/apple-touch-icon.png']);
  });

  await check('verified install reports ready; incomplete cache reports not ready', async () => {
    const worker = await createInstalled();
    const replies = [];
    const status = () => worker.dispatch('message', { data: { type: 'CACHE_STATUS' }, ports: [{ postMessage(data) { replies.push(data); } }] });
    await status();
    assert.equal(replies.at(-1).ready, true);
    const cache = worker.storage.get(`ziwei-pwa-root-precache-${manifest.version}`);
    await cache.delete('/chart/');
    await status();
    assert.equal(replies.at(-1).ready, false);
  });

  await check('tampered core resource rejects installation and clears incomplete cache', async () => {
    const worker = harness(manifest);
    for (const entry of manifest.entries) worker.network.set(absolute(entry.url), 'tampered');
    await assert.rejects(worker.dispatch('install'), /integrity mismatch/);
    assert.ok(![...worker.storage.keys()].some(key => key.startsWith('ziwei-pwa-root-precache-')));
  });

  await check('404 core resource rejects installation', async () => {
    const worker = harness(manifest);
    await assert.rejects(worker.dispatch('install'), /unavailable/);
  });

  await check('activation removes only this app old cache', async () => {
    const worker = await createInstalled();
    await worker.caches.open('another-app-cache');
    await worker.caches.open('ziwei-pwa-root-precache-old');
    await worker.caches.open('ziwei-pwa-%2Fother-project-precache-old');
    await worker.dispatch('activate');
    assert.ok(worker.storage.has('another-app-cache'));
    assert.ok(!worker.storage.has('ziwei-pwa-root-precache-old'));
    assert.ok(worker.storage.has('ziwei-pwa-%2Fother-project-precache-old'));
    assert.equal(worker.claimed(), 1);
  });

  await check('offline root/chart navigation and JS resolve from verified shell', async () => {
    const worker = await createInstalled();
    worker.setOffline(true);
    const nav = url => ({ url: absolute(url), mode: 'navigate', method: 'GET' });
    assert.equal(await (await worker.dispatch('fetch', { request: nav('/') })).text(), fixtures['index.html']);
    assert.equal(await (await worker.dispatch('fetch', { request: nav('/chart/') })).text(), fixtures['chart/index.html']);
    assert.equal(await (await worker.dispatch('fetch', { request: new Request(absolute('/_next/static/chart.js')) })).text(), fixtures['_next/static/chart.js']);
    assert.equal(await (await worker.dispatch('fetch', { request: new Request(absolute('/chart/index.txt?_rsc=router-token')) })).text(), fixtures['chart/index.txt']);
    assert.equal(await (await worker.dispatch('fetch', { request: new Request(absolute('/chart/__next._tree.txt?_rsc=router-token')) })).text(), fixtures['chart/__next._tree.txt']);
  });

  await check('RSC query never receives cached HTML; visited queries remain separate', async () => {
    const worker = await createInstalled();
    const first = new Request(absolute('/library/?_rsc=first'));
    worker.network.set(first.url, new Response('RSC first', { headers: { 'Content-Type': 'text/x-component' } }));
    await worker.dispatch('fetch', { request: first });
    worker.setOffline(true);
    assert.equal(await (await worker.dispatch('fetch', { request: first })).text(), 'RSC first');
    await assert.rejects(worker.dispatch('fetch', { request: new Request(absolute('/chart/?_rsc=missing')) }), /unavailable/);
    await assert.rejects(worker.dispatch('fetch', { request: new Request(absolute('/library/?_rsc=other')) }), /unavailable/);
  });

  await check('cross-origin, API and non-GET requests bypass worker', async () => {
    const worker = await createInstalled();
    for (const request of [new Request('https://other.example/chart/'), new Request(absolute('/api/interpret')), new Request(absolute('/chart/'), { method: 'POST', body: 'private' })]) {
      assert.equal(await worker.dispatch('fetch', { request }), undefined);
    }
  });

  await check('uncached offline reference navigation has honest offline page', async () => {
    const worker = await createInstalled();
    worker.setOffline(true);
    const response = await worker.dispatch('fetch', { request: { url: absolute('/library/'), mode: 'navigate', method: 'GET' } });
    assert.equal(response.status, 503);
    assert.match(await response.text(), /此页面尚未缓存/);
  });

  await check('no-store responses are never cached', async () => {
    const worker = await createInstalled();
    const request = new Request(absolute('/private.txt'));
    worker.network.set(request.url, new Response('private', { headers: { 'Cache-Control': 'no-store' } }));
    await worker.dispatch('fetch', { request });
    worker.setOffline(true);
    await assert.rejects(worker.dispatch('fetch', { request }), /unavailable/);
  });

  await check('GitHub project base path: manifest, core cache, navigation, scope isolation', async () => {
    assert.throws(() => normalizeBasePath('/repo/'), /Invalid/);
    assert.throws(() => normalizeBasePath('repo'), /Invalid/);
    assert.equal(normalizeBasePath('/ziwei-doushu'), '/ziwei-doushu');
    const scoped = await buildPwa(temporary, '/ziwei-doushu', { skipLicenseNotices: true });
    assert.ok(scoped.entries.every(entry => entry.url.startsWith('/ziwei-doushu/')));
    const appManifest = JSON.parse(await readFile(path.join(temporary, 'manifest.webmanifest'), 'utf8'));
    for (const field of ['id', 'start_url', 'scope']) assert.equal(appManifest[field], '/ziwei-doushu/');
    assert.ok(appManifest.icons.every(icon => icon.src.startsWith('/ziwei-doushu/icons/')));
    assert.equal(await readFile(path.join(temporary, '.nojekyll'), 'utf8'), '');
    const worker = harness(scoped);
    for (const entry of scoped.entries) {
      const relative = entry.url.slice('/ziwei-doushu'.length);
      const file = relative === '/' ? 'index.html' : relative === '/chart/' ? 'chart/index.html' : relative.slice(1);
      worker.network.set(absolute(entry.url), await readFile(path.join(temporary, file)));
    }
    await worker.dispatch('install');
    worker.setOffline(true);
    const nav = { url: absolute('/ziwei-doushu/chart/'), method: 'GET', mode: 'navigate' };
    assert.equal(await (await worker.dispatch('fetch', { request: nav })).text(), fixtures['chart/index.html']);
    assert.equal(await worker.dispatch('fetch', { request: new Request(absolute('/another-project/')) }), undefined);
    const unavailable = await worker.dispatch('fetch', { request: { ...nav, url: absolute('/ziwei-doushu/unknown/') } });
    assert.match(await unavailable.text(), /href="\/ziwei-doushu\/"/);
  });

  await check('production manifest: Chinese identity, standalone, scope and real PNG sizes', async () => {
    const appManifest = JSON.parse(await readFile(path.join(root, 'public/manifest.webmanifest'), 'utf8'));
    assert.equal(appManifest.name, '紫微斗数');
    assert.equal(appManifest.display, 'standalone');
    assert.equal(appManifest.start_url, '/');
    assert.equal(appManifest.scope, '/');
    assert.equal(appManifest.lang, 'zh-CN');
    for (const icon of [...appManifest.icons, { src: '/icons/apple-touch-icon.png', sizes: '180x180' }]) {
      const png = await readFile(path.join(root, 'public', icon.src));
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      const [width, height] = icon.sizes.split('x').map(Number);
      assert.equal(png.readUInt32BE(16), width);
      assert.equal(png.readUInt32BE(20), height);
    }
  });

  await check('production artifact manifest hashes match every output resource', async () => {
    const production = JSON.parse(await readFile(path.join(root, 'out/precache-manifest.json'), 'utf8'));
    assert.deepEqual(await createPrecache(path.join(root, 'out'), production.basePath), production);
    const source = await readFile(path.join(root, 'out/sw.js'), 'utf8');
    assert.equal(source, createWorkerSource(production));
    assert.ok(!source.includes('self.skipWaiting('));
    assert.equal(await readFile(path.join(root, 'out/.nojekyll'), 'utf8'), '');
    const appManifest = JSON.parse(await readFile(path.join(root, 'out/manifest.webmanifest'), 'utf8'));
    for (const field of ['id', 'start_url', 'scope']) assert.equal(appManifest[field], production.basePath + '/');
    assert.ok(appManifest.icons.every(icon => icon.src.startsWith(production.basePath + '/icons/')));
    assert.deepEqual(await readFile(path.join(root, 'out/LICENSE.txt')), await readFile(path.join(root, 'LICENSE')));
    const notices = await readFile(path.join(root, 'out/THIRD_PARTY_NOTICES.txt'), 'utf8');
    const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
    for (const [location, pkg] of Object.entries(lock.packages).filter(([location]) => location)) {
      const name = pkg.name || location.split('node_modules/').at(-1);
      assert.ok(notices.includes([name, pkg.version, pkg.license].join('\t')), `license inventory: ${name}@${pkg.version}`);
    }
    for (const name of ['next', 'react', 'react-dom', 'iztro', 'lunar-javascript', 'framer-motion', 'html2canvas', 'clsx']) {
      const pkg = JSON.parse(await readFile(path.join(root, 'node_modules', name, 'package.json'), 'utf8'));
      assert.ok(notices.includes(`${name}@${pkg.version} — `), `full client license: ${name}`);
    }
    const layout = await readFile(path.join(root, 'app/layout.tsx'), 'utf8');
    assert.ok(!layout.includes('@vercel/analytics') && !layout.includes('@vercel/speed-insights'));
  });
  await check('private noindex metadata and every HTML resource respect deployment base path', async () => {
    const output = path.join(root, 'out');
    const precache = JSON.parse(await readFile(path.join(output, 'precache-manifest.json'), 'utf8'));
    const robots = await readFile(path.join(output, 'robots.txt'), 'utf8');
    const sitemap = await readFile(path.join(output, 'sitemap.xml'), 'utf8');
    assert.match(robots, /^Disallow: \/\s*$/m);
    assert.ok(!/^(?:Host|Sitemap):/mi.test(robots), 'self-use build must not advertise a crawler host or sitemap');
    assert.ok(!/<loc>/i.test(sitemap), 'self-use sitemap stays empty');
    assert.ok(!/https?:\/\/(?:localhost|127\.0\.0\.1)/i.test(robots + sitemap));
    let pages = 0;
    async function scan(directory) {
      for (const file of await readdir(directory, { withFileTypes: true })) {
        const filename = path.join(directory, file.name);
        if (file.isDirectory()) { await scan(filename); continue; }
        if (!file.name.endsWith('.html')) continue;
        pages++;
        const html = await readFile(filename, 'utf8');
        assert.match(html, /<meta[^>]*name="robots"[^>]*content="[^"]*noindex/i, filename);
        for (const [, url] of html.matchAll(/(?:href|src|action)="([^"]+)"/g)) {
          assert.ok(!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/i.test(url), `development URL in ${filename}`);
          if (url.startsWith('/') && !url.startsWith('//')) {
            assert.ok(url === precache.basePath || url.startsWith(precache.basePath + '/'), `unscoped URL ${url} in ${filename}`);
          }
        }
      }
    }
    await scan(output);
    assert.ok(pages > 10);
  });
  console.log(`PWA unit/build checks: ${passed} passed.`);
} finally {
  // Exact test-owned temporary directory, never a user-data directory.
  await rm(temporary, { recursive: true, force: true });
}
