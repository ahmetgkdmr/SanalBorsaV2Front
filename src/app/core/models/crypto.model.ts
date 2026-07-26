export interface CryptoTicker {
  symbol: string;
  baseAsset: string;
  price: number;
  changePercent24h: number;
  quoteVolume24h: number;
  high24h: number;
  low24h: number;
  /** Binance PRICE_FILTER tickSize ondalık hanesi */
  priceDecimals: number;
}

export interface CryptoDepthLevel {
  price: number;
  quantity: number;
}

export interface CryptoDepth {
  symbol: string;
  bids: CryptoDepthLevel[];
  asks: CryptoDepthLevel[];
}

export interface CryptoFillLevel {
  price: number;
  quantity: number;
  cost: number;
}

export interface CryptoFillPreview {
  symbol: string;
  side: string;
  filledQuantity: number;
  avgPrice: number;
  total: number;
  fullyFilled: boolean;
  levels: CryptoFillLevel[];
}

export interface CryptoCardView {
  symbol: string;
  name: string;
  close: number;
  changePct: number;
  volume: number;
  color: string;
  currency: 'USD';
  exchange: 'CRYPTO';
  tickUp: boolean;
  priceDecimals: number;
  crownLabel?: string | null;
  crownPeriod?: string | null;
  crownReturnPct?: number | null;
}
