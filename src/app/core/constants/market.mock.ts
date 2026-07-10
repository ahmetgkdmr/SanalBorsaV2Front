import { BistTier, StockCardView } from '../models/stock.model';
import { TIER_RANK } from './bist-tiers';
import { changePercent } from '../utils/format.util';
import { MINIMUM_WAGE_BY_YEAR } from './app.constants';

export type MockTier = BistTier;
export type TimeMachineMode = 'lump' | 'dca';

export interface LiveStockState {
  symbol: string;
  name: string;
  tier: MockTier;
  color: string;
  price: number;
  prev: number;
  open: number;
  hist: number[];
  volume: number;
}

type SeedRow = [symbol: string, name: string, tier: MockTier, color: string, basePrice: number];

export const MOCK_STOCK_SEED: SeedRow[] = [
  ['THYAO', 'Türk Hava Yolları', 'b30', '#c8102e', 295.5],
  ['GARAN', 'Garanti BBVA', 'b30', '#00857c', 128.4],
  ['AKBNK', 'Akbank', 'b30', '#e30613', 67.85],
  ['ISCTR', 'İş Bankası (C)', 'b30', '#004a8f', 13.92],
  ['YKBNK', 'Yapı Kredi', 'b30', '#00337f', 34.16],
  ['ASELS', 'Aselsan', 'b30', '#1f4e9c', 71.2],
  ['EREGL', 'Ereğli Demir Çelik', 'b30', '#5b6770', 52.35],
  ['KCHOL', 'Koç Holding', 'b30', '#b1122b', 245.1],
  ['SAHOL', 'Sabancı Holding', 'b30', '#003da5', 98.75],
  ['TUPRS', 'Tüpraş', 'b30', '#e84e0f', 172.9],
  ['SISE', 'Şişecam', 'b30', '#0072bc', 48.62],
  ['BIMAS', 'BİM Mağazalar', 'b30', '#d6001c', 512.0],
  ['FROTO', 'Ford Otosan', 'b30', '#003478', 1024.5],
  ['TCELL', 'Turkcell', 'b30', '#ffc900', 112.3],
  ['PGSUS', 'Pegasus', 'b30', '#f9a01b', 228.4],
  ['TOASO', 'Tofaş Oto', 'b30', '#9d1d27', 236.7],
  ['ENKAI', 'Enka İnşaat', 'b30', '#00539b', 64.15],
  ['KOZAL', 'Koza Altın', 'b30', '#c9a227', 28.94],
  ['ASTOR', 'Astor Enerji', 'b30', '#1b3a6b', 118.6],
  ['HEKTS', 'Hektaş', 'b30', '#2e7d32', 19.47],
  ['PETKM', 'Petkim', 'b50', '#f26522', 21.36],
  ['ARCLK', 'Arçelik', 'b50', '#e2001a', 142.8],
  ['VESTL', 'Vestel', 'b50', '#e2231a', 74.25],
  ['TAVHL', 'TAV Havalimanları', 'b50', '#00427a', 312.6],
  ['ALARK', 'Alarko Holding', 'b50', '#00695c', 96.4],
  ['OYAKC', 'Oyak Çimento', 'b50', '#546e7a', 38.72],
  ['DOHOL', 'Doğan Holding', 'b50', '#7b1fa2', 14.83],
  ['EKGYO', 'Emlak Konut GYO', 'b50', '#8d6e63', 9.57],
  ['GUBRF', 'Gübre Fabrikaları', 'b50', '#33691e', 187.3],
  ['SASA', 'Sasa Polyester', 'b50', '#0277bd', 4.12],
  ['MGROS', 'Migros', 'b50', '#ff6f00', 485.9],
  ['ULKER', 'Ülker Bisküvi', 'b50', '#b71c1c', 108.45],
  ['AEFES', 'Anadolu Efes', 'b50', '#1565c0', 214.7],
  ['CCOLA', 'Coca-Cola İçecek', 'b50', '#c62828', 56.85],
  ['TTKOM', 'Türk Telekom', 'b50', '#0091d0', 48.9],
  ['AGHOL', 'AG Anadolu Grubu', 'b100', '#37474f', 342.5],
  ['AKSEN', 'Aksa Enerji', 'b100', '#f57f17', 41.28],
  ['BRSAN', 'Borusan Boru', 'b100', '#455a64', 528.75],
  ['CIMSA', 'Çimsa', 'b100', '#5d4037', 42.16],
  ['DOAS', 'Doğuş Otomotiv', 'b100', '#212121', 245.3],
  ['EGEEN', 'Ege Endüstri', 'b100', '#4527a0', 5120.0],
  ['ENJSA', 'Enerjisa', 'b100', '#00838f', 64.9],
  ['GESAN', 'Girişim Elektrik', 'b100', '#283593', 87.35],
  ['ISGYO', 'İş GYO', 'b100', '#00695c', 8.24],
  ['KARSN', 'Karsan', 'b100', '#bf360c', 12.66],
  ['KONTR', 'Kontrolmatik', 'b100', '#1a237e', 42.58],
  ['MAVI', 'Mavi Giyim', 'b100', '#01579b', 96.15],
  ['ODAS', 'Odaş Elektrik', 'b100', '#e65100', 7.93],
  ['SMRTG', 'Smart Güneş', 'b100', '#f9a825', 38.44],
  ['ZOREN', 'Zorlu Enerji', 'b100', '#6a1b9a', 3.87],
  ['ADESE', 'Adese AVM', 'all', '#8e24aa', 2.14],
  ['AVGYO', 'Avrasya GYO', 'all', '#3949ab', 1.86],
  ['BEYAZ', 'Beyaz Filo', 'all', '#37474f', 24.6],
  ['ETILR', 'Etiler Gıda', 'all', '#d84315', 6.42],
  ['MERKO', 'Merko Gıda', 'all', '#2e7d32', 4.95],
  ['PENTA', 'Penta Teknoloji', 'all', '#0d47a1', 68.3],
];

