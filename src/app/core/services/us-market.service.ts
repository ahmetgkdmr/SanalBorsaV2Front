import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, map, throwError } from 'rxjs';
import { Stock, StockCardView } from '../models/stock.model';
import { changePercent, symbolColor } from '../utils/format.util';
import { UsStockApiService } from './us-stock-api.service';

export const US_PAGE_SIZE = 50;

/** BIST'teki MarketSortKey ile aynı isimler — market.page.ts'in ortak sıralama satırı bunları bekliyor. */
export type UsSortKey = 'volume' | 'price' | 'change' | 'name';

/**
 * ABD hisseleri (S&P 500 pilotu) — sadece 10 sembol, hepsi tek seferde çekilir,
 * sıralama/arama client-side yapılır (BIST'teki gibi backend'e sayfalama isteği atmaz).
 */
@Injectable({ providedIn: 'root' })
export class UsMarketService {
  private readonly api = inject(UsStockApiService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly apiSearch = signal('');
  readonly sortKey = signal<UsSortKey>('volume');
  readonly sortDesc = signal(true);
  /** Tek sayfa — pager arayüzü BIST/kripto ile aynı şekli bekliyor diye var. */
  readonly page = signal(1);

  private readonly stocks = signal<Stock[]>([]);

  private readonly filtered = computed(() => {
    const q = this.apiSearch().trim().toUpperCase();
    const list = this.stocks();
    if (!q) return list;
    return list.filter((s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q));
  });

  readonly serverTotalCount = computed(() => this.filtered().length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.serverTotalCount() / US_PAGE_SIZE)));

  readonly cards = computed<StockCardView[]>(() => {
    const key = this.sortKey();
    const desc = this.sortDesc();
    const mul = desc ? -1 : 1;
    const sorted = [...this.filtered()].sort((a, b) => {
      let cmp = 0;
      switch (key) {
        case 'name':
          cmp = a.symbol.localeCompare(b.symbol);
          break;
        case 'price':
          cmp = (a.lastClose ?? 0) - (b.lastClose ?? 0);
          break;
        case 'change':
          cmp = changePercent(a.lastClose ?? 0, a.previousClose ?? 0)
            - changePercent(b.lastClose ?? 0, b.previousClose ?? 0);
          break;
        default:
          cmp = (a.lastVolume ?? 0) - (b.lastVolume ?? 0);
      }
      return cmp * mul;
    });
    return sorted.map(toCardView);
  });

  readonly symbolOptions = computed(() => this.stocks().map((s) => s.symbol).sort());

  loadMarket(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);

    this.api
      .getStocks(true)
      .pipe(
        map((result) => {
          this.stocks.set(result.items ?? []);
          this.loading.set(false);
        }),
        catchError((err) => {
          this.error.set('ABD hisseleri yüklenemedi. Backend çalışıyor mu?');
          this.loading.set(false);
          return throwError(() => err);
        }),
      )
      .subscribe({ error: () => undefined });
  }

  reloadMarket(): void {
    this.loadMarket();
  }

  setSearch(term: string): void {
    this.apiSearch.set(term);
  }

  setSort(key: UsSortKey): void {
    if (this.sortKey() === key) {
      this.sortDesc.update((d) => !d);
    } else {
      this.sortKey.set(key);
      this.sortDesc.set(key !== 'name');
    }
  }

  goToPage(_p: number): void {
    // Tek sayfa — pilotta 10 sembol var, sayfalamaya gerek yok.
    this.page.set(1);
  }

  getCard(symbol: string): StockCardView | undefined {
    return this.cards().find((c) => c.symbol === symbol);
  }

  getEarliestDate(symbol: string): string | null {
    return this.stocks().find((s) => s.symbol === symbol)?.earliestDataDate ?? null;
  }
}

function toCardView(stock: Stock): StockCardView {
  const close = stock.lastClose ?? 0;
  const open = stock.lastOpen ?? close;
  const prev = stock.previousClose ?? close;
  const sparkline = stock.sparkline?.length ? stock.sparkline.map(Number) : [close];

  return {
    ...stock,
    currency: 'USD',
    exchange: 'US',
    close,
    open,
    changePct: changePercent(close, prev),
    sparkline,
    volume: (stock.lastVolume ?? 0) / 1_000_000,
    color: symbolColor(stock.symbol),
    tierBadge: 'ABD',
  };
}
