import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AuthUser,
  AuthSession,
  LoginResult,
  saveSession,
  loadSession,
  clearSession,
  normalizeAuthUser,
} from '../models/auth.model';
import { AuthApiService } from './auth-api.service';
import { FirebaseService } from './firebase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api      = inject(AuthApiService);
  private readonly firebase = inject(FirebaseService);

  private readonly _session = signal<AuthSession | null>(loadSession());

  readonly currentUser = this.computed_currentUser();
  readonly isLoggedIn  = () => !!this._session();

  private computed_currentUser() {
    return (() => this._session()?.user ?? null) as () => AuthUser | null;
  }

  getAccessToken(): string | null {
    return this._session()?.tokens.accessToken ?? null;
  }

  /** Google popup ile giriş/kayıt. */
  async loginWithGoogle(): Promise<void> {
    const idToken = await this.firebase.signInWithGoogle();
    const result  = await firstValueFrom(this.api.login(idToken));
    this.applyLogin(result);
  }

  /**
   * Telefon numarasına OTP gönderir.
   * @param phoneE164  '+905551234567' formatında
   * @param captchaContainerId reCAPTCHA DOM id'si
   */
  async sendPhoneOtp(phoneE164: string, captchaContainerId: string): Promise<void> {
    await this.firebase.sendPhoneOtp(phoneE164, captchaContainerId);
  }

  /** Girilen OTP kodu doğrular ve giriş yapar. */
  async verifyPhoneOtp(code: string): Promise<void> {
    const idToken = await this.firebase.verifyPhoneOtp(code);
    const result  = await firstValueFrom(this.api.login(idToken));
    this.applyLogin(result);
  }

  async logout(): Promise<void> {
    await this.firebase.signOut().catch(() => null);
    clearSession();
    this._session.set(null);
  }

  /** Kullanıcı adı/şifreyle demo giriş — geriye dönük uyumluluk için. */
  loginDemo(username: string): void {
    const user = normalizeAuthUser({
      id:            crypto.randomUUID(),
      displayName:   username,
      provider:      'google',
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

  private applyLogin(result: LoginResult): void {
    const session: AuthSession = {
      user:   normalizeAuthUser(result.user),
      tokens: {
        accessToken:  result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt:    result.expiresAt,
      },
    };
    saveSession(session);
    this._session.set(session);
  }
}
