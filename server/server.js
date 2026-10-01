/* =============================================================================
   server.js — serveert de Pure Minds Post Maker
   -----------------------------------------------------------------------------
   Kleine statische server zonder dependencies. De tool zelf draait volledig in
   de browser; deze server is alleen nodig om hem te hosten (bijv. op Render)
   of lokaal te openen via http:// in plaats van file://.

   Omgevingsvariabelen:
     PORT   poort om op te luisteren (standaard 3000, Render zet hem zelf)
   ============================================================================= */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.env.PORT, 10) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch (err) {
    urlPath = '/';
  }
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.normalize(path.join(ROOT, urlPath));
  const rel = path.relative(ROOT, filePath);
  // Niets buiten de projectmap, geen verborgen mappen en niet de servercode zelf
  const blocked = rel.startsWith('..') || rel.split(path.sep).some((seg) => seg.startsWith('.') || seg === 'node_modules' || seg === 'server');
  if (blocked) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : ext === '.ttf' ? 'public, max-age=604800, immutable' : 'public, max-age=3600',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end();
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Pure Minds Generator Hub draait op http://localhost:${PORT}`);
});
