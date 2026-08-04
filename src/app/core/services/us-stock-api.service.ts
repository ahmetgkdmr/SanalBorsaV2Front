import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import { Stock, StockDetail } from '../models/stock.model';
import { TimeMachineCalc, TimeMachineMode } from '../models/time-machine.model';

interface UsTimeMachineApiResponse {
  symbol: string;
  mode: string;
  invested: number;
  currentValue: number;
  gainPct: number;
  initialLots: number;
  lots: number;
  buyPrice: number;
  currentPrice: number;
  series: { year: number; month: number; price: number }[];
  valueSeries: number[];
  lotSeries: number[];
  dailySeries?: {
    startDate: string;
    days: number[];
    prices: number[];
    values: number[];
  } | null;
  lotEvents?: {
    year: number;
    month: number;
    day?: number;
    actionDateLabel: string;
    actionType: string;
    label: string;
    lotsBefore: number;
    lotsAfter: number;
    description?: string | null;
    cashReceived?: number | null;
    lotsBought?: number | null;
    story?: string | null;
  }[];
  dateLabel: string;
  dividendsReceived?: number;
  dividendsReinvested?: number;
  lotsFromReinvestment?: number;
  cashRemaining?: number;
  storyLines?: string[] | null;
  error?: string | null;
}

/**
 * ABD hisseleri (S&P 500 pilotu) — sadece görüntüleme + zaman makinesi.
 * Backend'de alım/satım henüz yok, o yüzden PortfolioApiService'e karşılığı yok.
 */
@Injectable({ providedIn: 'root' })
export class UsStockApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/us-stocks`;

  getStocks(isActive = true): Observable<PagedResult<Stock>> {
    const params = new HttpParams().set('isActive', isActive);
    return this.http.get<PagedResult<Stock>>(this.base, { params });
  }

  getStock(symbol: string): Observable<StockDetail> {
    return this.http.get<StockDetail>(`${this.base}/${symbol}`);
  }

  /** ABD pilotunda asgari ücret modu yok — amount (USD) zorunlu. */
  calculateTimeMachine(
    symbol: string,
    date: string,
    mode: TimeMachineMode,
    amount: number,
  ): Observable<TimeMachineCalc> {
    const params = new HttpParams().set('date', date).set('mode', mode).set('amount', String(amount));
    return this.http
      .get<UsTimeMachineApiResponse>(`${this.base}/${symbol}/time-machine`, { params })
      .pipe(map((r) => this.mapTimeMachine(r, mode)));
  }

  private mapTimeMachine(r: UsTimeMachineApiResponse, mode: TimeMachineMode): TimeMachineCalc {
    return {
      symbol: r.symbol,
      mode,
      invested: Number(r.invested),
      currentValue: Number(r.currentValue),
      gainPct: Number(r.gainPct),
      initialLots: Number(r.initialLots ?? r.lots),
      lots: Number(r.lots),
      buyPrice: Number(r.buyPrice),
      currentPrice: Number(r.currentPrice),
      series: (r.series ?? []).map((p) => ({ year: p.year, month: p.month, price: Number(p.price) })),
      valueSeries: (r.valueSeries ?? []).map(Number),
      lotSeries: (r.lotSeries ?? []).map(Number),
      dailySeries: r.dailySeries
        ? {
            startDate: r.dailySeries.startDate,
            days: r.dailySeries.days ?? [],
            prices: (r.dailySeries.prices ?? []).map(Number),
            values: (r.dailySeries.values ?? []).map(Number),
          }
        : undefined,
      lotEvents: (r.lotEvents ?? []).map((e) => ({
        year: e.year,
        month: e.month,
        day: e.day,
        actionDateLabel: e.actionDateLabel,
        actionType: e.actionType,
        label: e.label,
        lotsBefore: Number(e.lotsBefore),
        lotsAfter: Number(e.lotsAfter),
        description: e.description ?? undefined,
        cashReceived: e.cashReceived != null ? Number(e.cashReceived) : undefined,
        lotsBought: e.lotsBought != null ? Number(e.lotsBought) : undefined,
        story: e.story ?? undefined,
      })),
      dateLabel: r.dateLabel,
      dividendsReceived: Number(r.dividendsReceived ?? 0),
      dividendsReinvested: Number(r.dividendsReinvested ?? 0),
      lotsFromReinvestment: Number(r.lotsFromReinvestment ?? 0),
      cashRemaining: Number(r.cashRemaining ?? 0),
      storyLines: r.storyLines ?? [],
      error: r.error ?? undefined,
    };
  }
}
