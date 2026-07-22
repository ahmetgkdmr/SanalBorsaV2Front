import { Injectable, signal } from '@angular/core';

export type MarketKind = 'bist' | 'crypto';

const KEY = 'sb_market_type';

@Injectable({ providedIn: 'root' })
export class MarketTypeService {
  private readonly _type = signal<MarketKind>(loadInitial());

  readonly type = this._type.asReadonly();

  setType(type: MarketKind): void {
    this._type.set(type);
    localStorage.setItem(KEY, type);
  }
}

function loadInitial(): MarketKind {
  const v = localStorage.getItem(KEY);
  return v === 'crypto' ? 'crypto' : 'bist';
}
