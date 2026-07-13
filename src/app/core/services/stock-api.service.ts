import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import { PriceHistory } from '../models/price-history.model';
import { Stock, StockDetail } from '../models/stock.model';
import { TimeMachineCalc, TimeMachineMode } from '../models/time-machine.model';

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
  lotEvents?: {
    year: number;
    month: number;
    actionDateLabel: string;
    actionType: string;
    label: string;
    lotsBefore: number;
    lotsAfter: number;
    description?: string | null;
  }[];
  dateLabel: string;
  error?: string | null;
}

@Injectable({ providedIn: 'root' })
export class StockApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/stocks`;

  getStocks(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    isActive?: boolean;
    indexFilter?: string;
  } = {}): Observable<PagedResult<Stock>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.isActive !== undefined) httpParams = httpParams.set('isActive', params.isActive);
    if (params.indexFilter) httpParams = httpParams.set('indexFilter', params.indexFilter);

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

  calculateTimeMachine(
    symbol: string,
    date: string,
    pct: number,
    mode: TimeMachineMode,
    amount?: number,
  ): Observable<TimeMachineCalc> {
    let params = new HttpParams()
      .set('date', date)
      .set('pct', String(pct))
      .set('mode', mode);

    if (amount != null && amount > 0)
      params = params.set('amount', String(amount));

    return this.http
      .get<TimeMachineApiResponse>(`${this.base}/${symbol}/time-machine`, { params })
      .pipe(map((r) => this.mapTimeMachine(r, mode)));
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
      lotEvents: (r.lotEvents ?? []).map((e) => ({
        year: e.year,
        month: e.month,
        actionDateLabel: e.actionDateLabel,
        actionType: e.actionType,
        label: e.label,
        lotsBefore: Number(e.lotsBefore),
        lotsAfter: Number(e.lotsAfter),
        description: e.description ?? undefined,
      })),
      dateLabel: r.dateLabel,
      error: r.error ?? undefined,
    };
  }
}
