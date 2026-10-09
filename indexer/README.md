# HunchQQ indexer

Idempotent webhook receiver that turns on-chain program events into a
Postgres/Supabase feed for the frontend (activity, portfolios, leaderboard).

## Layout

| File | Purpose |
|---|---|
| `migrations/001_init.sql` | Schema: `markets`, `bets`, `users`, `claims`, `odds_snapshots` |
| `seed.ts` | Demo data for local UI work (guarded by `SEED_CONFIRM=yes`) |

The webhook receiver lives in the frontend at `app/src/lib/webhook.ts`,
exposed as `POST /api/webhook` (`app/src/app/api/webhook/route.ts`).

## Setup

```bash
# 1. Create the schema
psql "$DATABASE_URL" -f migrations/001_init.sql

# 2. Env (set on Vercel for the API route app/src/app/api/webhook)
DATABASE_URL=postgres://...
WEBHOOK_SECRET=choose-a-long-random-string

# 3. Local demo seed (optional)
SEED_CONFIRM=yes DATABASE_URL=postgres://... npx tsx seed.ts
```

The Next.js app exposes the receiver at `POST /api/webhook`
(`app/src/app/api/webhook/route.ts` re-exports `handleWebhook`).

## Webhook contract

```
POST /api/webhook
x-webhook-secret: $WEBHOOK_SECRET

{
  "signature": "5abc…",
  "events": [
    { "name": "BetPlaced", "data": {
        "market": "<market pubkey>", "user": "<wallet>",
        "outcome": 1, "amount": "10000000",
        "yes_pool": "10000000", "no_pool": "0" } }
  ]
}
```

Handled events (matching `programs/hunchqq/src/events.rs`): `MarketCreated`,
`BetPlaced`, `MarketResolved`, `MarketCancelled`, `WinningsClaimed`,
`RefundClaimed`. Unknown names are ignored.

**Idempotency:** every write is keyed on `tx_signature` (plus `event_index`
for bets), so replaying a webhook is a no-op — duplicate key errors are
treated as "already applied".

## Pointing a Helius webhook at it

1. Helius → Webhooks → create for your program ID on devnet.
2. URL: `https://<your-app>/api/webhook`, secret: your `WEBHOOK_SECRET`.
3. Map Helius's parsed payload into the contract above (a thin Vercel
   function can unwrap it and call `handleWebhook`).

## Read API (Phase 5)

The frontend reads directly from RPC until `NEXT_PUBLIC_API_BASE` is set.
Planned routes: `/api/markets`, `/api/markets/:id/activity`,
`/api/portfolio/:wallet`, `/api/leaderboard`.
