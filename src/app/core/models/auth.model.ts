export interface AuthUser {
  id: string;
  displayName: string;
  email?: string | null;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
  provider: 'google' | 'phone';
  portfolioCash: number;
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

export function saveSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): AuthSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
