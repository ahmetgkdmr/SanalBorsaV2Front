import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, of, tap } from 'rxjs';
import { DEFAULT_INDEX_QUOTES, IndexQuote } from '../models/index.model';
import { IndexApiService } from './index-api.service';

@Injectable({ providedIn: 'root' })
export class IndexService {
  private readonly api = inject(IndexApiService);

  readonly quotes = signal<IndexQuote[]>(DEFAULT_INDEX_QUOTES);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  loadQuotes(force = false): void {
    if (this.loading() && !force) return;

    this.loading.set(true);
    this.error.set(null);

    this.api
      .getQuotes()
      .pipe(
        map((items) => (items?.length ? items : DEFAULT_INDEX_QUOTES)),
        tap((items) => {
          this.quotes.set(items);
          this.loading.set(false);
        }),
        catchError(() => {
          this.error.set('Endeks verileri yüklenemedi. API yeniden başlatıldı mı?');
          this.loading.set(false);
          return of(DEFAULT_INDEX_QUOTES);
        }),
      )
      .subscribe();
  }

  hasLiveData(): boolean {
    return this.quotes().some((q) => q.value > 0);
  }

  getSymbols(): string[] {
    return this.quotes().map((q) => q.symbol);
  }

  getDisplayName(symbol: string): string {
    return this.quotes().find((q) => q.symbol === symbol)?.displayName ?? symbol;
  }
}
