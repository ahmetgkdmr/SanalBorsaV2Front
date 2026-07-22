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
  lastClose?: number | null;
  lastOpen?: number | null;
  previousClose?: number | null;
  lastVolume?: number | null;
  sparkline?: number[] | null;
  bistIndices?: string[] | null;
  topGainerPeriod?: string | null;
  topGainerLabel?: string | null;
  topGainerReturnPct?: number | null;
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
  symbol: string;
  actionType: string;
  actionTypeName: string;
  actionDate: string;
  value: number;
  description: string | null;
  createdAt: string;
}

export interface StockCardView extends Stock {
  close: number;
  open: number;
  changePct: number;
  sparkline: number[];
  volume: number;
  color: string;
  /** En yüksek BIST kademesi: "BIST 30" | "BIST 50" | "BIST 100" | "" */
  tierBadge: string;
  /** Dönem şampiyonu etiketi */
  crownLabel?: string | null;
  crownPeriod?: string | null;
  crownReturnPct?: number | null;
  /**
   * Kart kenar rengi için yön.
   * true/false verilirse changePct yerine bu kullanılır (kripto tick).
   */
  tickUp?: boolean | null;
  /** Binance PRICE_FILTER tickSize ondalık hanesi */
  priceDecimals?: number | null;
}

/** Hisse listesi filtre türü — 'all' veya herhangi bir endeks sembolü (XU030, XBANK, ...) */
export type MarketFilter = string;