export const SIMULATION_EVENTS: Record<number, string> = {
  2013: '⚡ Sert dalgalanma dönemi',
  2016: '🌪️ Volatilite zirvede',
  2018: '💱 Kur şoku — piyasa sarsılıyor',
  2020: '🦠 Pandemi çöküşü... ve toparlanma',
  2021: '🚀 Tarihi ralli başlıyor',
  2023: '🗳️ Seçim volatilitesi',
  2025: '📈 Yeni zirve arayışı',
};

const NOW_YEAR = 2026;

export interface SimulationPoint {
  year: number;
  month: number;
  price: number;
}

export interface TimeMachineCalc {
  symbol: string;
  mode: TimeMachineMode;
  invested: number;
  currentValue: number;
  gainPct: number;
  lots: number;
  buyPrice: number;
  currentPrice: number;
  series: SimulationPoint[];
  valueSeries: number[];
  lotSeries: number[];
  dateLabel: string;
  error?: string;
}

/** @deprecated TimeMachineCalc kullan */
export interface TimeMachineResult {
  invested: number;
  currentValue: number;
  gainPct: number;
  lots: number;
  buyPrice: number;
  currentPrice: number;
}

export function createLiveStocks(): LiveStockState[] {
  return MOCK_STOCK_SEED.map(([symbol, name, tier, color, base]) => ({
    symbol,
    name,
    tier,
    color,
    price: base,
    prev: base,
    open: base * (1 + (Math.random() - 0.5) * 0.03),
    hist: Array.from({ length: 28 }, () => base * (1 + (Math.random() - 0.5) * 0.02)),
    volume: Math.floor(Math.random() * 900 + 50) / 10,
  }));
}

export function tickLiveStocks(stocks: LiveStockState[]): LiveStockState[] {
  const count = 4 + Math.floor(Math.random() * 6);
  const next = stocks.map((s) => ({ ...s, hist: [...s.hist] }));

  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * next.length);
    const s = next[idx];
    s.prev = s.price;
    s.price = Math.max(0.1, s.price * (1 + (Math.random() - 0.5) * 0.012));
    s.hist.push(s.price);
    s.hist.shift();
    s.volume += Math.random() * 2;
  }

  return next;
}

export function matchesMockFilter(
  stock: LiveStockState,
  filter: string,
  search: string,
): boolean {
  const query = search.trim().toLocaleUpperCase('tr-TR');
  if (query && !stock.symbol.includes(query) && !stock.name.toLocaleUpperCase('tr-TR').includes(query)) {
    return false;
  }
  if (filter === 'all') return true;
  return TIER_RANK[stock.tier] <= TIER_RANK[filter as MockTier];
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
    earliestDataDate: '2010-01-01',
    latestDataDate: new Date().toISOString(),
    needsHistoryRefresh: false,
    close: stock.price,
    open: stock.open,
    changePct: changePercent(stock.price, stock.open),
    sparkline: stock.hist,
    volume: stock.volume,
    color: stock.color,
    tier: stock.tier,
  };
}

