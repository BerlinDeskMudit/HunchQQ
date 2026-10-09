<div align="center">

<h1>HunchQQ</h1>

**Parimutuel prediction markets on Solana — bet Yes/No, settle on-chain, trust no one.**

An Anchor (Rust) program holds every pool in a PDA-owned SPL vault, resolves markets on-chain, and pays winners
proportionally. A Next.js frontend handles wallet-signed bets, and an idempotent indexer turns program events into
a live activity feed and leaderboard.

<p>
<a href="https://github.com/0xMudit/hunch-prediction-market/actions/workflows/ci.yml"><img src="https://github.com/0xMudit/hunch-prediction-market/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license" /></a>
<img src="https://img.shields.io/badge/solana-devnet--only-14F195.svg" alt="Solana devnet only" />
<img src="https://img.shields.io/badge/anchor-0.31-3E3E4E.svg" alt="Anchor 0.31" />
<img src="https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg" alt="Node 20 or newer" />
</p>

</div>

---

> **Devnet-only technical demo.** This is a portfolio-grade demonstration of on-chain market mechanics, not a
> betting product. It runs exclusively on Solana **devnet** against a **test USDC** mint — no real money, no
> mainnet path, no funding of any kind. Every token involved is worthless by construction. See [docs/SECURITY.md](docs/SECURITY.md).

## Why HunchQQ

