export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email?: string | null;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
  provider: 'google' | 'phone' | 'local';
  /** @deprecated use portfolioCashTry */
  portfolioCash?: number;
  portfolioCashTry: number;
  portfolioCashUsd: number;
  /** İşlem geçmişi liderlikte başkalarına görünsün mü? Varsayılan true. */
  showTradeHistoryPublic: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface LoginResult extends AuthTokens {
  user: AuthUser;
}

export interface ProfileSetupHint {
  email?: string | null;
  suggestedDisplayName?: string | null;
  avatarUrl?: string | null;
  suggestedUsername: string;
}

export interface AuthExchangeResult {
  needsProfile: boolean;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: string | null;
  user?: AuthUser | null;
  profileHint?: ProfileSetupHint | null;
}

export interface UsernameAvailability {
  username: string;
  available: boolean;
  reason?: string | null;
}

export interface AuthSession {
  user: AuthUser;
  tokens: AuthTokens;
}

const SESSION_KEY = 'sb_auth_session';

export function normalizeAuthUser(
  raw: Partial<AuthUser> & { id: string; displayName: string },
): AuthUser {
  const tryCash = Number(raw.portfolioCashTry ?? raw.portfolioCash ?? 1_000_000);
  const usdCash = Number(raw.portfolioCashUsd ?? 100_000);
  return {
    id: String(raw.id),
    username: raw.username?.trim() || raw.displayName,
    displayName: raw.displayName,
    email: raw.email,
    phoneNumber: raw.phoneNumber,
    avatarUrl: raw.avatarUrl,
    provider: (raw.provider as AuthUser['provider']) ?? 'google',
    portfolioCash: tryCash,
    portfolioCashTry: tryCash,
    portfolioCashUsd: usdCash,
    showTradeHistoryPublic: raw.showTradeHistoryPublic !== false,
  };
}

// localStorage'a erişimin KENDİSİ bazı bağlamlarda exception atar (gizli sekme, tarayıcı
// ayarıyla site verisi engellenmiş, yerleşik iframe). Sarmalanmazsa saveSession bir giriş
// akışının ortasında patlayıp kullanıcıyı oturum açamaz hâlde bırakıyordu — bu yüzden
// depolama "en iyi çaba" olarak ele alınır: başarısız olursa oturum sadece bellekte yaşar.
export function saveSession(session: AuthSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* depolama yok/dolu — oturum bellekte devam eder */
  }
}

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
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
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* yoksayılır — çıkış akışı depolama hatasında kesilmemeli */
  }
}
