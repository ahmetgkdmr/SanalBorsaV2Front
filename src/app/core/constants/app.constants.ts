export interface IndexTicker {
  name: string;
  value: number;
  decimals?: number;
}

/** Demo endeks verileri — gerçek endeks API'si eklendiğinde değiştirilecek */
export const DEMO_INDICES: IndexTicker[] = [
  { name: 'BIST 100', value: 10847.32 },
  { name: 'BIST 50', value: 9634.18 },
  { name: 'BIST 30', value: 11592.47 },
  { name: 'BIST BANKA', value: 14208.65 },
  { name: 'USD/TRY', value: 41.26, decimals: 4 },
];

export const STARTING_CASH = 1_000_000;
export const PREMIUM_PASSWORD = '12345';

export const MINIMUM_WAGE_BY_YEAR: Record<number, number> = {
  2010: 599, 2011: 658, 2012: 739, 2013: 803, 2014: 891, 2015: 1000,
  2016: 1300, 2017: 1404, 2018: 1603, 2019: 2020, 2020: 2324, 2021: 2825,
  2022: 4900, 2023: 10100, 2024: 17002, 2025: 22104, 2026: 30000,
};
