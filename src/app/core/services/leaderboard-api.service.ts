import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Leaderboard, PublicTradeHistory } from '../models/leaderboard.model';

@Injectable({ providedIn: 'root' })
export class LeaderboardApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/leaderboard`;

  /** Sıralama — giriş gerektirmez, değerler sunucuda canlı fiyatlarla hesaplanır. */
  getLeaderboard(take = 50): Observable<Leaderboard> {
    const params = new HttpParams().set('take', String(take));
    return this.http.get<Leaderboard>(this.base, { params });
  }

  /** Bir kullanıcının herkese açık işlem geçmişi; paylaşmıyorsa isPublic=false döner. */
  getPublicTrades(username: string, take = 50): Observable<PublicTradeHistory> {
    const params = new HttpParams().set('take', String(take));
    return this.http.get<PublicTradeHistory>(
      `${this.base}/${encodeURIComponent(username)}/trades`,
      { params },
    );
  }
}
