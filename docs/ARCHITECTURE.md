# Architecture

HunchQQ has three planes: the **on-chain program** (source of truth), the **frontend** (wallet-signed UX), and the **off-chain index** (fast reads).

## System diagram

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────────┐
│   Next.js    │────▶│  Wallet Adapter   │────▶│  Solana Program  │
│   Frontend   │     │  (sign & send tx) │     │  (Anchor / Rust) │
└──────┬───────┘     └───────────────────┘     └────────┬─────────┘
       │                                                │ emits events
       │ read                                           ▼
       │                                     ┌──────────────────┐
       │                                     │  Helius Webhooks │
       │                                     └────────┬─────────┘
       ▼                                              ▼
┌──────────────┐                              ┌──────────────────┐
│  API / DB    │◀─────────────────────────────│  Indexer Service │
│ (Supabase)   │                              └──────────────────┘
└──────────────┘
                 ┌────────────┐
                 │ Pyth Oracle│──▶ (Phase 3+) automatic resolution
                 └────────────┘
```

## On-chain account layout

| Account | Seeds | Purpose |
|---|---|---|
| `Config` | `["config"]` | Global: admin, treasury, `fee_bps`, `market_count`, `paused` |
| `Market` | `["market", id.to_le_bytes()]` | One per market: question, `end_time`, status, pools |
| Vault (token) | `["vault", market]` | SPL token account holding all bets for a market |
| `Position` | `["position", market, user]` | A user's Yes/No stake in one market + `claimed` flag |

```
user token account ──place_bet──▶ market vault (PDA-owned)
                                     │
              resolve/cancel ◀───────┤ balances are only ever
                                     │ moved by the program
user ◀─────────claim_winnings────────┘
```

## Instruction set

| Instruction | Authority | Effect |
|---|---|---|
| `initialize_config` | admin (once) | Writes global config |
| `create_market` | anyone | Creates `Market` + vault PDA, increments `market_count` |
| `place_bet` | anyone | SPL transfer user→vault, updates pools + position |
| `resolve_market` | resolver, `now >= end_time`, once | Sets `winning_outcome`, status `Resolved` |
| `cancel_market` | admin/resolver, before resolve | Status `Cancelled` |
| `claim_winnings` | position owner, once | Pays `stake × payout_pool / winning_pool` |
| `claim_refund` | position owner, cancelled market | Returns full stake |
| `withdraw_fees` | admin | Moves accrued fee to treasury |
| `set_paused` | admin | Emergency stop |

## State machine

```
Open ──(end_time passes)──▶ [betting disabled]
  │                               │
  ├── cancel_market          resolve_market
  ▼                               ▼
Cancelled ──claim_refund▶ ∅   Resolved ──claim_winnings▶ ∅
```

Guards: bets only in `Open` **and** before `end_time`; resolve only after `end_time`; resolve/cancel at most once; claim at most once (`claimed` flag).

## Frontend data flow

1. **Writes** always go wallet → program (Anchor client, IDL from `app/src/lib/idl`).
2. **Reads** for lists/feed/leaderboard come from the indexer DB (fast, no RPC fan-out).
3. **Live reads** for the open market page come straight from the program account (fresh pools before the user signs).
4. Errors are decoded in `app/src/lib/errors.ts` (Anchor code → friendly text).

## Indexer data flow

```
program event ──▶ Helius webhook ──▶ POST /api/webhook
                                        │ verify + dedupe by tx signature
                                        ▼
                              upsert markets/bets/users
                                        ▼
                     frontend reads: feed, portfolio, leaderboard
```

Tables: `markets`, `bets`, `users`, `odds_snapshots`. Events consumed: `MarketCreated`, `BetPlaced`, `MarketResolved`, `MarketCancelled`, `WinningsClaimed`, `RefundClaimed`.

## Why parimutuel (no order book / AMM in MVP)

- No liquidity bootstrapping problem: pools form from bets themselves.
- Payout math is tiny and auditable (see README "Payout math").
- Order books/AMMs add matching engines, price curves and far more audit surface — deliberately parked post-MVP (LMSR is roadmap Phase 3+).
