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
  earliestDate?: string | null;
  sparkline: number[];
}

export const INDEX_SYMBOLS = [
  'XU100', 'XU030', 'XU050', 'XBANK',
  'XUTEK', 'XUSIN', 'XUHIZ', 'XUMAL',
  'XGIDA', 'XKMYA', 'XELKT', 'XTAST',
  'XMANA', 'XSPOR', 'XKTUM', 'XKURY',
  'USDTRY',
] as const;

export type IndexSymbol = (typeof INDEX_SYMBOLS)[number];

function mkDefault(symbol: string, displayName: string, exchange: 'INDEX' | 'FX', decimals = 2): IndexQuote {
  return { symbol, name: displayName, displayName, exchange, value: 0, previousClose: null, changePct: 0, isUp: true, decimals, latestDate: null, sparkline: [] };
}

export const DEFAULT_INDEX_QUOTES: IndexQuote[] = [
  mkDefault('XU100',  'BIST 100',        'INDEX'),
  mkDefault('XU030',  'BIST 30',         'INDEX'),
  mkDefault('XU050',  'BIST 50',         'INDEX'),
  mkDefault('XBANK',  'BIST BANKA',      'INDEX'),
  mkDefault('XUTEK',  'BİST TEKNOLOJİ', 'INDEX'),
  mkDefault('XUSIN',  'BİST SINAI',      'INDEX'),
  mkDefault('XUHIZ',  'BİST HİZMETLER', 'INDEX'),
  mkDefault('XUMAL',  'BİST MALİ',       'INDEX'),
  mkDefault('XGIDA',  'BİST GIDA',       'INDEX'),
  mkDefault('XKMYA',  'BİST KİMYA',      'INDEX'),
  mkDefault('XELKT',  'BİST ELEKTRİK',  'INDEX'),
  mkDefault('XTAST',  'BİST TAŞ TOPRAK', 'INDEX'),
  mkDefault('XMANA',  'BİST MALİ A.Ş.', 'INDEX'),
  mkDefault('XSPOR',  'BİST SPOR',       'INDEX'),
  mkDefault('XKTUM',  'BİST KATILIM',    'INDEX'),
  mkDefault('XKURY',  'BİST KUR. YÖN.',  'INDEX'),
  mkDefault('USDTRY', 'USD/TRY',         'FX', 4),
];

export function isForexSymbol(symbol: string): boolean {
  return symbol === 'USDTRY';
}

/** BIST endeks sembolleri (USDTRY hariç). Endeks bileşimi değişir; TM için uygun değil. */
export function isIndexSymbol(symbol: string): boolean {
  return symbol !== 'USDTRY' && INDEX_SYMBOLS.includes(symbol as IndexSymbol);
}
