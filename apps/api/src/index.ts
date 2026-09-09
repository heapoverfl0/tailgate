import { MemoryContestRepository, demoContest, type ContestRepository } from '../../../packages/persistence/src/index.js';
export function createApi(repository: ContestRepository) {
  return async (method: string, path: string) => {
    if (method === 'GET' && path === '/api/health') return { statusCode: 200, body: { status: 'ok' } };
    const match = /^\/api\/contests\/([a-zA-Z0-9_-]+)$/.exec(path);
    if (method === 'GET' && match) {
      const contest = await repository.getSummary(match[1]!);
      if (contest) return { statusCode: 200, body: contest };
    }
    return { statusCode: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found' } } };
  };
}
const api = createApi(new MemoryContestRepository([demoContest]));
export async function handler(event: { rawPath: string; requestContext: { http: { method: string } } }) {
  const response = await api(event.requestContext.http.method, event.rawPath);
  return { statusCode: response.statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(response.body) };
}
