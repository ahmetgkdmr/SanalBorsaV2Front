export type MarketType = 'bist' | 'crypto' | 'us';

export interface PortfolioHolding {
  symbol: string;
  marketType: MarketType;
  quantity: number;
  avgCost: number;
  /** @deprecated alias for quantity (BIST UI) */
  lots?: number;
}

export interface PortfolioTransaction {
  id: string;
  symbol: string;
  marketType: MarketType;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  fillBreakdownJson?: string | null;
  /** Crypto/US işlemlerinde kullanılan anlık USD/TRY kuru (BIST'te yok). */
  exchangeRateAtTrade?: number;
  at: string;
  /** @deprecated */
  lots?: number;
}

export interface PortfolioState {
  /** Tek nakit havuzu (TRY) — BIST, Kripto ve ABD hisseleri ortak kullanır. */
  cash: number;
  holdings: PortfolioHolding[];
  /** @deprecated sayfalı endpoint kullan */
  transactions: PortfolioTransaction[];
}

export interface PagedTransactions {
  items: PortfolioTransaction[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** @deprecated Eski local-auth için — AuthUser kullan. */
export interface UserSession {
  username: string;
  createdAt: string;
}
