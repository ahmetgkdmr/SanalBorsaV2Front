export interface PortfolioHolding {
  symbol: string;
  lots: number;
  avgCost: number;
}

export interface PortfolioTransaction {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  lots: number;
  price: number;
  total: number;
  at: string;
}

export interface PortfolioState {
  cash: number;
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
}

/** @deprecated Eski local-auth için — AuthUser kullan. */
export interface UserSession {
  username: string;
  createdAt: string;
}
