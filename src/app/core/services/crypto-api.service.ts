import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CryptoDepth,
  CryptoFillPreview,
  CryptoTicker,
} from '../models/crypto.model';

@Injectable({ providedIn: 'root' })
export class CryptoApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/crypto`;

  getTickers(): Observable<CryptoTicker[]> {
    return this.http.get<CryptoTicker[]>(this.base).pipe(
      map((list) =>
        (list ?? []).map((t) => ({
          ...t,
          price: Number(t.price),
          changePercent24h: Number(t.changePercent24h),
          quoteVolume24h: Number(t.quoteVolume24h),
          high24h: Number(t.high24h),
          low24h: Number(t.low24h),
          priceDecimals: Number(t.priceDecimals ?? 8),
        })),
      ),
    );
  }

  getTicker(symbol: string): Observable<CryptoTicker> {
    return this.http.get<CryptoTicker>(`${this.base}/${encodeURIComponent(symbol)}`).pipe(
      map((t) => ({
        ...t,
        price: Number(t.price),
        changePercent24h: Number(t.changePercent24h),
        quoteVolume24h: Number(t.quoteVolume24h),
        high24h: Number(t.high24h),
        low24h: Number(t.low24h),
        priceDecimals: Number(t.priceDecimals ?? 8),
      })),
    );
  }

  getDepth(symbol: string): Observable<CryptoDepth> {
    return this.http.get<CryptoDepth>(`${this.base}/${encodeURIComponent(symbol)}/depth`).pipe(
      map((d) => ({
        symbol: d.symbol,
        bids: (d.bids ?? []).map((l) => ({
          price: Number(l.price),
          quantity: Number(l.quantity),
        })),
        asks: (d.asks ?? []).map((l) => ({
          price: Number(l.price),
          quantity: Number(l.quantity),
        })),
      })),
    );
  }

  quote(body: {
    symbol: string;
    side: 'buy' | 'sell';
    quoteUsd?: number;
    quantity?: number;
  }): Observable<CryptoFillPreview> {
    return this.http.post<CryptoFillPreview>(`${this.base}/quote`, body);
  }

  getMeta(symbol: string): Observable<{
    symbol: string;
    name: string;
    earliestDataDate: string | null;
    latestDataDate: string | null;
  }> {
    return this.http.get<{
      symbol: string;
      name: string;
      earliestDataDate?: string | null;
      EarliestDataDate?: string | null;
      latestDataDate?: string | null;
      LatestDataDate?: string | null;
    }>(`${this.base}/${encodeURIComponent(symbol)}/meta`).pipe(
      map((m) => ({
        symbol: m.symbol,
        name: m.name,
        earliestDataDate: m.earliestDataDate ?? m.EarliestDataDate ?? null,
        latestDataDate: m.latestDataDate ?? m.LatestDataDate ?? null,
      })),
    );
  }

  syncHistory(symbol?: string, full = false): Observable<unknown> {
    let url = `${this.base}/sync-history?full=${full}`;
    if (symbol) url += `&symbol=${encodeURIComponent(symbol)}`;
    return this.http.post(url, {});
  }
}
