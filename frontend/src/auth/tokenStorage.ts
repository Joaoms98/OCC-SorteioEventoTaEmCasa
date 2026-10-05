const STORAGE_KEY = 'occ-raffle.session';

interface StoredSession {
  token: string;
  expiresAt: number;
}

function read(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const session = raw ? (JSON.parse(raw) as StoredSession) : null;
    return session && session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export const tokenStorage = {
  get: (): string | null => read()?.token ?? null,
  save(token: string, expiresInSeconds: number): void {
    const session: StoredSession = { token, expiresAt: Date.now() + expiresInSeconds * 1000 };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Private mode / blocked storage: the session simply won't survive a reload.
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
};
