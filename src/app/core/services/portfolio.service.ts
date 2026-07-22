import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PortfolioState } from '../models/portfolio.model';
import { CryptoFillPreview } from '../models/crypto.model';
import { AuthService } from './auth.service';
import { PortfolioApiService } from './portfolio-api.service';

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(PortfolioApiService);

  private readonly state = signal<PortfolioState>(this.emptyState());
  private readonly loading = signal(false);
  private readonly error = signal<string | null>(null);

  readonly portfolio = this.state.asReadonly();
  readonly isLoading = this.loading.asReadonly();
  readonly lastError = this.error.asReadonly();

  readonly cashTry = computed(() => this.state().cashTry);
  readonly cashUsd = computed(() => this.state().cashUsd);

  constructor() {
    // Login olunca backend'den çek
    queueMicrotask(() => {
      if (this.auth.isLoggedIn()) void this.reload();
    });
  }

  async reload(): Promise<void> {
    if (!this.auth.isLoggedIn() || !this.auth.getAccessToken()) {
      this.state.set(this.emptyState());
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const p = await firstValueFrom(this.api.get());
      this.state.set(p);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Portföy yüklenemedi.');
      this.state.set(this.emptyState());
    } finally {
      this.loading.set(false);
    }
  }

  /** BIST al — fiyat backend'de belirlenir. */
  async buy(symbol: string, lots: number, _price?: number): Promise<string | null> {
    if (!this.auth.isLoggedIn()) return 'Giriş yapmalısın.';
    try {
      const p = await firstValueFrom(this.api.buyBist(symbol, lots));
      this.state.set(p);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Alım başarısız.';
    }
  }

  /** BIST sat. */
  async sell(symbol: string, lots: number, _price?: number): Promise<string | null> {
    if (!this.auth.isLoggedIn()) return 'Giriş yapmalısın.';
    try {
      const p = await firstValueFrom(this.api.sellBist(symbol, lots));
      this.state.set(p);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Satış başarısız.';
    }
  }

  async buyCrypto(
    symbol: string,
    opts: { quoteUsd?: number; quantity?: number },
  ): Promise<{ error: string | null; fill?: CryptoFillPreview }> {
    if (!this.auth.isLoggedIn()) return { error: 'Giriş yapmalısın.' };
    try {
      const r = await firstValueFrom(this.api.buyCrypto(symbol, opts));
      this.state.set(r.portfolio);
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
      return { error: null, fill: r.fill };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Satış başarısız.' };
    }
  }

  private emptyState(): PortfolioState {
    return { cashTry: 0, cashUsd: 0, cash: 0, holdings: [], transactions: [] };
  }
}
