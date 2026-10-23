import type { ApiError as ApiErrorBody, AuthResponse } from '@aulinha/contracts';

/** O navegador chama sempre a mesma origem; o Next (dev) / nginx (prod) repassa para a API. */
const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: string[],
  ) {
    super(message);
  }
}

// Access token só em memória (nunca em localStorage). Ao recarregar a página,
// a sessão volta pelo cookie httpOnly de refresh.
let accessToken: string | null = null;
let refreshing: Promise<AuthResponse | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setSessionExpiredHandler(fn: (() => void) | null) {
  onSessionExpired = fn;
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      err?.message ?? 'Não foi possível falar com o servidor',
      err?.details,
    );
  }
  return body as T;
}

/** Renova a sessão pelo cookie. Chamadas simultâneas compartilham a mesma requisição. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'same-origin' })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = await parse<AuthResponse>(res);
      accessToken = data.accessToken;
      return data;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'Sem conexão. Confira sua internet.');
  }

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    const session = await refreshSession();
    if (session) return api<T>(path, init, false);
    accessToken = null;
    onSessionExpired?.();
  }
  return parse<T>(res);
}

/** Baixa um arquivo autenticado (ex.: CSV) e dispara o download no navegador. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const go = () =>
    fetch(`${BASE}${path}`, {
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
      credentials: 'same-origin',
    });
  let res = await go();
  if (res.status === 401 && (await refreshSession())) res = await go();
  if (!res.ok) throw new ApiError(res.status, 'Não foi possível exportar');
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
