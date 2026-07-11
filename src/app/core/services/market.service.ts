import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { catchError, map, throwError } from 'rxjs';
import {
  LiveStockState,
  matchesStockFilter,
  tickLiveStocks,
  toStockCard,
} from '../constants/market.live';
import { resolveTier } from '../constants/bist-tiers';
import { MarketFilter, Stock, StockCardView } from '../models/stock.model';
import { TimeMachineCalc, TimeMachineMode } from '../models/time-machine.model';
import { symbolColor } from '../utils/format.util';
import { StockApiService } from './stock-api.service';

export const MARKET_PAGE_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class MarketService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(StockApiService);

  readonly filter = signal<MarketFilter>('all');
  readonly apiSearch = signal('');
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly serverTotalCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private readonly live = signal<LiveStockState[]>([]);
  private readonly priceCache = signal<Record<string, number>>({});
  private readonly symbolList = signal<string[]>([]);
  private tickTimer?: ReturnType<typeof setInterval>;

  readonly cards = computed(() =>
    this.live()
      .filter((s) => matchesStockFilter(s, this.filter()))
      .map((s) => toStockCard(s)),
  );

  readonly pageCount = computed(() => this.cards().length);

  readonly symbolOptions = computed(() => {
    const merged = new Set([...this.symbolList(), ...Object.keys(this.priceCache())]);
    return [...merged].sort((a, b) => a.localeCompare(b, 'tr-TR'));
  });

  loadMarket(): void {
    this.loadPage(1);
  }

  loadPage(page: number): void {
    if (this.loading()) return;

    const safePage = Math.max(1, page);
    this.loading.set(true);
    this.error.set(null);

    this.api
      .getStocks({
        page: safePage,
        pageSize: MARKET_PAGE_SIZE,
        search: this.apiSearch() || undefined,
        isActive: true,
      })
      .pipe(
        map((result) => {
          const stocks = (result.items ?? []).map((s) => this.toLiveState(s));
          this.live.set(stocks);
          this.page.set(result.page ?? safePage);
          this.totalPages.set(result.totalPages ?? 1);
          this.serverTotalCount.set(result.totalCount ?? stocks.length);
          this.mergePrices(stocks);
          this.mergeSymbols(stocks.map((s) => s.symbol));
          this.loading.set(false);
          this.startTick();
        }),
        catchError((err) => {
          this.error.set('Hisse verileri yüklenemedi. Backend çalışıyor mu?');
          this.loading.set(false);
          return throwError(() => err);
        }),
      )
      .subscribe({ error: () => undefined });
  }

  reloadMarket(): void {
    this.loadPage(this.page());
  }

  setFilter(filter: MarketFilter): void {
    this.filter.set(filter);
  }

  setSearch(term: string): void {
    this.apiSearch.set(term);
    this.loadPage(1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.loadPage(page);
  }

  getCard(symbol: string): StockCardView | undefined {
    const stock = this.live().find((s) => s.symbol === symbol);
    return stock ? toStockCard(stock) : undefined;
  }

  getPrice(symbol: string): number {
    return this.priceCache()[symbol] ?? this.live().find((s) => s.symbol === symbol)?.price ?? 0;
  }

  getSymbols(): string[] {
    return this.symbolOptions();
  }

  calculateInvestment(
    symbol: string,
    date: string,
    pct: number,
    mode: TimeMachineMode = 'lump',
  ) {
    return this.api.calculateTimeMachine(symbol, date, pct, mode);
  }

  private mergePrices(stocks: LiveStockState[]): void {
    this.priceCache.update((cache) => {
      const next = { ...cache };
      for (const s of stocks) next[s.symbol] = s.price;
      return next;
    });
  }

  private mergeSymbols(symbols: string[]): void {
    this.symbolList.update((list) => [...new Set([...list, ...symbols])].sort((a, b) => a.localeCompare(b, 'tr-TR')));
  }

  private toLiveState(stock: Stock): LiveStockState {
    const basePrice = stock.lastClose ?? 0;
    const open = stock.lastOpen ?? basePrice;
    const sparkline =
      stock.sparkline && stock.sparkline.length > 0
        ? stock.sparkline.map((v) => Number(v))
        : [basePrice];

    return {
      symbol: stock.symbol,
      name: stock.name,
      tier: resolveTier(stock.symbol),
      color: symbolColor(stock.symbol),
      basePrice,
      price: basePrice,
      prev: stock.previousClose ?? basePrice,
      open,
      hist: sparkline,
      volume: (stock.lastVolume ?? 0) / 1_000_000,
    };
  }

  private startTick(): void {
    if (this.tickTimer) return;

    this.tickTimer = setInterval(() => {
      this.live.update((stocks) => {
        const ticked = tickLiveStocks(stocks);
        this.priceCache.update((cache) => {
          const next = { ...cache };
          for (const s of ticked) next[s.symbol] = s.price;
          return next;
        });
        return ticked;
      });
    }, 1400);

    this.destroyRef.onDestroy(() => {
      if (this.tickTimer) clearInterval(this.tickTimer);
    });
  }
}
