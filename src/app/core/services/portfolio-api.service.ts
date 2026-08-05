import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MarketType,
  PagedTransactions,
  PortfolioHolding,
  PortfolioState,
  PortfolioTransaction,
} from '../models/portfolio.model';
import { CryptoFillPreview } from '../models/crypto.model';

interface ApiPortfolio {
  id: string;
  userId: string;
  cash: number;
  holdings: {
    symbol: string;
    marketType: string;
    quantity: number;
    avgCost: number;
  }[];
  transactions?: {
    id: string;
    symbol: string;
    marketType: string;
    side: string;
    quantity: number;
    price: number;
    total: number;
    fillBreakdownJson?: string | null;
    exchangeRateAtTrade?: number | null;
    executedAt: string;
  }[];
}

function mapMarketType(mt: string): MarketType {
  if (mt === 'crypto') return 'crypto';
  if (mt === 'us') return 'us';
  return 'bist';
}

interface ApiPagedTransactions {
  items: ApiPortfolio['transactions'];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface ApiCryptoTradeResult {
  portfolio: ApiPortfolio;
  fill: CryptoFillPreview;
}

@Injectable({ providedIn: 'root' })
export class PortfolioApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/portfolio`;

  get(): Observable<PortfolioState> {
    return this.http.get<ApiPortfolio>(this.base).pipe(map(mapPortfolio));
  }

  getTransactions(page = 1, pageSize = 10): Observable<PagedTransactions> {
    return this.http
      .get<ApiPagedTransactions>(`${this.base}/transactions`, {
        params: { page: String(page), pageSize: String(pageSize) },
      })
      .pipe(map(mapPagedTransactions), catchError(mapHttpError));
  }

  buyBist(symbol: string, lots: number): Observable<PortfolioState> {
    return this.http
      .post<ApiPortfolio>(`${this.base}/buy`, { symbol, lots })
      .pipe(map(mapPortfolio), catchError(mapHttpError));
  }

  sellBist(symbol: string, lots: number): Observable<PortfolioState> {
    return this.http
      .post<ApiPortfolio>(`${this.base}/sell`, { symbol, lots })
      .pipe(map(mapPortfolio), catchError(mapHttpError));
  }

  buyCrypto(symbol: string, body: { tryAmount?: number; quantity?: number }): Observable<{
    portfolio: PortfolioState;
    fill: CryptoFillPreview;
  }> {
    return this.http
      .post<ApiCryptoTradeResult>(`${this.base}/crypto/buy`, { symbol, ...body })
      .pipe(
        map((r) => ({ portfolio: mapPortfolio(r.portfolio), fill: r.fill })),
        catchError(mapHttpError),
      );
  }

  sellCrypto(symbol: string, quantity: number): Observable<{
    portfolio: PortfolioState;
    fill: CryptoFillPreview;
  }> {
    return this.http
      .post<ApiCryptoTradeResult>(`${this.base}/crypto/sell`, { symbol, quantity })
      .pipe(
        map((r) => ({ portfolio: mapPortfolio(r.portfolio), fill: r.fill })),
        catchError(mapHttpError),
      );
  }

  buyUs(symbol: string, tryAmount: number): Observable<PortfolioState> {
    return this.http
      .post<ApiPortfolio>(`${this.base}/us/buy`, { symbol, tryAmount })
      .pipe(map(mapPortfolio), catchError(mapHttpError));
  }

  sellUs(symbol: string, quantity: number): Observable<PortfolioState> {
    return this.http
      .post<ApiPortfolio>(`${this.base}/us/sell`, { symbol, quantity })
      .pipe(map(mapPortfolio), catchError(mapHttpError));
  }
}

function mapTx(t: NonNullable<ApiPortfolio['transactions']>[number]): PortfolioTransaction {
  return {
    id: t.id,
    symbol: t.symbol,
    marketType: mapMarketType(t.marketType),
    side: t.side === 'sell' ? 'sell' : 'buy',
    quantity: Number(t.quantity),
    price: Number(t.price),
    total: Number(t.total),
    fillBreakdownJson: t.fillBreakdownJson,
    exchangeRateAtTrade: t.exchangeRateAtTrade ?? undefined,
    at: t.executedAt,
    lots: Number(t.quantity),
  };
}

function mapPagedTransactions(p: ApiPagedTransactions): PagedTransactions {
  return {
    items: (p.items ?? []).map(mapTx),
    page: Number(p.page) || 1,
    pageSize: Number(p.pageSize) || 10,
    totalCount: Number(p.totalCount) || 0,
    totalPages: Number(p.totalPages) || 0,
  };
}

function mapPortfolio(p: ApiPortfolio): PortfolioState {
  const holdings: PortfolioHolding[] = (p.holdings ?? []).map((h) => ({
    symbol: h.symbol,
    marketType: mapMarketType(h.marketType),
    quantity: Number(h.quantity),
    avgCost: Number(h.avgCost),
    lots: Number(h.quantity),
  }));

  return {
    cash: Number(p.cash),
    holdings,
    transactions: (p.transactions ?? []).map(mapTx),
  };
}

function mapHttpError(err: unknown) {
  const http = err as HttpErrorResponse;
  const body = http.error;
  const msg =
    (typeof body === 'string' && body) ||
    body?.detail ||
    body?.message ||
    body?.title ||
    http.message ||
    'İşlem başarısız.';
  return throwError(() => new Error(typeof msg === 'string' ? msg : 'İşlem başarısız.'));
}
