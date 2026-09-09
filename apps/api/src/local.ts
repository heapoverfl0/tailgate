import { createServer } from 'node:http';
import { handler } from './index.js';
createServer(async (req, res) => {
  try {
    const result = await handler({ rawPath: new URL(req.url ?? '/', 'http://localhost').pathname, requestContext: { http: { method: req.method ?? 'GET' } } });
    res.writeHead(result.statusCode, result.headers).end(result.body);
  } catch { res.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Internal error' } })); }
}).listen(Number(process.env.PORT ?? 3001), '127.0.0.1', () => console.log('Tailgate development API ready'));
