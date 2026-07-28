// Máy chủ tĩnh tối giản (không phụ thuộc npm) phục vụ giao diện Claude Design.
// Mở trực tiếp bằng file:// sẽ chặn iframe bản đồ, nên cần HTTP server này.
// Chạy: node server.mjs  (hoặc npm run dev)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'app');
const PORT = Number(process.env.FRONTEND_PORT) || 8000;
// Trang chính có tên chứa dấu cách và tiếng Việt — index.html sẽ chuyển hướng tới nó.
const INDEX = 'index.html';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    if (pathname === '/') pathname = `/${INDEX}`;
    // Chống path traversal.
    const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    let filePath = join(ROOT, safe);
    let info = await stat(filePath).catch(() => null);
    if (info && info.isDirectory()) {
      filePath = join(filePath, INDEX);
      info = await stat(filePath).catch(() => null);
    }
    if (!info) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Không tìm thấy tài nguyên');
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('500 Lỗi máy chủ: ' + err.message);
  }
});

// Tự động chọn cổng trống nếu cổng cấu hình bị chiếm.
function listenWithFallback(port, attemptsLeft = 20) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.warn(`  Cổng ${port} đang bận — thử cổng ${port + 1}…`);
      listenWithFallback(port + 1, attemptsLeft - 1);
    } else {
      console.error('  Lỗi khởi động máy chủ:', err.message);
      process.exit(1);
    }
  });
  server.listen(port, () => {
    console.log(`\n  Giao diện CSDL Vật chất Doanh trại đang chạy tại:`);
    console.log(`  → http://localhost:${port}/\n`);
  });
}

listenWithFallback(PORT);
