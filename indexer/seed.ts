/**
 * Seed demo data for local UI development against a dev/local Postgres.
 * Guarded: refuses to run unless SEED_CONFIRM=yes.
 *
 * Usage: SEED_CONFIRM=yes DATABASE_URL=postgres://... npx tsx indexer/seed.ts
 */
import { Pool } from "pg";

if (process.env.SEED_CONFIRM !== "yes") {
  console.error("Refusing to seed: set SEED_CONFIRM=yes (destroys existing seed rows).");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DEMO_MARKETS = [
  {
    key: "seed-market-1",
    id: 900001,
    question: "Will SOL close above $250 on Dec 31?",
    hoursFromNow: 72,
    yes: 650_000_000,
    no: 350_000_000,
    status: "open",
  },
  {
    key: "seed-market-2",
    id: 900002,
    question: "Will the next iPhone be called iPhone 18?",
    hoursFromNow: 168,
    yes: 220_000_000,
    no: 780_000_000,
    status: "open",
  },
  {
    key: "seed-market-3",
    id: 900003,
    question: "Did HunchQQ ship its MVP in October?",
    hoursFromNow: -2,
    yes: 900_000_000,
    no: 100_000_000,
    status: "resolved",
    winner: 1,
  },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Clear previous seed rows only.
    await client.query(`DELETE FROM odds_snapshots WHERE market_pubkey LIKE 'seed-%'`);
    await client.query(`DELETE FROM claims WHERE market_pubkey LIKE 'seed-%'`);
    await client.query(`DELETE FROM bets WHERE market_pubkey LIKE 'seed-%'`);
    await client.query(`DELETE FROM markets WHERE market_pubkey LIKE 'seed-%'`);

    for (const m of DEMO_MARKETS) {
      const end = new Date(Date.now() + m.hoursFromNow * 3_600_000);
      await client.query(
        `INSERT INTO markets
           (market_pubkey, market_id, creator, resolver, mint, question, end_time,
            status, winning_outcome, yes_pool, no_pool)
         VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          m.key,
          m.id,
          "SeedCreator1111111111111111111111111111111",
          "SeedMint1111111111111111111111111111111111",
          m.question,
          end.toISOString(),
          m.status,
          "winner" in m ? m.winner : null,
          m.yes,
          m.no,
        ]
      );

      await client.query(
        `INSERT INTO odds_snapshots (market_pubkey, yes_pool, no_pool)
         VALUES ($1,$2,$3)`,
        [m.key, m.yes, m.no]
      );

      for (let i = 0; i < 3; i++) {
        const amount = Math.floor(m.yes / (i + 3));
        await client.query(
          `INSERT INTO bets
             (market_pubkey, user_wallet, outcome, amount, yes_pool, no_pool, tx_signature, event_index)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT DO NOTHING`,
          [
            m.key,
            `SeedUser${i}11111111111111111111111111111111`,
            i % 2,
            amount,
            m.yes,
            m.no,
            `seed-tx-${m.id}-${i}`,
            0,
          ]
        );
      }
    }

    await client.query("COMMIT");
    console.log(`Seeded ${DEMO_MARKETS.length} markets.`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
