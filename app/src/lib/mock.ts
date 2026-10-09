/** Seed data for the leaderboard until the indexer API is wired in (Phase 5). */
export interface LeaderRow {
  wallet: string;
  profit: number; // USDC
  wins: number;
  bets: number;
  volume: number; // USDC
}

export const MOCK_LEADERBOARD: LeaderRow[] = [
  { wallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", profit: 1240.5, wins: 9, bets: 14, volume: 4200 },
  { wallet: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", profit: 810.25, wins: 6, bets: 11, volume: 3150 },
  { wallet: "5Qm4w3fGmLxUsQUL8CzMzGdVbRJ6Gh1pYk9T2sR4nVpP", profit: 432.75, wins: 5, bets: 9, volume: 2010 },
  { wallet: "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", profit: 150.0, wins: 3, bets: 8, volume: 1480 },
  { wallet: "AJrqzFhGMcLzHkVqGvWXyAqDQdN1bPzK6XnWm4HtR2s", profit: -95.5, wins: 1, bets: 7, volume: 990 },
];
