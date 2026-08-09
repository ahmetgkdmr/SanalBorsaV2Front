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
  'USDTRY', 'EURTRY', 'GRAMALTIN',
] as const;

/** TL bazlı pariteler — hisseye alternatif olarak zaman makinesinde de seçilebilir. */
export const PARITY_SYMBOLS = ['USDTRY', 'EURTRY', 'GRAMALTIN'] as const;

export type ParitySymbol = (typeof PARITY_SYMBOLS)[number];

export const PARITY_LABELS: Record<ParitySymbol, string> = {
  USDTRY: 'Dolar',
  EURTRY: 'Euro',
  GRAMALTIN: 'Gram Altın',
};

export const PARITY_ICONS: Record<ParitySymbol, string> = {
  USDTRY: '💵',
  EURTRY: '💶',
  GRAMALTIN: '🥇',
};

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
  mkDefault('XMANA',  'BİST METAL ANA',  'INDEX'),
  mkDefault('XSPOR',  'BİST SPOR',       'INDEX'),
  mkDefault('XKTUM',  'BİST KATILIM',    'INDEX'),
  mkDefault('XKURY',  'BİST KUR. YÖN.',  'INDEX'),
  mkDefault('USDTRY', 'USD/TRY',         'FX', 4),
  mkDefault('EURTRY', 'EUR/TRY',         'FX', 4),
  mkDefault('GRAMALTIN', 'GRAM ALTIN',   'FX', 2),
];

export function isForexSymbol(symbol: string): boolean {
  return PARITY_SYMBOLS.includes(symbol as ParitySymbol);
}

/** BIST endeks sembolleri (pariteler hariç). Endeks bileşimi değişir; TM için uygun değil. */
export function isIndexSymbol(symbol: string): boolean {
  return !isForexSymbol(symbol) && INDEX_SYMBOLS.includes(symbol as IndexSymbol);
}
