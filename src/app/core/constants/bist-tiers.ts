import { BistTier } from '../models/stock.model';

/** BIST endeks üyelikleri — API'de yok, istemci tarafı filtre için */
export const BIST_TIER_SYMBOLS: Record<Exclude<BistTier, 'all'>, readonly string[]> = {
  b30: [
    'THYAO', 'GARAN', 'AKBNK', 'ISCTR', 'YKBNK', 'ASELS', 'EREGL', 'KCHOL', 'SAHOL', 'TUPRS',
    'SISE', 'BIMAS', 'FROTO', 'TCELL', 'PGSUS', 'TOASO', 'ENKAI', 'KOZAL', 'ASTOR', 'HEKTS',
  ],
  b50: [
    'PETKM', 'ARCLK', 'VESTL', 'TAVHL', 'ALARK', 'OYAKC', 'DOHOL', 'EKGYO', 'GUBRF', 'SASA',
    'MGROS', 'ULKER', 'AEFES', 'CCOLA', 'TTKOM',
  ],
  b100: [
    'AGHOL', 'AKSEN', 'BRSAN', 'CIMSA', 'DOAS', 'EGEEN', 'ENJSA', 'GESAN', 'ISGYO', 'KARSN',
    'KONTR', 'MAVI', 'ODAS', 'SMRTG', 'ZOREN',
  ],
};

export const TIER_RANK: Record<BistTier, number> = {
  b30: 0,
  b50: 1,
  b100: 2,
  all: 3,
};

export function resolveTier(symbol: string): BistTier {
  if (BIST_TIER_SYMBOLS.b30.includes(symbol)) return 'b30';
  if (BIST_TIER_SYMBOLS.b50.includes(symbol)) return 'b50';
  if (BIST_TIER_SYMBOLS.b100.includes(symbol)) return 'b100';
  return 'all';
}

export function tierLabel(tier: BistTier): string {
  switch (tier) {
    case 'b30': return 'BIST 30';
    case 'b50': return 'BIST 50';
    case 'b100': return 'BIST 100';
    default: return 'YILDIZ';
  }
}

export function matchesTierFilter(symbol: string, filter: string): boolean {
  if (filter === 'all') return true;
  const tier = resolveTier(symbol);
  const filterTier = filter as BistTier;
  return TIER_RANK[tier] <= TIER_RANK[filterTier];
}
