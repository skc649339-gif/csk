import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../out');
const port = Number(process.env.PORT || 3000);
let basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
try { basePath = JSON.parse(await readFile(path.join(root, 'precache-manifest.json'), 'utf8')).basePath || ''; } catch {}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.xml': 'application/xml; charset=utf-8' };

export const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400); response.end('Bad request'); return; }
  if (basePath && pathname === '/') {
    response.writeHead(307, { Location: basePath + '/' }); response.end(); return;
  }
  if (basePath && pathname !== basePath && !pathname.startsWith(basePath + '/')) { response.writeHead(404); response.end(); return; }
  const relativePath = basePath ? pathname.slice(basePath.length) || '/' : pathname;
  const filename = path.resolve(root, '.' + relativePath);
  if (filename !== root && !filename.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
  try {
    let target = filename;
    let info = await stat(target);
    if (info.isDirectory()) {
      if (!pathname.endsWith('/')) {
        response.writeHead(308, { Location: pathname + '/' + new URL(request.url, 'http://localhost').search });
        response.end(); return;
      }
      target = path.join(target, 'index.html');
      info = await stat(target);
    }
    response.writeHead(200, {
      'Content-Type': types[path.extname(target)] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': /[/\\]_next[/\\]static[/\\]/.test(target) ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Service-Worker-Allowed': basePath + '/',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('页面不存在');
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await stat(path.join(root, 'index.html'));
  server.listen(port, '127.0.0.1', () => {
    console.log(`紫微斗数生产预览：http://localhost:${port}${basePath}/`);
    console.log('本地预览只用于电脑测试；iPhone 安装请使用远端 HTTPS，详见安装教程。按 Ctrl+C 停止。');
  });
}
