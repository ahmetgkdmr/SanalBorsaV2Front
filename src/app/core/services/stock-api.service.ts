import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import { PriceHistory } from '../models/price-history.model';
import { Stock, StockDetail } from '../models/stock.model';

@Injectable({ providedIn: 'root' })
export class StockApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/stocks`;

  getStocks(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    isActive?: boolean;
  } = {}): Observable<PagedResult<Stock>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.isActive !== undefined) httpParams = httpParams.set('isActive', params.isActive);

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
}
