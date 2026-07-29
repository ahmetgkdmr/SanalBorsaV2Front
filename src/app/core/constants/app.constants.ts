export interface IndexTicker {
  name: string;
  symbol: string;
  value: number;
  decimals?: number;
  change?: number;
  up?: boolean;
}

export const STARTING_CASH = 1_000_000;

/**
 * Net asgari ücret dönemleri (Yeni TL).
 * 2005 öncesi resmi eski TL / 1_000_000 — fiyat serisi ile aynı birim.
 */
const MINIMUM_WAGE_PERIODS: { from: string; net: number }[] = [
  { from: '1990-01-01', net: 0.146475 },
  { from: '1990-08-01', net: 0.261954 },
  { from: '1991-01-01', net: 0.266454 },
  { from: '1991-08-01', net: 0.502911 },
  { from: '1992-01-01', net: 0.511911 },
  { from: '1992-08-01', net: 0.907839 },
  { from: '1993-01-01', net: 0.922839 },
  { from: '1993-08-01', net: 1.563473 },
  { from: '1994-01-01', net: 1.713435 },
  { from: '1994-09-01', net: 2.759429 },
  { from: '1995-01-01', net: 2.834429 },
  { from: '1995-09-01', net: 5.514192 },
  { from: '1996-01-01', net: 5.739193 },
  { from: '1996-08-01', net: 11.339802 },
  { from: '1997-01-01', net: 11.422152 },
  { from: '1997-08-01', net: 23.474588 },
  { from: '1998-01-01', net: 24.518025 },
  { from: '1998-08-01', net: 33.808514 },
  { from: '1999-01-01', net: 58.948065 },
  { from: '1999-07-01', net: 70.22232 },
  { from: '2000-01-01', net: 82.4175 },
  { from: '2000-07-01', net: 86.9229 },
  { from: '2001-01-01', net: 102.3696 },
  { from: '2001-08-01', net: 122.18652 },
  { from: '2002-01-01', net: 163.563536 },
  { from: '2002-07-01', net: 184.251937 },
  { from: '2003-01-01', net: 225.999 },
  { from: '2004-01-01', net: 303.0795 },
  { from: '2004-07-01', net: 318.233475 },
  { from: '2005-01-01', net: 350.15 },
  { from: '2006-01-01', net: 380.46 },
  { from: '2007-01-01', net: 403.03 },
  { from: '2007-07-01', net: 419.15 },
  { from: '2008-01-01', net: 481.55 },
  { from: '2008-07-01', net: 503.26 },
  { from: '2009-01-01', net: 527.13 },
  { from: '2009-07-01', net: 546.48 },
  { from: '2010-01-01', net: 576.57 },
  { from: '2010-07-01', net: 599.12 },
  { from: '2011-01-01', net: 629.96 },
  { from: '2011-07-01', net: 658.95 },
  { from: '2012-01-01', net: 701.13 },
  { from: '2012-07-01', net: 739.79 },
  { from: '2013-01-01', net: 773.01 },
  { from: '2013-07-01', net: 803.68 },
  { from: '2014-01-01', net: 846 },
  { from: '2014-07-01', net: 891.03 },
  { from: '2015-01-01', net: 949.07 },
  { from: '2015-07-01', net: 1000.54 },
  { from: '2016-01-01', net: 1300.99 },
  { from: '2017-01-01', net: 1404.06 },
  { from: '2018-01-01', net: 1603.12 },
  { from: '2019-01-01', net: 2020.9 },
  { from: '2020-01-01', net: 2324.71 },
  { from: '2021-01-01', net: 2825.9 },
  { from: '2022-01-01', net: 4253.4 },
  { from: '2022-07-01', net: 5500.35 },
  { from: '2023-01-01', net: 8506.8 },
  { from: '2023-07-01', net: 11402.32 },
  { from: '2024-01-01', net: 17002.12 },
  { from: '2025-01-01', net: 22104.67 },
  { from: '2026-01-01', net: 30000 },
];

/** @deprecated Yıllık bakış — tercih et: getMinimumWage(isoDate) */
export const MINIMUM_WAGE_BY_YEAR: Record<number, number> = Object.fromEntries(
  MINIMUM_WAGE_PERIODS.filter((p) => p.from.endsWith('-01-01')).map((p) => [
    +p.from.slice(0, 4),
    p.net,
  ]),
);

export function getMinimumWage(isoDate: string): number {
  const d = isoDate.slice(0, 10);
  let wage = MINIMUM_WAGE_PERIODS[0].net;
  for (const p of MINIMUM_WAGE_PERIODS) {
    if (p.from > d) break;
    wage = p.net;
  }
  return wage;
}
