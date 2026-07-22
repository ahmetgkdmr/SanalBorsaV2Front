export type MarketType = 'bist' | 'crypto';

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
  at: string;
  /** @deprecated */
  lots?: number;
}

export interface PortfolioState {
  cashTry: number;
  cashUsd: number;
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
  /** @deprecated alias */
  cash?: number;
}

/** @deprecated Eski local-auth için — AuthUser kullan. */
export interface UserSession {
  username: string;
  createdAt: string;
}
