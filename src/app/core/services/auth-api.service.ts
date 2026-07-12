import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginResult, AuthUser } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/auth`;

  /** Firebase ID Token'ı backend'e gönderir; JWT + kullanıcı bilgisi döner. */
  login(idToken: string): Observable<LoginResult> {
    return this.http.post<LoginResult>(`${this.base}/login`, { idToken });
  }

  /** Refresh token ile yeni access token alır. */
  refresh(refreshToken: string): Observable<LoginResult> {
    return this.http.post<LoginResult>(`${this.base}/refresh`, { refreshToken });
  }

  /** Giriş yapmış kullanıcının bilgilerini döner (JWT gerekli). */
  me(): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${this.base}/me`);
  }
}