function seedFrom(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function historyFor(ticker: string, currentPrice: number): Record<number, number> {
  const rnd = mulberry(seedFrom(ticker));
  const anchors: Record<number, number> = {};
  anchors[NOW_YEAR] = currentPrice;
  let p = currentPrice;

  for (let y = NOW_YEAR - 1; y >= 2010; y--) {
    let g = 1.18 + rnd() * 0.37;
    if (y + 1 === 2018 || y + 1 === 2020) g *= 0.82 + rnd() * 0.1;
    p = (p / g) * (0.9 + rnd() * 0.2);
    anchors[y] = Math.max(0.05, p);
  }

  return anchors;
}

function monthlySeriesFullYear(ticker: string, fromYear: number, currentPrice: number): SimulationPoint[] {
  const anchors = historyFor(ticker, currentPrice);
  const rnd = mulberry(seedFrom(ticker + '-' + fromYear));
  const pts: SimulationPoint[] = [];

  for (let year = fromYear; year < NOW_YEAR; year++) {
    const a = anchors[year];
    const b = anchors[year + 1];
    const vol = year === 2018 || year === 2020 || year === 2023 ? 0.13 : 0.05;
    for (let month = 0; month < 12; month++) {
      const t = month / 12;
      let v = a * Math.pow(b / a, t) * (1 + (rnd() - 0.5) * 2 * vol);
      if (year === 2020 && month >= 2 && month <= 4) v *= 0.72 + rnd() * 0.1;
      pts.push({ year, month, price: Math.max(0.03, v) });
    }
  }
  pts.push({ year: NOW_YEAR, month: 0, price: anchors[NOW_YEAR] });
  return pts;
}

function seriesFromDate(ticker: string, dateStr: string, currentPrice: number) {
  const d = new Date(dateStr + 'T12:00:00');
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const full = monthlySeriesFullYear(ticker, y, currentPrice);
  const sliced = full.slice(m);
  const p0 = full[m].price;
  const p1 = (full[m + 1] ?? full[m]).price;
  const dayRnd = mulberry(seedFrom(ticker + dateStr))();
  const buyPrice = Math.max(0.03, (p0 + ((p1 - p0) * (day - 1)) / 30) * (0.985 + dayRnd * 0.03));

  return { series: sliced, buyPrice, year: y, dateObj: d };
}

export function calculateTimeMachineFull(
  ticker: string,
  dateStr: string,
  pct: number,
  currentPrice: number,
  mode: TimeMachineMode = 'lump',
): TimeMachineCalc {
  const { series, buyPrice, year, dateObj } = seriesFromDate(ticker, dateStr, currentPrice);
  const wage = MINIMUM_WAGE_BY_YEAR[year] ?? MINIMUM_WAGE_BY_YEAR[2026];
  const dateLabel = dateObj.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (mode === 'lump') {
    const rawInvested = wage * (pct / 100);
    const lots = Math.floor(rawInvested / buyPrice);
    if (lots < 1) {
      return {
        symbol: ticker,
        mode,
        invested: 0,
        currentValue: 0,
        gainPct: 0,
        lots: 0,
        buyPrice,
        currentPrice: series.at(-1)?.price ?? currentPrice,
        series,
        valueSeries: [],
        lotSeries: [],
        dateLabel,
        error: `Maalesef 😅 ${dateLabel} günü ${Math.round(rawInvested).toLocaleString('tr-TR')} ₺ ile ${ticker}'dan 1 lot bile alamazdın (fiyat ~${buyPrice.toFixed(2)} ₺). Oranı artır ya da "Her Ay Düzenli" modunu dene.`,
      };
    }

    const invested = lots * buyPrice;
    const valueSeries = series.map((p) => lots * p.price);
    const currentValue = valueSeries.at(-1) ?? 0;
    const gainPct = invested ? ((currentValue - invested) / invested) * 100 : 0;

    return {
      symbol: ticker,
      mode,
      invested,
      currentValue,
      gainPct,
      lots,
      buyPrice,
      currentPrice: series.at(-1)?.price ?? currentPrice,
      series,
      valueSeries,
      lotSeries: series.map(() => lots),
      dateLabel,
    };
  }

  let cash = 0;
  let lots = 0;
  let invested = 0;
  const valueSeries: number[] = [];
  const lotSeries: number[] = [];

  series.forEach((p, i) => {
    if (i < series.length - 1) {
      const amt = (MINIMUM_WAGE_BY_YEAR[p.year] ?? wage) * (pct / 100);
      cash += amt;
      invested += amt;
      const buy = Math.floor(cash / p.price);
      lots += buy;
      cash -= buy * p.price;
    }
    lotSeries.push(lots);
    valueSeries.push(lots * p.price + cash);
  });

  if (lots < 1) {
    return {
      symbol: ticker,
      mode,
      invested: 0,
      currentValue: 0,
      gainPct: 0,
      lots: 0,
      buyPrice,
      currentPrice: series.at(-1)?.price ?? currentPrice,
      series,
      valueSeries: [],
      lotSeries: [],
      dateLabel,
      error: 'Bu oranla aylık tutar 1 lota bile yetmemiş 😅 Oranı artırmayı dene.',
    };
  }

  const currentValue = valueSeries.at(-1) ?? 0;
  const gainPct = invested ? ((currentValue - invested) / invested) * 100 : 0;

  return {
    symbol: ticker,
    mode,
    invested,
    currentValue,
    gainPct,
    lots,
    buyPrice,
    currentPrice: series.at(-1)?.price ?? currentPrice,
    series,
    valueSeries,
    lotSeries,
    dateLabel,
  };
}

export function calculateTimeMachine(
  ticker: string,
  dateStr: string,
  wageYearAmount: number,
  currentPrice: number,
): TimeMachineResult | null {
  const pct = wageYearAmount > 0 ? 50 : 50;
  const year = +dateStr.slice(0, 4);
  const wage = MINIMUM_WAGE_BY_YEAR[year] ?? MINIMUM_WAGE_BY_YEAR[2026];
  const actualPct = (wageYearAmount / wage) * 100;
  const calc = calculateTimeMachineFull(ticker, dateStr, actualPct, currentPrice, 'lump');
  if (calc.error) return null;
  return calc;
}
