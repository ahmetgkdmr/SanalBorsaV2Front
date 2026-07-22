export interface AuthUser {
  id: string;
  displayName: string;
  email?: string | null;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
  provider: 'google' | 'phone';
  /** @deprecated use portfolioCashTry */
  portfolioCash?: number;
  portfolioCashTry: number;
  portfolioCashUsd: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface LoginResult extends AuthTokens {
  user: AuthUser;
}

export interface AuthSession {
  user: AuthUser;
  tokens: AuthTokens;
}

const SESSION_KEY = 'sb_auth_session';

export function normalizeAuthUser(raw: Partial<AuthUser> & { id: string; displayName: string }): AuthUser {
  const tryCash = Number(raw.portfolioCashTry ?? raw.portfolioCash ?? 1_000_000);
  const usdCash = Number(raw.portfolioCashUsd ?? 100_000);
  return {
    id: String(raw.id),
    displayName: raw.displayName,
    email: raw.email,
    phoneNumber: raw.phoneNumber,
    avatarUrl: raw.avatarUrl,
    provider: (raw.provider as AuthUser['provider']) ?? 'google',
    portfolioCash: tryCash,
    portfolioCashTry: tryCash,
    portfolioCashUsd: usdCash,
  };
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): AuthSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    return {
      ...parsed,
      user: normalizeAuthUser(parsed.user),
    };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
