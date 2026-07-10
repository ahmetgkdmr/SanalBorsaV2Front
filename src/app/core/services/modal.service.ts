import { Injectable, signal } from '@angular/core';

export type ModalId = 'timeMachine' | 'login' | 'stockDetail' | 'premium' | null;

@Injectable({ providedIn: 'root' })
export class ModalService {
  readonly active = signal<ModalId>(null);
  readonly stockSymbol = signal<string | null>(null);
  readonly premiumUnlocked = signal(
    localStorage.getItem('sb_premium') === '1',
  );

  open(id: ModalId): void {
    this.active.set(id);
    document.body.style.overflow = 'hidden';
  }

  openStock(symbol: string): void {
    this.stockSymbol.set(symbol);
    this.open('stockDetail');
  }

  openTimeMachine(symbol?: string): void {
    if (symbol) this.stockSymbol.set(symbol);
    this.open('timeMachine');
  }

  close(): void {
    this.active.set(null);
    document.body.style.overflow = '';
  }

  unlockPremium(): void {
    this.premiumUnlocked.set(true);
    localStorage.setItem('sb_premium', '1');
  }
}
