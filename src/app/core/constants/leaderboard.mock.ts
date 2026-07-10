export interface LeaderboardEntry {
  rank: number;
  username: string;
  gainPct: number;
  portfolioValue: number;
  avatarColor: string;
  trades: { symbol: string; side: string; lots: number; at: string }[];
}

const MOCK_USERS = [
  'BorsaKurt', 'AltinAvcisi', 'THYAO_Lover', 'DividendKing', 'BIST30_Pro',
  'ValueHunter', 'MomentumX', 'KriptoGocmen', 'AnalizUstasi', 'YatirimGuru',
  'PortfoyPatronu', 'HisseAvcisi', 'BullRun2025', 'BearKiller', 'TrendTakipci',
  'RiskYoneticisi', 'UzunVadeci', 'GunlukTrader', 'SektörUzmani', 'EndeksAvcisi',
];

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
      trades: [
        { symbol: 'THYAO', side: 'AL', lots: 50, at: '2026-07-07' },
        { symbol: 'GARAN', side: 'SAT', lots: 100, at: '2026-07-05' },
      ],
    };
  });
}
