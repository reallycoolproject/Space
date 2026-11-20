import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certPath = path.join(__dirname, 'homepage/node_modules/.vite/basic-ssl/_cert.pem');

if (!fs.existsSync(certPath)) {
  console.error(`Certificate not found at ${certPath}`);
  process.exit(1);
}

const cert = fs.readFileSync(certPath);
const TARGET_HOST = '127.0.0.1';
const TARGET_PORT = 5173;
const HTTPS_PORT = 5174;

// Prevent proxy process from dying on socket resets (ECONNRESET, EPIPE)
process.on('uncaughtException', (err) => {
  if (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ECONNABORTED') {
    // Client disconnected abruptly; safe to ignore
    return;
  }
  console.error('Unhandled Proxy Exception:', err);
});

const server = https.createServer({ key: cert, cert: cert }, (req, res) => {
  req.on('error', () => {});
  res.on('error', () => {});

  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      'x-forwarded-proto': 'https',
      'x-forwarded-for': req.socket?.remoteAddress || '127.0.0.1'
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    proxyRes.on('error', () => {});
    if (!res.headersSent) {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    }
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Proxy error: ' + err.message);
    }
  });

  req.pipe(proxyReq, { end: true });
});

// Ignore TLS and HTTP client handshake / socket errors
server.on('tlsClientError', (err, tlsSocket) => {
  try {
    tlsSocket.destroy();
  } catch {}
});

server.on('clientError', (err, socket) => {
  try {
    if (socket && !socket.destroyed) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
  } catch {}
});

// Proxy WebSocket connections (Socket.io)
server.on('upgrade', (req, clientSocket, head) => {
  clientSocket.on('error', () => {
    try { clientSocket.destroy(); } catch {}
  });

  const proxyReq = http.request({
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  });

  proxyReq.on('upgrade', (proxyRes, targetSocket, proxyHead) => {
    targetSocket.on('error', () => {
      try { clientSocket.destroy(); } catch {}
    });

    let headersStr = `HTTP/1.1 101 Switching Protocols\r\n`;
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (Array.isArray(value)) {
        for (const v of value) headersStr += `${key}: ${v}\r\n`;
      } else if (value !== undefined) {
        headersStr += `${key}: ${value}\r\n`;
      }
    }
    headersStr += '\r\n';

    try {
      clientSocket.write(headersStr);
      if (proxyHead && proxyHead.length) {
        clientSocket.write(proxyHead);
      }
      targetSocket.pipe(clientSocket);
      clientSocket.pipe(targetSocket);
    } catch {
      try { clientSocket.destroy(); } catch {}
      try { targetSocket.destroy(); } catch {}
    }
  });

  proxyReq.on('error', () => {
    try { clientSocket.destroy(); } catch {}
  });

  proxyReq.end();
});

server.listen(HTTPS_PORT, '0.0.0.0', () => {
  console.log(`LAN HTTPS Proxy active on https://localhost:${HTTPS_PORT}`);
});
