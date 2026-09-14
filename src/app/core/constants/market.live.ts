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
