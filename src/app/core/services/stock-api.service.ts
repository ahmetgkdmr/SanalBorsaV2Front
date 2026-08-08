import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import { PriceHistory } from '../models/price-history.model';
import { Stock, StockDetail } from '../models/stock.model';
import {
  TimeMachineCalc,
  TimeMachineDailyReport,
  TimeMachineLeaders,
  TimeMachineMode,
} from '../models/time-machine.model';

export interface TopGainerItem {
  period: string;
  periodLabel: string;
  periodShortLabel?: string;
  rank: number;
  symbol: string;
  name: string;
  returnPct: number;
  startPrice: number;
  endPrice: number;
  startDate: string;
  endDate: string;
  lastClose?: number | null;
  previousClose?: number | null;
  sparkline?: number[] | null;
  bistIndices?: string[] | null;
}

export interface TopGainersResponse {
  asOfDate: string | null;
  computedAt: string | null;
  items: TopGainerItem[];
}

interface TimeMachineApiResponse {
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

@Injectable({ providedIn: 'root' })
export class StockApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/stocks`;
  private readonly timeMachineBase = `${environment.apiUrl}/time-machine`;

  getStocks(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    isActive?: boolean;
    indexFilter?: string;
    sortBy?: 'volume' | 'price' | 'change' | 'name';
    sortDesc?: boolean;
  } = {}): Observable<PagedResult<Stock>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.isActive !== undefined) httpParams = httpParams.set('isActive', params.isActive);
    if (params.indexFilter) httpParams = httpParams.set('indexFilter', params.indexFilter);
    if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
    if (params.sortDesc !== undefined) httpParams = httpParams.set('sortDesc', params.sortDesc);

    return this.http.get<PagedResult<Stock>>(this.base, { params: httpParams });
  }

  getStock(symbol: string): Observable<StockDetail> {
    return this.http.get<StockDetail>(`${this.base}/${symbol}`);
  }

  getPriceHistory(symbol: string, from?: string, to?: string): Observable<PriceHistory[]> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<PriceHistory[]>(`${this.base}/${symbol}/price-history`, { params });
  }

  getTopGainers(marketType: 'bist' | 'crypto' | 'us' = 'bist'): Observable<TopGainersResponse> {
    const params = new HttpParams().set('marketType', marketType);
    return this.http.get<TopGainersResponse>(`${this.base}/top-gainers`, { params });
  }

  calculateTimeMachine(
    symbol: string,
    date: string,
    pct: number,
    mode: TimeMachineMode,
    amount?: number,
    marketType: 'bist' | 'crypto' = 'bist',
  ): Observable<TimeMachineCalc> {
    let params = new HttpParams()
      .set('date', date)
      .set('pct', String(pct))
      .set('mode', mode)
      .set('marketType', marketType);

    if (amount != null && amount > 0)
      params = params.set('amount', String(amount));

    return this.http
      .get<TimeMachineApiResponse>(`${this.base}/${symbol}/time-machine`, { params })
      .pipe(map((r) => this.mapTimeMachine(r, mode)));
  }

  /** Seçilen tarihten bugüne en çok kazandıran 5 hisse / 5 coin + 3 parite. */
  getTimeMachineLeaders(date: string): Observable<TimeMachineLeaders> {
    const params = new HttpParams().set('date', date);
    return this.http.get<TimeMachineLeaders>(`${this.timeMachineBase}/leaders`, { params });
  }

  /** "O gün ne alsaydım zengin olurdum?" — BIST/Kripto/ABD için en çok kazandıran ve kaybettiren 3'er. */
  getTimeMachineDailyReport(date: string): Observable<TimeMachineDailyReport> {
    const params = new HttpParams().set('date', date);
    return this.http.get<TimeMachineDailyReport>(`${this.timeMachineBase}/daily-report`, { params });
  }

  private mapTimeMachine(r: TimeMachineApiResponse, mode: TimeMachineMode): TimeMachineCalc {
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
      series: (r.series ?? []).map((p) => ({
        year: p.year,
        month: p.month,
        price: Number(p.price),
      })),
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
