import type { VercelRequest, VercelResponse } from '@vercel/node';

export function fail(res: VercelResponse, status: number, message: string) {
  res.status(status).json({ error: message });
}

export function requireMethod(req: VercelRequest, res: VercelResponse, method: string): boolean {
  if (req.method === method) return true;
  res.setHeader('Allow', method);
  fail(res, 405, `Use ${method}`);
  return false;
}

/** Names are the only identity in Jyoti, so compare them forgivingly. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function readName(req: VercelRequest): string | null {
  const raw = (req.query.name ?? (req.body as Record<string, unknown> | undefined)?.name) as unknown;
  const name = typeof raw === 'string' ? raw.trim() : '';
  return name.length >= 1 && name.length <= 60 ? name : null;
}

export function handleError(res: VercelResponse, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  console.error('[jyoti]', error);
  const status = /Missing required environment variable/.test(message) ? 500 : 502;
  fail(res, status, message);
}
