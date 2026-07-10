import { Injectable, computed, inject, signal } from '@angular/core';
import { STARTING_CASH } from '../constants/app.constants';
import {
  PortfolioState,
  PortfolioTransaction,
} from '../models/portfolio.model';
import { AuthService } from './auth.service';

const PORTFOLIO_PREFIX = 'sb_portfolio_';

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private readonly auth = inject(AuthService);
  private readonly state = signal<PortfolioState>(this.emptyState());

  readonly portfolio = this.state.asReadonly();

  constructor() {
    this.loadForUser();
  }

  reload(): void {
    this.loadForUser();
  }

  private loadForUser(): void {
    const user = this.auth.currentUser();
    if (!user) {
      this.state.set(this.emptyState());
      return;
    }
    const raw = localStorage.getItem(PORTFOLIO_PREFIX + user.username);
    this.state.set(raw ? (JSON.parse(raw) as PortfolioState) : this.newPortfolio());
  }

  buy(symbol: string, lots: number, price: number): string | null {
    const total = lots * price;
    const s = structuredClone(this.state());
    if (total > s.cash) return 'Yetersiz bakiye.';

    s.cash -= total;
    const existing = s.holdings.find((h) => h.symbol === symbol);
    if (existing) {
      const newLots = existing.lots + lots;
      existing.avgCost = (existing.avgCost * existing.lots + total) / newLots;
      existing.lots = newLots;
    } else {
      s.holdings.push({ symbol, lots, avgCost: price });
    }
    s.transactions.unshift(this.tx('buy', symbol, lots, price, total));
    this.persist(s);
    return null;
  }

  sell(symbol: string, lots: number, price: number): string | null {
    const s = structuredClone(this.state());
    const holding = s.holdings.find((h) => h.symbol === symbol);
    if (!holding || holding.lots < lots) return 'Yeterli lot yok.';

    const total = lots * price;
    holding.lots -= lots;
    if (holding.lots === 0) {
      s.holdings = s.holdings.filter((h) => h.symbol !== symbol);
    }
    s.cash += total;
    s.transactions.unshift(this.tx('sell', symbol, lots, price, total));
    this.persist(s);
    return null;
  }

  private persist(state: PortfolioState): void {
    const user = this.auth.currentUser();
    if (!user) return;
    localStorage.setItem(PORTFOLIO_PREFIX + user.username, JSON.stringify(state));
    this.state.set(state);
  }

  private tx(
    side: 'buy' | 'sell',
    symbol: string,
    lots: number,
    price: number,
    total: number,
  ): PortfolioTransaction {
    return {
      id: crypto.randomUUID(),
      symbol,
      side,
      lots,
      price,
      total,
      at: new Date().toISOString(),
    };
  }

  private newPortfolio(): PortfolioState {
    return { cash: STARTING_CASH, holdings: [], transactions: [] };
  }

  private emptyState(): PortfolioState {
    return { cash: 0, holdings: [], transactions: [] };
  }
}
