export type TimeMachineMode = 'lump' | 'dca';

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
  initialLots: number;
  lots: number;
  buyPrice: number;
  currentPrice: number;
  series: SimulationPoint[];
  valueSeries: number[];
  lotSeries: number[];
  dateLabel: string;
  error?: string;
}

export const SIMULATION_EVENTS: Record<number, string> = {
  2013: '⚡ Sert dalgalanma dönemi',
  2016: '🌪️ Volatilite zirvede',
  2018: '💱 Kur şoku — piyasa sarsılıyor',
  2020: '🦠 Pandemi çöküşü... ve toparlanma',
  2021: '🚀 Tarihi ralli başlıyor',
  2023: '🗳️ Seçim volatilitesi',
  2025: '📈 Yeni zirve arayışı',
};
