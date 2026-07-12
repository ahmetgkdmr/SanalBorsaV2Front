export interface IndexQuote {
  symbol: string;
  name: string;
  displayName: string;
  exchange: string;
  value: number;
  previousClose?: number | null;
  changePct: number;
  isUp: boolean;
  decimals: number;
  latestDate?: string | null;
  sparkline: number[];
}

export const INDEX_SYMBOLS = ['XU100', 'XU030', 'XU050', 'XBANK', 'USDTRY'] as const;

export type IndexSymbol = (typeof INDEX_SYMBOLS)[number];

/** API yanıt verene kadar header'da gösterilen varsayılan kartlar */
export const DEFAULT_INDEX_QUOTES: IndexQuote[] = [
  {
    symbol: 'XU100',
    name: 'BIST 100 Endeksi',
    displayName: 'BIST 100',
    exchange: 'INDEX',
    value: 0,
    previousClose: null,
    changePct: 0,
    isUp: true,
    decimals: 2,
    latestDate: null,
    sparkline: [],
  },
  {
    symbol: 'XU030',
    name: 'BIST 30 Endeksi',
    displayName: 'BIST 30',
    exchange: 'INDEX',
    value: 0,
    previousClose: null,
    changePct: 0,
    isUp: true,
    decimals: 2,
    latestDate: null,
    sparkline: [],
  },
  {
    symbol: 'XU050',
    name: 'BIST 50 Endeksi',
    displayName: 'BIST 50',
    exchange: 'INDEX',
    value: 0,
    previousClose: null,
    changePct: 0,
    isUp: true,
    decimals: 2,
    latestDate: null,
    sparkline: [],
  },
  {
    symbol: 'XBANK',
    name: 'BIST Banka Endeksi',
    displayName: 'BIST BANKA',
    exchange: 'INDEX',
    value: 0,
    previousClose: null,
    changePct: 0,
    isUp: true,
    decimals: 2,
    latestDate: null,
    sparkline: [],
  },
  {
    symbol: 'USDTRY',
    name: 'USD/TRY Döviz Kuru',
    displayName: 'USD/TRY',
    exchange: 'FX',
    value: 0,
    previousClose: null,
    changePct: 0,
    isUp: true,
    decimals: 4,
    latestDate: null,
    sparkline: [],
  },
];

export function isIndexSymbol(symbol: string): boolean {
  return INDEX_SYMBOLS.includes(symbol as IndexSymbol);
}

export function isForexSymbol(symbol: string): boolean {
  return symbol === 'USDTRY';
}
