import { PriceHistory } from './price-history.model';

export interface Stock {
  id: number;
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  currency: string;
  exchange: string;
  isActive: boolean;
  earliestDataDate: string | null;
  latestDataDate: string | null;
  needsHistoryRefresh: boolean;
}

export interface StockDetail extends Stock {
  yahooSymbol: string;
  createdAt: string;
  updatedAt: string;
  recentPrices: PriceHistory[];
  corporateActions: CorporateAction[];
}

export interface CorporateAction {
  id: number;
  type: string;
  exDate: string;
  ratio: number | null;
  amount: number | null;
  description: string | null;
}

export interface StockCardView extends Stock {
  close: number;
  open: number;
  changePct: number;
  sparkline: number[];
  volume: number;
  color: string;
  tier: BistTier;
}

export type BistTier = 'b30' | 'b50' | 'b100' | 'all';
export type MarketFilter = 'all' | 'b30' | 'b50' | 'b100';
