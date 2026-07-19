import { StockCardView } from '../models/stock.model';
import { tierBadge } from './bist-tiers';
import { changePercent } from '../utils/format.util';

export interface LiveStockState {
  symbol: string;
  name: string;
  bistIndices: string[];
  color: string;
  basePrice: number;
  price: number;
  prev: number;
  open: number;
  hist: number[];
  volume: number;
  latestDataDate: string | null;
  earliestDataDate: string | null;
  topGainerPeriod?: string | null;
  topGainerLabel?: string | null;
  topGainerReturnPct?: number | null;
}

export function toStockCard(stock: LiveStockState): StockCardView {
  return {
    id: 0,
    symbol: stock.symbol,
    name: stock.name,
    sector: null,
    industry: null,
    currency: 'TRY',
    exchange: 'BIST',
    isActive: true,
    earliestDataDate: null,
    latestDataDate: null,
    needsHistoryRefresh: false,
    bistIndices: stock.bistIndices,
    close: stock.basePrice,
    open: stock.open,
    changePct: changePercent(stock.basePrice, stock.prev),
    sparkline: stock.hist,
    volume: stock.volume,
    color: stock.color,
    tierBadge: tierBadge(stock.bistIndices),
    crownLabel: stock.topGainerLabel ?? null,
    crownPeriod: stock.topGainerPeriod ?? null,
    crownReturnPct: stock.topGainerReturnPct ?? null,
  };
}

export function tickLiveStocks(stocks: LiveStockState[]): LiveStockState[] {
  const count = 4 + Math.floor(Math.random() * 6);
  const next = stocks.map((s) => ({ ...s, hist: [...s.hist] }));

  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * next.length);
    const s = next[idx];
    s.prev = s.price;
    s.price = Math.max(0.1, s.basePrice * (1 + (Math.random() - 0.5) * 0.012));
    s.hist.push(s.price);
    if (s.hist.length > 28) s.hist.shift();
    s.volume += Math.random() * 0.2;
  }

  return next;
}
