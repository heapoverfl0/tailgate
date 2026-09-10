import { createDynamoRepository } from '../../../packages/persistence/src/dynamo.js';
import { createService, type ApiRequest, type ApiResponse } from './service.js';
export interface HttpEvent {
  rawPath: string;
  requestContext: { http: { method: string } };
  headers?: Record<string, string | undefined>;
  cookies?: string[];
  body?: string;
  isBase64Encoded?: boolean;
}
export function createLambdaHandler(api: (req: ApiRequest) => Promise<ApiResponse>) {
  return async (event: HttpEvent) => {
    const headers = Object.fromEntries(Object.entries(event.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
    const respond = (response: ApiResponse) => ({ ...response, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(response.body) });
    const error = (statusCode: number, code: string) => respond({ statusCode, body: { error: { code, message: code } } });
    let body: unknown;
    if (event.body) {
      const bytes = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
      if (bytes.length > 131072) return error(413, 'TOO_LARGE');
      if (!headers['content-type']?.startsWith('application/json')) return error(415, 'JSON_REQUIRED');
      try { body = JSON.parse(bytes.toString('utf8')); } catch { return error(400, 'INVALID_JSON'); }
    }
    return respond(await api({ method: event.requestContext.http.method, path: event.rawPath, body, headers: { ...headers, ...(event.cookies ? { cookie: event.cookies.join('; ') } : {}) } }));
  };
}
let configured: ReturnType<typeof createLambdaHandler> | undefined;
export async function handler(event: HttpEvent) {
  configured ??= createLambdaHandler(createService(createDynamoRepository(process.env.TAILGATE_TABLE ?? ''), {
    origin: process.env.APP_ORIGIN ?? '', password: process.env.COMMISSIONER_PASSWORD ?? '',
    signingSecret: process.env.SESSION_SIGNING_SECRET ?? '', secureCookies: true,
  }));
  return configured(event);
}
