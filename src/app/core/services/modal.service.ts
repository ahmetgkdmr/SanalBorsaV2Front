import { Injectable, signal } from '@angular/core';

export type ModalId = 'timeMachine' | 'login' | 'stockDetail' | 'cryptoDetail' | null;
export type TimeMachineMarket = 'bist' | 'crypto';

@Injectable({ providedIn: 'root' })
export class ModalService {
  readonly active = signal<ModalId>(null);
  readonly stockSymbol = signal<string | null>(null);
  readonly timeMachineMarket = signal<TimeMachineMarket>('bist');

  open(id: ModalId): void {
    this.active.set(id);
    document.body.style.overflow = 'hidden';
  }

  openStock(symbol: string): void {
    this.stockSymbol.set(symbol);
    this.timeMachineMarket.set('bist');
    this.open('stockDetail');
  }

  openCrypto(symbol: string): void {
    this.stockSymbol.set(symbol);
    this.timeMachineMarket.set('crypto');
    this.open('cryptoDetail');
  }

  openTimeMachine(symbol?: string, market: TimeMachineMarket = 'bist'): void {
    if (symbol) this.stockSymbol.set(symbol);
    this.timeMachineMarket.set(market);
    this.open('timeMachine');
  }

  close(): void {
    this.active.set(null);
    document.body.style.overflow = '';
  }
}