- **The program is the escrow.** Funds live in a PDA-owned token account; only program instructions move them, and every account is validated on every call.
- **No liquidity bootstrapping problem.** Pools form parimutuel-style from the bets themselves — no order book, no market maker, no counterparty required.
- **Settlement is small enough to audit.** The payout rule is one line of integer math, computed in `u128` and floored so the vault cannot overpay.
- **Resolution is one-shot and time-gated.** A market moves `Open -> Resolved | Cancelled`, resolves only after `end_time`, and is claimed exactly once.
- **Honest about its limits.** Devnet, no audit, no dispute layer, no AMM — deferred work is written down in the [Roadmap](#roadmap), not hidden.

## Features

| Area | What you get |
| --- | --- |
| **Binary markets** | Anyone creates a Yes/No market with a question (max 200 chars) and an `end_time`. |
| **Pooled betting** | `place_bet` transfers test USDC into the market vault and updates `yes_pool` / `no_pool`. |
| **PDA vaults** | Each market owns a PDA SPL token account; the program is its only authority. |
| **Positions** | A per-user `Position` PDA tracks Yes/No stake and a one-time `claimed` flag. |
| **On-chain resolution** | The stored resolver sets the winning outcome after `end_time`, exactly once. |
| **Proportional claims** | `payout = stake x (total_pool - fee) / winning_pool`, in `u128`, floored toward the vault. |
| **Cancel and refund** | Admin/resolver can cancel before resolution and every bettor reclaims their full stake. An empty winning side triggers the same refund path. |
| **Platform fee** | A configurable, capped `fee_bps` is skimmed to the treasury before payouts. |
| **Emergency pause** | `set_paused` halts new bets and market creation immediately. |
| **Events** | `MarketCreated`, `BetPlaced`, `MarketResolved`, `MarketCancelled`, `WinningsClaimed`, `RefundClaimed` — emitted for indexers. |
| **Frontend** | Next.js app with wallet connect, market list and detail, a bet panel with payout preview, portfolio, and leaderboard. |
| **Indexer** | Idempotent webhook receiver (deduped by transaction signature) that fills a Postgres/Supabase feed. |
| **Test suite** | 25 Anchor/Mocha tests covering happy paths, double claims, late bets, wrong signers, wrong mint, the zero-winner side, and pause. |

## Requirements

- **Rust** (stable) with Cargo
- **Solana CLI (Agave)** — includes `solana-test-validator`
- **Anchor CLI 0.31.1** — pinned in [Anchor.toml](Anchor.toml); match it, do not upgrade casually
- **Node.js 20+** with npm
- A devnet wallet funded with devnet SOL (`solana airdrop 2`)

> On Windows, use **WSL2 (Ubuntu)** — native Windows builds of the Solana/Anchor toolchain are unreliable. A
> one-shot installer is at [`scripts/setup-wsl-toolchain.sh`](scripts/setup-wsl-toolchain.sh); see [docs/SETUP.md](docs/SETUP.md).

## Quick start

```bash
# 1. Clone
git clone https://github.com/0xMudit/hunch-prediction-market.git
cd hunch-prediction-market

# 2. Point the CLI at devnet, then build and test the program
solana config set --url devnet
anchor build
anchor test

# 3. Run the frontend
cd app
npm install
cp .env.example .env.local     # set NEXT_PUBLIC_PROGRAM_ID and NEXT_PUBLIC_RPC_URL
npm run dev                    # http://localhost:3000
```

### First devnet deploy

```bash
bash scripts/deploy-devnet.sh                                 # build, sync id, deploy to devnet
HUNCHQQ_PROGRAM_ID=<id> npx ts-node scripts/init-config.ts    # one-time initialize_config
npx ts-node scripts/create-test-mint.ts                       # create the test USDC mint
MINT=<mint> TO=<wallet> AMOUNT=100 npx ts-node scripts/faucet.ts   # fund a tester
```

The program id configured in `Anchor.toml` and `declare_id!` for devnet is
`4HHwg8tUWFiFd6AoMn2Nus4jgRY68vYfmeSSTMLpyZLV`
([explorer](https://explorer.solana.com/address/4HHwg8tUWFiFd6AoMn2Nus4jgRY68vYfmeSSTMLpyZLV?cluster=devnet)).

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_RPC_URL` | `app/.env.local` | Solana RPC endpoint (Helius/QuickNode recommended for rate limits). |
| `NEXT_PUBLIC_PROGRAM_ID` | `app/.env.local` | The deployed program id. |
| `NEXT_PUBLIC_USDC_MINT` | `app/.env.local` | The test USDC mint created by `scripts/create-test-mint.ts`. |
| `NEXT_PUBLIC_API_BASE` | `app/.env.local` | Optional indexer API base; the app falls back to direct RPC reads when unset. |
| `DATABASE_URL` | server / indexer | Postgres/Supabase connection string (schema in `indexer/migrations/001_init.sql`). |
| `WEBHOOK_SECRET` | server / indexer | Shared secret required in the `x-webhook-secret` header on `POST /api/webhook`. |

## How it works

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
                 │ Pyth Oracle│──▶ read by the program at resolution (Phase 3, parked)
                 └────────────┘
```

Writes always go wallet to program: the frontend builds a `place_bet` transaction, the user signs it, and the
program moves tokens user-to-vault and updates the `Position` PDA. After `end_time` the resolver calls
`resolve_market`; winners call `claim_winnings` and the vault pays out proportionally. The indexer consumes events
so lists, charts, and the leaderboard are served from the database instead of fanning out RPC calls.

### Payout math

```
total_pool    = yes_pool + no_pool
fee           = total_pool * fee_bps / 10_000
payout_pool   = total_pool - fee
winning_pool  = yes_pool (if Yes won)  or  no_pool (if No won)

user_payout   = user_winning_stake * payout_pool / winning_pool
```

- `u128` intermediates, then cast down — no overflow.
- Rounded **down**, so the vault never overpays.
- If `winning_pool == 0` nobody can win, so the market is treated as cancelled and everyone is refunded.
- UI implied probability is `yes_pool / total_pool`.

### Market lifecycle

```
          create_market
               │
               ▼
            [ Open ] ──(end_time passes)──▶ betting disabled
               │                                  │
     cancel_market                         resolve_market
               │                                  │
               ▼                                  ▼
         [ Cancelled ]                       [ Resolved ]
               │                                  │
         claim_refund                       claim_winnings
```

## Project layout

```
programs/hunchqq/src/
  lib.rs              declare_id!, module wiring, #[program] entry points
  state/              config.rs, market.rs, position.rs — account structs
  instructions/       one file per instruction (create_market.rs, place_bet.rs, ...)
  errors.rs           HunchQQError — every failure path has a code
  events.rs           emit! events consumed by the indexer
tests/                Anchor TS tests (Mocha) — mirror the instruction names
app/                  Next.js + TypeScript + Tailwind frontend
  src/app/            routes: /, /market/[id], /create, /portfolio, /leaderboard, /api/webhook
  src/components/     Header, MarketCard, OddsBar, BetPanel, ResolverPanel
  src/lib/            anchor client, IDL, errors.ts, helpers, hooks
indexer/              webhook receiver + Postgres schema/migrations + seed
scripts/              devnet wallet, test mint, faucet, resolver bot, toolchain setup
docs/                 SPEC.md, SETUP.md, ARCHITECTURE.md, SECURITY.md
Anchor.toml           program ids, provider, test script
```

## Commands

| Task | Command |
| --- | --- |
| Build the program | `anchor build` |
| Test against a local validator | `anchor test` |
| Deploy to devnet | `anchor deploy --provider.cluster devnet` |
| Frontend dev server | `npm run dev` (in `app/`) |
| Frontend production build | `npm run build` (in `app/`) |
| Frontend lint | `npm run lint` (in `app/`) |
| Apply the indexer schema | `psql "$DATABASE_URL" -f indexer/migrations/001_init.sql` |
| Seed local demo data | `SEED_CONFIRM=yes npx tsx indexer/seed.ts` |
| Resolve expired markets | `HUNCHQQ_PROGRAM_ID=<id> npx ts-node scripts/resolver-bot.ts` |

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `anchor: command not found` | `source ~/.cargo/env`, then `avm use 0.31.1`. |
| `solana: command not found` | Re-run the Agave installer and put `~/.local/share/solana/install/active_release/bin` on `PATH`. |
| `avm install` compile fails | `sudo apt install build-essential pkg-config libssl-dev clang cmake` and retry. |
| Airdrop rate-limited | Wait 30 seconds, retry, or use the [Solana faucet](https://faucet.solana.com). |
| `anchor test` cannot find the validator | `solana-test-validator` must be on `PATH` (part of the Agave install). |
| Frontend shows an empty market list | `NEXT_PUBLIC_PROGRAM_ID` and `NEXT_PUBLIC_RPC_URL` are unset, or the wallet is on the wrong network. |

## Roadmap

Build is tracked as GitHub [issues](https://github.com/0xMudit/hunch-prediction-market/issues), one epic per phase.

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Repo, toolchain, CI scaffolding | done |
| 1 | State accounts + `create_market` | done |
| 2 | `place_bet` + guards | done |
| 3 | Resolve / claim / refund / fees + full tests | done |
| 4 | Next.js frontend | done |
| 5 | Indexer + DB + leaderboard | in progress |
| 6 | Devnet deploy, security pass, release | in progress |

**After MVP** (parked): Pyth oracle resolution, a dispute window with a challenger stake, LMSR AMM pricing,
multi-outcome and scalar markets, liquidity providers, Solana Blinks, and mainnet hardening.

## Contributing

Open source under the [MIT License](LICENSE). See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, branch and PR
rules, and the definition of done. Program changes must come with `anchor build` + `anchor test` evidence;
frontend changes with `npm run build`. AI agents should follow [AGENTS.md](AGENTS.md).

```bash
git checkout -b feat/my-feature    # branch from main
# ... change, test, lint
git push && gh pr create           # fill the PR template
```

## Security

- Every instruction checks signers, PDA seeds/bumps, mint, and token authority.
- Checked arithmetic throughout, `u128` payout math, and rounding that favors the vault.
- One-time resolve and claim, bets rejected after `end_time`, and a tested pause switch.

This is a devnet demo with no real funds and no audit. The full threat model, checklist, and disclosure policy
are in [docs/SECURITY.md](docs/SECURITY.md). Report vulnerabilities through a **private** GitHub security
advisory, not a public issue.

## License

[MIT](LICENSE) © 2026 Muditya Raghav.
