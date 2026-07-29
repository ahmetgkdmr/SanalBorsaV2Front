import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AuthUser,
  AuthSession,
  AuthExchangeResult,
  LoginResult,
  ProfileSetupHint,
  saveSession,
  loadSession,
  clearSession,
  normalizeAuthUser,
} from '../models/auth.model';
import { AuthApiService } from './auth-api.service';
import { FirebaseService } from './firebase.service';

export type FirebaseLoginOutcome =
  | { kind: 'session' }
  | { kind: 'needsProfile'; idToken: string; hint: ProfileSetupHint };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApiService);
  private readonly firebase = inject(FirebaseService);

  private readonly _session = signal<AuthSession | null>(loadSession());

  readonly currentUser = this.computed_currentUser();
  readonly isLoggedIn = () => !!this._session();

  private computed_currentUser() {
    return (() => this._session()?.user ?? null) as () => AuthUser | null;
  }

  getAccessToken(): string | null {
    return this._session()?.tokens.accessToken ?? null;
  }

  /** Google popup — kayıtlıysa session, değilse profil adımı. */
  async loginWithGoogle(): Promise<FirebaseLoginOutcome> {
    const idToken = await this.firebase.signInWithGoogle();
    return this.exchangeToken(idToken);
  }

  async loginWithPassword(username: string, password: string): Promise<void> {
    const result = await firstValueFrom(this.api.passwordLogin(username, password));
    this.applyLogin(result);
  }

  async registerWithPassword(
    username: string,
    password: string,
    passwordConfirm: string,
    displayName?: string | null,
  ): Promise<void> {
    const result = await firstValueFrom(
      this.api.passwordRegister(username, password, passwordConfirm, displayName),
    );
    this.applyLogin(result);
  }

  async completeRegistration(
    idToken: string,
    username: string,
    displayName?: string | null,
  ): Promise<void> {
    const result = await firstValueFrom(this.api.register(idToken, username, displayName));
    this.applyLogin(result);
  }

  async checkUsername(username: string) {
    return firstValueFrom(this.api.usernameAvailable(username));
  }

  async updateTradeHistoryPrivacy(showTradeHistoryPublic: boolean): Promise<AuthUser> {
    const user = await firstValueFrom(this.api.updatePrivacy(showTradeHistoryPublic));
    const normalized = normalizeAuthUser(user);
    const session = this._session();
    if (session) {
      const next = { ...session, user: normalized };
      saveSession(next);
      this._session.set(next);
    }
    return normalized;
  }

  async logout(): Promise<void> {
    await this.firebase.signOut().catch(() => null);
    clearSession();
    this._session.set(null);
  }

  loginDemo(username: string): void {
    const user = normalizeAuthUser({
      id: crypto.randomUUID(),
      username,
      displayName: username,
      provider: 'google',
      portfolioCashTry: 1_000_000,
      portfolioCashUsd: 100_000,
    });
    const session: AuthSession = {
      user,
      tokens: { accessToken: '', refreshToken: '', expiresAt: '' },
    };
    saveSession(session);
    this._session.set(session);
  }

  private async exchangeToken(idToken: string): Promise<FirebaseLoginOutcome> {
    const result = await firstValueFrom(this.api.login(idToken));
    if (result.needsProfile) {
      return {
        kind: 'needsProfile',
        idToken,
        hint: result.profileHint ?? {
          suggestedUsername: 'user',
          email: null,
          suggestedDisplayName: null,
          avatarUrl: null,
        },
      };
    }
    this.applyExchange(result);
    return { kind: 'session' };
  }

  private applyExchange(result: AuthExchangeResult): void {
    if (!result.accessToken || !result.refreshToken || !result.expiresAt || !result.user) {
      throw new Error('Giriş yanıtı eksik.');
    }
    this.applyLogin({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      user: result.user,
    });
  }

  private applyLogin(result: LoginResult): void {
    const session: AuthSession = {
      user: normalizeAuthUser(result.user),
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
      },
    };
    saveSession(session);
    this._session.set(session);
  }
}
