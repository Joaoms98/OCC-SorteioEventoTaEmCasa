import { ApiError, NETWORK_ERROR_MESSAGE, UNEXPECTED_ERROR_MESSAGE } from './ApiError';
import { tokenStorage } from '../auth/tokenStorage';

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const API_URL = `${API_ORIGIN}/api`;

/** Resolves paths returned by the API (e.g. prize photos) against the API host. */
export const assetUrl = (path: string): string => `${API_ORIGIN}${path}`;

// Free hosting may need up to a minute to wake the server up.
const REQUEST_TIMEOUT_MS = 90_000;

type QueryValue = string | number | undefined;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON-serializable data, or a Blob sent as-is (file uploads). */
  body?: unknown;
  query?: Record<string, QueryValue>;
  authenticated?: boolean;
}

export const apiUrl = (path: string): string => `${API_URL}${path}`;

let unauthorizedHandler: (() => void) | null = null;

export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return `${API_URL}${path}${search ? `?${search}` : ''}`;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, authenticated = true } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const isFile = body instanceof Blob;
  if (body !== undefined) headers['Content-Type'] = isFile ? body.type : 'application/json';
  const token = authenticated ? tokenStorage.get() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : isFile ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0, 'NETWORK_ERROR');
  }

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);
  if (response.ok) return payload as T;

  const error = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
  if (response.status === 401 && authenticated) unauthorizedHandler?.();
  throw new ApiError(error?.message ?? UNEXPECTED_ERROR_MESSAGE, response.status, error?.code ?? 'UNKNOWN', error?.details);
}
