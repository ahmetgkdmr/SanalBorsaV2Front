/** GET /api/leaderboard */
export interface LeaderboardEntry {
  rank: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  portfolioValue: number;
  gainPct: number;
  /** Kullanıcı işlem geçmişini herkese açık yaptıysa detay modalında liste gösterilir. */
  tradeHistoryPublic: boolean;
  holdingCount: number;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  computedAt: string;
  totalParticipants: number;
}

/** GET /api/leaderboard/{username}/trades */
export interface PublicTrade {
  symbol: string;
  marketType: 'bist' | 'crypto' | 'us';
  /** Backend 'BUY' | 'SELL' döner. */
  side: string;
  quantity: number;
  price: number;
  executedAt: string;
}

export interface PublicTradeHistory {
  username: string;
  isPublic: boolean;
  trades: PublicTrade[];
}
