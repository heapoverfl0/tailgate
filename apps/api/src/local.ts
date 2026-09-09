import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { FileStore } from '../../../packages/persistence/src/store.js';
import { createService } from './service.js';
const port = Number(process.env.PORT ?? 3001);
const api = createService(await FileStore.open(resolve(process.env.TAILGATE_DATA_FILE ?? '.local/tailgate.json')), {
  origin: process.env.APP_ORIGIN ?? `http://127.0.0.1:${port}`,
  password: process.env.COMMISSIONER_PASSWORD ?? '', signingSecret: process.env.SESSION_SIGNING_SECRET ?? '', secureCookies: false,
});
createServer(async (req, res) => {
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  try {
    let bytes = 0; const chunks: Buffer[] = [];
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 131072) { res.writeHead(413, headers).end(JSON.stringify({ error: { code: 'TOO_LARGE', message: 'Request too large' } })); return; }
      chunks.push(Buffer.from(chunk));
    }
    let body: unknown;
    if (bytes) {
      if (!req.headers['content-type']?.startsWith('application/json')) { res.writeHead(415, headers).end(JSON.stringify({ error: { code: 'JSON_REQUIRED', message: 'Use application/json' } })); return; }
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { res.writeHead(400, headers).end(JSON.stringify({ error: { code: 'INVALID_JSON', message: 'Invalid JSON' } })); return; }
    }
    const response = await api({ method: req.method ?? 'GET', path: new URL(req.url ?? '/', 'http://localhost').pathname, body,
      headers: { cookie: req.headers.cookie, origin: req.headers.origin } });
    res.writeHead(response.statusCode, { ...headers, ...(response.cookies ? { 'set-cookie': response.cookies } : {}) }).end(JSON.stringify(response.body));
  } catch { res.writeHead(500, headers).end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Internal error' } })); }
}).listen(port, '127.0.0.1', () => console.log(`Tailgate local API: http://127.0.0.1:${port}`));
