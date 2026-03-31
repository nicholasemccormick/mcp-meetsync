// ─────────────────────────────────────────────────────────────────────────────
// MeetSync MCP Server — HTTP client
//
// Wraps every MeetSync REST endpoint with a typed fetch call.
// Reads MEETSYNC_API_URL and MEETSYNC_API_KEY from the environment.
//
// Usage:
//   import { client } from './client';
//   const booking = await client.get('/v1/bookings/some-uuid');
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL: string = (process.env['MEETSYNC_API_URL'] ?? 'http://localhost:3000').replace(/\/$/, '');
const API_KEY: string  = process.env['MEETSYNC_API_KEY'] ?? '';

// ── Low-level helpers ─────────────────────────────────────────────────────────

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-API-Key':    API_KEY,
  };
}

/** Serialize an object as URL query parameters, dropping undefined/null values. */
function toQueryString(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? '?' + parts.join('&') : '';
}

async function handleResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text; }

  if (!res.ok) {
    const msg = typeof body === 'object' && body !== null
      ? JSON.stringify(body)
      : text;
    throw new Error(`MeetSync API error ${res.status}: ${msg}`);
  }

  return body;
}

// ── Public client ─────────────────────────────────────────────────────────────

export const client = {
  /** GET request with optional query params. */
  async get(path: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const url = `${BASE_URL}${path}${toQueryString(params)}`;
    const res = await fetch(url, { method: 'GET', headers: headers() });
    return handleResponse(res);
  },

  /** POST request with a JSON body. */
  async post(path: string, body: unknown): Promise<unknown> {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      method:  'POST',
      headers: headers(),
      body:    JSON.stringify(body),
    });
    return handleResponse(res);
  },

  /** PUT request with a JSON body (full replace). */
  async put(path: string, body: unknown): Promise<unknown> {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      method:  'PUT',
      headers: headers(),
      body:    JSON.stringify(body),
    });
    return handleResponse(res);
  },

  /** PATCH request with a JSON body (partial update / state transition). */
  async patch(path: string, body: unknown): Promise<unknown> {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      method:  'PATCH',
      headers: headers(),
      body:    JSON.stringify(body),
    });
    return handleResponse(res);
  },

  /** DELETE request with optional query params. */
  async delete(path: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const url = `${BASE_URL}${path}${toQueryString(params)}`;
    const res = await fetch(url, { method: 'DELETE', headers: headers() });
    // 204 No Content — return null instead of failing on empty body
    if (res.status === 204) return null;
    return handleResponse(res);
  },
};
