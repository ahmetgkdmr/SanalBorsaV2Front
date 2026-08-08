export type TimeMachineMode = 'lump' | 'dca';

export interface SimulationPoint {
  year: number;
  month: number;
  price: number;
}

/** Sıkıştırılmış günlük seri: tarih = startDate + days[i] gün */
export interface DailySeries {
  startDate: string;
  days: number[];
  prices: number[];
  values: number[];
}

export interface LotEventMarker {
  year: number;
  month: number;
  /** Olayın gerçek günü (0 = bilinmiyor) */
  day?: number;
  actionDateLabel: string;
  actionType: string;
  label: string;
  lotsBefore: number;
  lotsAfter: number;
  description?: string | null;
  cashReceived?: number | null;
  lotsBought?: number | null;
  story?: string | null;
}

export interface TimeMachineCalc {
  symbol: string;
  mode: TimeMachineMode;
  invested: number;
  currentValue: number;
  gainPct: number;
  initialLots: number;
  lots: number;
  buyPrice: number;
  currentPrice: number;
  series: SimulationPoint[];
  valueSeries: number[];
  lotSeries: number[];
  lotEvents: LotEventMarker[];
  /** Gün gün gerçek kapanışlar — grafik animasyonu bunu kullanır */
  dailySeries?: DailySeries;
  dateLabel: string;
  dividendsReceived: number;
  dividendsReinvested: number;
  lotsFromReinvestment: number;
  cashRemaining: number;
  storyLines: string[];
  error?: string;
}

/** "O gün başka ne alsaydın?" — önceden hesaplanmış tek satır. */
export interface TimeMachineLeader {
  rank: number;
  symbol: string;
  name: string;
  startPrice: number;
  endPrice: number;
  returnPct: number;
  /** Paranın kaça katlandığı (endPrice / startPrice) */
  multiple: number;
  startDate: string;
  endDate: string;
}

export interface TimeMachineLeaders {
  requestedDate: string;
  bist: TimeMachineLeader[];
  crypto: TimeMachineLeader[];
  usStocks: TimeMachineLeader[];
  parity: TimeMachineLeader[];
  computedAt?: string | null;
}

/** "O gün ne alsaydım zengin olurdum?" — tek bir piyasa için kazanan/kaybeden 3'erli liste. */
export interface TimeMachineDailyMarketReport {
  gainers: TimeMachineLeader[];
  losers: TimeMachineLeader[];
}

export interface TimeMachineDailyReport {
  requestedDate: string;
  bist: TimeMachineDailyMarketReport;
  crypto: TimeMachineDailyMarketReport;
  usStocks: TimeMachineDailyMarketReport;
  computedAt?: string | null;
}

export const SIMULATION_EVENTS: Record<number, string> = {
  2013: 'Sert dalgalanma dönemi',
  2016: 'Volatilite zirvede',
  2018: 'Kur şoku — piyasa sarsılıyor',
  2020: 'Pandemi çöküşü... ve toparlanma',
  2021: 'Tarihi ralli başlıyor',
  2023: 'Seçim volatilitesi',
  2025: 'Yeni zirve arayışı',
};
