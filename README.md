# HunchQQ

> **Bet on anything, settle on-chain, trust no one.**

[![CI](https://github.com/BerlinDeskMudit/HunchQQ/actions/workflows/ci.yml/badge.svg)](https://github.com/BerlinDeskMudit/HunchQQ/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Solana](https://img.shields.io/badge/Solana-devnet--only-14F195?logo=solana&logoColor=black)](https://api.devnet.solana.com)
[![Anchor](https://img.shields.io/badge/Anchor-0.31-3E3E4E?logo=anchor&logoColor=white)](https://www.anchor-lang.com/)

A decentralized **prediction market** on Solana: users bet Yes/No on real-world events with SPL tokens, funds sit in program-owned PDA vaults, markets resolve on-chain, and winners claim proportional payouts directly from the program. No trusted middleman holds the money.

> ⚠️ **Devnet-only technical demo.** Test tokens have no value. This is not a betting product and is not offered where real-money prediction markets are restricted. See [docs/SECURITY.md](./docs/SECURITY.md).

---

## Table of contents

- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Quickstart](#quickstart)
- [Project structure](#project-structure)
- [Payout math](#payout-math)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

---

## Features

### Program (Anchor / Rust)

| Feature | Detail |
|---|---|
| Binary markets | Create Yes/No markets with a question (≤ 200 chars) and an `end_time` |
| Pooled betting | Parimutuel pools: `yes_pool` / `no_pool` tracked per market |
| PDA vaults | Each market's funds held in a PDA-owned SPL token account — program is the sole authority |
| Positions | Per-user `Position` PDA tracks Yes/No stakes and a one-time `claimed` flag |
| Resolution | Trusted resolver sets the winning outcome, only after `end_time`, only once |
| Proportional claims | `payout = stake × (total_pool − fee) / winning_pool` in `u128`, floored |
| Cancel & refund | Admin/resolver can cancel; bettors reclaim full stakes |
| Platform fee | Configurable `fee_bps` skimmed to treasury before payouts |
| Emergency pause | `set_paused` halts new bets and market creation instantly |
| Full validation | Signer + PDA seed/bump + mint + token-authority checks on every instruction |
| Safe math | `checked_*` everywhere, `u128` intermediates, rounding always favors the vault |
| Events | `MarketCreated`, `BetPlaced`, `MarketResolved`, `MarketCancelled`, `WinningsClaimed`, `RefundClaimed` for indexers |

### Frontend (Next.js + Tailwind)

- **Wallet connect** — Phantom, Solflare, Backpack via `@solana/wallet-adapter`
- **Market list** — trending/newest markets with implied probabilities
- **Market detail** — odds bar, pool sizes, countdown, status banner (Open / Closed / Resolved / Cancelled)
- **Bet panel** — live implied probability + potential payout preview before you confirm
- **One-click claim** — winners claim straight from the resolved market page; refunds on cancelled markets
- **Create market** — form with validation and fee preview
- **Portfolio** — open bets, claimable winnings, history
- **Leaderboard** — profit, win rate, volume
- **Friendly errors** — every Anchor error code mapped to human text
- **Mobile responsive** — utility-first Tailwind, works on phones

### Off-chain services

- **Indexer** — webhook receiver for program events, idempotent (dedupe by signature)
- **Database** — `markets`, `bets`, `users`, `odds_snapshots` (Supabase/Postgres)
- **Activity feed & leaderboard** — served from the DB, updated seconds after a tx lands
- **Resolver bot** — optional script that resolves price markets at `end_time`

---

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
                 │ Pyth Oracle│──▶ read by program at resolution (Phase 3)
                 └────────────┘
```

1. User connects a wallet and picks a market.
2. Frontend builds a `place_bet` transaction; the user signs it.
3. The program moves tokens user → market vault and updates the `Position` PDA.
4. After `end_time`, the resolver calls `resolve_market`.
5. Winners call `claim_winnings`; the vault pays out proportionally.
6. The indexer consumes events to power the feed, charts and leaderboard.

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

---

## Tech stack

| Layer | Choice |
|---|---|
| Smart contract | Rust + [Anchor](https://www.anchor-lang.com/) |
| Tokens | SPL Token (test USDC mint on devnet) |
| Frontend | Next.js (App Router) + TypeScript + Tailwind |
| Wallet | `@solana/wallet-adapter` (Phantom, Solflare, Backpack) |
| Client | `@coral-xyz/anchor`, `@solana/web3.js` |
| RPC / indexing | Helius or QuickNode webhooks |
| Off-chain DB | Supabase (Postgres) |
| Testing | Anchor tests (TypeScript/Mocha), Bankrun-style time travel |
| CI | GitHub Actions (`anchor build` + `anchor test` + `npm run build`) |
| Hosting | Vercel (frontend) · Solana devnet (program) |

---

## Quickstart

### Prerequisites

- Rust, Solana CLI (Agave), Anchor CLI, Node 20+ — see [docs/SETUP.md](./docs/SETUP.md)
- On WSL: `bash scripts/setup-wsl-toolchain.sh` installs everything

### Build & test the program

```bash
git clone https://github.com/BerlinDeskMudit/HunchQQ.git
cd HunchQQ
solana config set --url devnet      # always devnet
anchor build
anchor test
```

### Run the frontend

```bash
cd app
npm install
cp .env.example .env.local          # set NEXT_PUBLIC_PROGRAM_ID, NEXT_PUBLIC_RPC_URL
npm run dev                         # http://localhost:3000
```

### Deploy to devnet

```bash
anchor deploy --provider.cluster devnet
node scripts/init-config.ts         # one-time initialize_config
node scripts/create-test-mint.ts    # test USDC mint + faucet
```

Live demo: **coming with Phase 6** · Program ID: **coming with Phase 6**

---

## Project structure

```
HunchQQ/
├── programs/hunchqq/src/
│   ├── lib.rs              # declare_id!, module wiring, #[program] entry
│   ├── state/              # config.rs, market.rs, position.rs
│   ├── instructions/       # one file per instruction
│   ├── errors.rs           # HunchQQError enum
│   └── events.rs           # emit! events for the indexer
├── tests/                  # Anchor TS tests — mirror instruction names
├── app/                    # Next.js frontend
│   └── src/
│       ├── app/            # /, /market/[id], /create, /portfolio, /leaderboard
│       ├── components/
│       └── lib/            # anchor client, IDL, errors.ts, helpers
├── indexer/                # webhook handler + DB schema/migrations
├── scripts/                # wallet, test mint, faucet, resolver bot, toolchain
├── docs/                   # SPEC.md, SETUP.md, ARCHITECTURE.md, SECURITY.md
├── .github/                # workflows, issue/PR templates
├── Anchor.toml
└── README.md
```

---

## Payout math

```
total_pool    = yes_pool + no_pool
fee           = total_pool * fee_bps / 10_000
payout_pool   = total_pool - fee
winning_pool  = yes_pool  (if Yes won)  or  no_pool (if No won)

user_payout   = user_winning_stake * payout_pool / winning_pool
```

- `u128` intermediates, then cast down — no overflow.
- Round **down** so the vault never overpays.
- If `winning_pool == 0`: nobody can win → treated as cancelled, everyone refunded.
- UI implied probability: `yes_pool / total_pool`.

---

## Documentation

| Doc | What's inside |
|---|---|
| [docs/SPEC.md](./docs/SPEC.md) | Full product/design spec, on-chain design, phases (source of truth) |
| [docs/SETUP.md](./docs/SETUP.md) | Toolchain install (Windows/WSL/macOS/Linux) |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Component diagram, data flow, account layout |
| [docs/SECURITY.md](./docs/SECURITY.md) | Security checklist, threat model, disclosure policy |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Dev setup, PR rules, definition of done |
| [AGENTS.md](./AGENTS.md) | Instructions for AI coding agents |

---

## Roadmap

Build is tracked as GitHub [issues](https://github.com/BerlinDeskMudit/HunchQQ/issues), one epic per phase:

| Phase | Scope | Status |
|---|---|---|
| 0 | Repo, toolchain, CI scaffolding | in progress |
| 1 | State accounts + `create_market` | pending |
| 2 | `place_bet` + guards | pending |
| 3 | Resolve / claim / refund / fees + full tests | pending |
| 4 | Next.js frontend | pending |
| 5 | Indexer + DB + leaderboard | pending |
| 6 | Devnet deploy, security pass, release | pending |

**After MVP** (parked): Pyth oracle resolution, dispute window, LMSR AMM, multi-outcome/scalar markets, liquidity providers, Blinks, mainnet hardening.

---

## Contributing

Open source under the [MIT License](./LICENSE). See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and PR rules — good first issues are labelled [`good first issue`](https://github.com/BerlinDeskMudit/HunchQQ/issues?q=label%3A%22good+first+issue%22). AI agents (Claude Code, Codex, Cursor, opencode): follow [AGENTS.md](./AGENTS.md).

```bash
git checkout -b feat/my-feature   # branch from main
# ... change, test, lint
git push && gh pr create          # fill the PR template
```

## Security

- Every instruction checks signers, PDA seeds/bumps, mint and token authority.
- Checked arithmetic throughout; `u128` payout math; rounding favors the vault.
- One-time resolve and claim; bets after `end_time` rejected; pause switch tested.
- Full checklist and disclosure policy: [docs/SECURITY.md](./docs/SECURITY.md).

Found a bug? Please open a **private** security advisory instead of a public issue.

## License

[MIT](./LICENSE) © BerlinDeskMudit
