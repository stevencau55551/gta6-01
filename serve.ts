// serve.ts — server statis kecil untuk memainkan Teluk Arun secara lokal:
//   node serve.ts            lalu buka http://localhost:8080
//   node serve.ts 9000       port lain
// Hanya menyajikan file di bawah game/; tidak ada request keluar, tidak ada
// daftar direktori. Path di luar game/ ditolak (traversal-proof).
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(join(fileURLToPath(new URL('.', import.meta.url)), 'game'));
const port = Number.parseInt(process.argv[2] ?? '8080', 10) || 8080;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function safePath(urlPath) {
  // Decode sekali, buang query, lalu resolve di bawah root; tolak bila lolos.
  // decodeURIComponent bisa throw pada %-sequence rusak — tangkap supaya
  // satu request jahat tidak mematikan server (temuan review bug-hunter).
  let clean;
  try {
    clean = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const resolved = resolve(join(root, clean));
  if (resolved !== root && !resolved.startsWith(root + sep)) return null;
  return resolved;
}

const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain' });
    res.end('method not allowed');
    return;
  }
  let file = safePath(req.url === '/' ? '/index.html' : req.url);
  if (file && (file === root || file.endsWith(sep))) file = join(file, 'index.html');
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  const body = readFileSync(file);
  res.writeHead(200, {
    'content-type': types[extname(file)] || 'application/octet-stream',
    'content-length': body.length,
    'cache-control': 'no-cache',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
});

server.listen(port, () => {
  console.log(`Teluk Arun berjalan di http://localhost:${port}`);
});
