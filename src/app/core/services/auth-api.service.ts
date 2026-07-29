import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthExchangeResult,
  AuthUser,
  LoginResult,
  UsernameAvailability,
} from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/auth`;

  /** Firebase ID Token — mevcut kullanıcıysa session, yeniyse needsProfile. */
  login(idToken: string): Observable<AuthExchangeResult> {
    return this.http.post<AuthExchangeResult>(`${this.base}/login`, { idToken });
  }

  /** İlk kayıt (Google): zorunlu username + opsiyonel displayName. */
  register(idToken: string, username: string, displayName?: string | null): Observable<LoginResult> {
    return this.http.post<LoginResult>(`${this.base}/register`, {
      idToken,
      username,
      displayName: displayName?.trim() || null,
    });
  }

  passwordLogin(username: string, password: string): Observable<LoginResult> {
    return this.http.post<LoginResult>(`${this.base}/password/login`, { username, password });
  }

  passwordRegister(
    username: string,
    password: string,
    passwordConfirm: string,
    displayName?: string | null,
  ): Observable<LoginResult> {
    return this.http.post<LoginResult>(`${this.base}/password/register`, {
      username,
      password,
      passwordConfirm,
      displayName: displayName?.trim() || null,
    });
  }

  usernameAvailable(username: string): Observable<UsernameAvailability> {
    return this.http.get<UsernameAvailability>(`${this.base}/username-available`, {
      params: { username },
    });
  }

  refresh(refreshToken: string): Observable<LoginResult> {
    return this.http.post<LoginResult>(`${this.base}/refresh`, { refreshToken });
  }

  me(): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${this.base}/me`);
  }

  updatePrivacy(showTradeHistoryPublic: boolean): Observable<AuthUser> {
    return this.http.patch<AuthUser>(`${this.base}/privacy`, { showTradeHistoryPublic });
  }
}
