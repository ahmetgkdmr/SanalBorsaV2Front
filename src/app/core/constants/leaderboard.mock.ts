export interface LeaderTrade {
  symbol: string;
  side: 'AL' | 'SAT';
  lots: number;
  at: string;
  price?: number;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  gainPct: number;
  portfolioValue: number;
  avatarColor: string;
  /** İşlem geçmişi herkese açık mı? */
  tradeHistoryPublic: boolean;
  trades: LeaderTrade[];
}

const MOCK_USERS = [
  'BorsaKurt', 'AltinAvcisi', 'THYAO_Lover', 'DividendKing', 'BIST30_Pro',
  'ValueHunter', 'MomentumX', 'KriptoGocmen', 'AnalizUstasi', 'YatirimGuru',
  'PortfoyPatronu', 'HisseAvcisi', 'BullRun2025', 'BearKiller', 'TrendTakipci',
  'RiskYoneticisi', 'UzunVadeci', 'GunlukTrader', 'SektörUzmani', 'EndeksAvcisi',
];

const SYMBOLS = ['THYAO', 'GARAN', 'ASELS', 'EREGL', 'SISE', 'KCHOL', 'BIMAS', 'TCELL'];

function buildTrades(seed: number): LeaderTrade[] {
  const trades: LeaderTrade[] = [];
  for (let i = 0; i < 14; i++) {
    const sym = SYMBOLS[(seed + i * 3) % SYMBOLS.length];
    const side: 'AL' | 'SAT' = (seed + i) % 3 === 0 ? 'SAT' : 'AL';
    const day = 20 - (i % 18);
    trades.push({
      symbol: sym,
      side,
      lots: 10 + ((seed + i * 7) % 90),
      price: 20 + ((seed + i * 11) % 400) + (i % 10) / 10,
      at: `2026-07-${String(Math.max(1, day)).padStart(2, '0')}`,
    });
  }
  return trades;
}

export function buildLeaderboard(): LeaderboardEntry[] {
  return MOCK_USERS.map((username, i) => {
    const gainPct = 38 - i * 1.6 + (i % 3) * 2.1;
    const portfolioValue = 1_000_000 * (1 + gainPct / 100);
    return {
      rank: i + 1,
      username,
      gainPct,
      portfolioValue,
      avatarColor: `hsl(${(i * 37) % 360} 55% 45%)`,
      // Birkaç kullanıcı gizlilik kapalı (demo blur)
      tradeHistoryPublic: i % 5 !== 2,
      trades: buildTrades(i + 1),
    };
  });
}
