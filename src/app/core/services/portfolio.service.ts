import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PagedTransactions, PortfolioState, PortfolioTransaction } from '../models/portfolio.model';
import { CryptoFillPreview } from '../models/crypto.model';
import { AuthService } from './auth.service';
import { AlertService } from './alert.service';
import { PortfolioApiService } from './portfolio-api.service';
import {
  BIST_CLOSED_MESSAGE,
  BIST_CLOSED_TITLE,
  isBistClosedError,
  isBistTradingOpen,
} from '../utils/bist-trading-hours';
import {
  US_CLOSED_MESSAGE,
  US_CLOSED_TITLE,
  isUsClosedError,
  isUsTradingOpen,
} from '../utils/us-trading-hours';

const TX_PAGE_SIZE = 10;

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(PortfolioApiService);
  private readonly alerts = inject(AlertService);

  private readonly state = signal<PortfolioState>(this.emptyState());
  private readonly loading = signal(false);
  private readonly error = signal<string | null>(null);

  private readonly txItems = signal<PortfolioTransaction[]>([]);
  private readonly txPage = signal(1);
  private readonly txPageSize = signal(TX_PAGE_SIZE);
  private readonly txTotalCount = signal(0);
  private readonly txTotalPages = signal(0);
  private readonly txLoading = signal(false);

  readonly portfolio = this.state.asReadonly();
  readonly isLoading = this.loading.asReadonly();
  readonly lastError = this.error.asReadonly();

  readonly cash = computed(() => this.state().cash);

  readonly transactions = this.txItems.asReadonly();
  readonly transactionsPage = this.txPage.asReadonly();
  readonly transactionsPageSize = this.txPageSize.asReadonly();
  readonly transactionsTotalCount = this.txTotalCount.asReadonly();
  readonly transactionsTotalPages = this.txTotalPages.asReadonly();
  readonly transactionsLoading = this.txLoading.asReadonly();

  constructor() {
    queueMicrotask(() => {
      if (this.auth.isLoggedIn()) void this.reload();
    });
  }

  async reload(): Promise<void> {
    if (!this.auth.isLoggedIn() || !this.auth.getAccessToken()) {
      this.state.set(this.emptyState());
      this.clearTransactions();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const p = await firstValueFrom(this.api.get());
      this.state.set(p);
      await this.loadTransactions(1);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Portföy yüklenemedi.');
      this.state.set(this.emptyState());
      this.clearTransactions();
    } finally {
      this.loading.set(false);
    }
  }

  async loadTransactions(page: number): Promise<void> {
    if (!this.auth.isLoggedIn() || !this.auth.getAccessToken()) {
      this.clearTransactions();
      return;
    }
    this.txLoading.set(true);
    try {
      const res = await firstValueFrom(this.api.getTransactions(page, this.txPageSize()));
      this.applyTxPage(res);
    } catch {
      // sayfa yüklenemezse mevcut listeyi koru
    } finally {
      this.txLoading.set(false);
    }
  }

  /** BIST al — fiyat backend'de belirlenir. null = başarı, '__bist_closed__' = popup, diğer = hata. */
  async buy(symbol: string, lots: number, _price?: number): Promise<string | null> {
    if (!this.auth.isLoggedIn()) return 'Giriş yapmalısın.';
    if (!isBistTradingOpen()) {
      this.showBistClosed();
      return '__bist_closed__';
    }
    try {
      const p = await firstValueFrom(this.api.buyBist(symbol, lots));
      this.state.set(p);
      await this.loadTransactions(1);
      return null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Alım başarısız.';
      if (isBistClosedError(msg)) {
        this.showBistClosed();
        return '__bist_closed__';
      }
      return msg;
    }
  }

  /** BIST sat. */
  async sell(symbol: string, lots: number, _price?: number): Promise<string | null> {
    if (!this.auth.isLoggedIn()) return 'Giriş yapmalısın.';
    if (!isBistTradingOpen()) {
      this.showBistClosed();
      return '__bist_closed__';
    }
    try {
      const p = await firstValueFrom(this.api.sellBist(symbol, lots));
      this.state.set(p);
      await this.loadTransactions(1);
      return null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Satış başarısız.';
      if (isBistClosedError(msg)) {
        this.showBistClosed();
        return '__bist_closed__';
      }
      return msg;
    }
  }

  async buyCrypto(
    symbol: string,
    opts: { tryAmount?: number; quantity?: number },
  ): Promise<{ error: string | null; fill?: CryptoFillPreview }> {
    if (!this.auth.isLoggedIn()) return { error: 'Giriş yapmalısın.' };
    try {
      const r = await firstValueFrom(this.api.buyCrypto(symbol, opts));
      this.state.set(r.portfolio);
      await this.loadTransactions(1);
      return { error: null, fill: r.fill };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Alım başarısız.' };
    }
  }

  async sellCrypto(
    symbol: string,
    quantity: number,
  ): Promise<{ error: string | null; fill?: CryptoFillPreview }> {
    if (!this.auth.isLoggedIn()) return { error: 'Giriş yapmalısın.' };
    try {
      const r = await firstValueFrom(this.api.sellCrypto(symbol, quantity));
      this.state.set(r.portfolio);
      await this.loadTransactions(1);
      return { error: null, fill: r.fill };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Satış başarısız.' };
    }
  }

  /** ABD hissesi al — TL tutarı girilir, anlık kurla kesirli hisse hesaplanır. */
  async buyUs(symbol: string, tryAmount: number): Promise<string | null> {
    if (!this.auth.isLoggedIn()) return 'Giriş yapmalısın.';
    if (!isUsTradingOpen()) {
      this.showUsClosed();
      return '__us_closed__';
    }
    try {
      const p = await firstValueFrom(this.api.buyUs(symbol, tryAmount));
      this.state.set(p);
      await this.loadTransactions(1);
      return null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Alım başarısız.';
      if (isUsClosedError(msg)) {
        this.showUsClosed();
        return '__us_closed__';
      }
      return msg;
    }
  }

  /** ABD hissesi sat — kesirli miktar. */
  async sellUs(symbol: string, quantity: number): Promise<string | null> {
    if (!this.auth.isLoggedIn()) return 'Giriş yapmalısın.';
    if (!isUsTradingOpen()) {
      this.showUsClosed();
      return '__us_closed__';
    }
    try {
      const p = await firstValueFrom(this.api.sellUs(symbol, quantity));
      this.state.set(p);
      await this.loadTransactions(1);
      return null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Satış başarısız.';
      if (isUsClosedError(msg)) {
        this.showUsClosed();
        return '__us_closed__';
      }
      return msg;
    }
  }

  private applyTxPage(res: PagedTransactions): void {
    this.txItems.set(res.items);
    this.txPage.set(res.page);
    this.txPageSize.set(res.pageSize);
    this.txTotalCount.set(res.totalCount);
    this.txTotalPages.set(res.totalPages);
  }

  private clearTransactions(): void {
    this.txItems.set([]);
    this.txPage.set(1);
    this.txTotalCount.set(0);
    this.txTotalPages.set(0);
  }

  private showBistClosed(): void {
    this.alerts.show(BIST_CLOSED_TITLE, BIST_CLOSED_MESSAGE);
  }

  private showUsClosed(): void {
    this.alerts.show(US_CLOSED_TITLE, US_CLOSED_MESSAGE);
  }

  private emptyState(): PortfolioState {
    return { cash: 0, holdings: [], transactions: [] };
  }
}
