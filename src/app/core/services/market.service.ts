import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import {
  MOCK_STOCK_SEED,
  LiveStockState,
  TimeMachineCalc,
  TimeMachineMode,
  calculateTimeMachineFull,
  createLiveStocks,
  matchesMockFilter,
  tickLiveStocks,
  toStockCard,
} from '../constants/market.mock';
import { MarketFilter, StockCardView } from '../models/stock.model';

const BASE_PRICES = Object.fromEntries(MOCK_STOCK_SEED.map(([symbol, , , , price]) => [symbol, price]));

@Injectable({ providedIn: 'root' })
export class MarketService {
  private readonly destroyRef = inject(DestroyRef);

  readonly filter = signal<MarketFilter>('all');
  readonly search = signal('');
  readonly loading = signal(false);

  private readonly live = signal<LiveStockState[]>([]);
  private tickTimer?: ReturnType<typeof setInterval>;

  readonly cards = computed(() =>
    this.live()
      .filter((s) => matchesMockFilter(s, this.filter(), this.search()))
      .map((s) => toStockCard(s)),
  );

  readonly totalCount = computed(() => this.cards().length);

  loadMarket(): void {
    if (this.live().length) return;

    this.loading.set(true);
    this.live.set(createLiveStocks());
    this.loading.set(false);
    this.startTick();
  }

  setFilter(filter: MarketFilter): void {
    this.filter.set(filter);
  }

  setSearch(term: string): void {
    this.search.set(term);
  }

  getCard(symbol: string): StockCardView | undefined {
    const stock = this.live().find((s) => s.symbol === symbol);
    return stock ? toStockCard(stock) : undefined;
  }

  getPrice(symbol: string): number {
    return this.live().find((s) => s.symbol === symbol)?.price ?? BASE_PRICES[symbol] ?? 0;
  }

  getSymbols(): string[] {
    return this.live().map((s) => s.symbol);
  }

  calculateInvestment(
    symbol: string,
    date: string,
    pct: number,
    mode: TimeMachineMode = 'lump',
  ): TimeMachineCalc {
    const price = this.getPrice(symbol) || BASE_PRICES[symbol] || 100;
    return calculateTimeMachineFull(symbol, date, pct, price, mode);
  }

  private startTick(): void {
    if (this.tickTimer) return;

    this.tickTimer = setInterval(() => {
      this.live.update((stocks) => tickLiveStocks(stocks));
    }, 1400);

    this.destroyRef.onDestroy(() => {
      if (this.tickTimer) clearInterval(this.tickTimer);
    });
  }
}
