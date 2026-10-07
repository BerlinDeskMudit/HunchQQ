# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, opencode, etc.) working on this repo. Humans: see [CONTRIBUTING.md](./CONTRIBUTING.md). Full product/design spec: [docs/SPEC.md](./docs/SPEC.md).

## What this project is

HunchQQ — a parimutuel prediction-market dApp on Solana. Anchor (Rust) program with PDA-owned token vaults, Next.js frontend, event indexer. Portfolio-grade demo.

## Hard rules (never violate)

1. **Devnet only.** Never add mainnet deployment config, real-money paths, or swap test tokens for anything real.
2. **No secrets in git.** No private keys, RPC API keys, or `.env` values in files or commits. Keypairs go in gitignored files only.
3. **Checked arithmetic** in the program: `checked_add` / `checked_sub` / `checked_mul`, `u128` intermediates for payout math, round down (vault must never overpay).
4. **Validate every account**: signer, PDA seeds/bumps, mint, token authority. No unchecked `remaining_accounts`.
5. **Tests gate every program change.** `anchor test` must pass before a PR — including the negative/edge cases for whatever you touched.
6. Keep the scope in `docs/SPEC.md` (locked: Phase 1 MVP features, production-grade code, devnet). New features start as an issue.

## Repo layout

```
programs/hunchqq/src/
  lib.rs              # declare_id!, module wiring, #[program] entry
  state/              # config.rs, market.rs, position.rs — account structs
  instructions/       # one file per instruction (create_market.rs, place_bet.rs, ...)
  errors.rs           # HunchQQError enum — every failure path gets a code
  events.rs           # emit! events for the indexer
tests/                # Anchor TS tests (Mocha) — mirror instruction names
app/                  # Next.js + TS + Tailwind frontend
  src/app/            # routes: /, /market/[id], /create, /portfolio, /leaderboard
  src/components/
  src/lib/            # anchor client, IDL, errors.ts, helpers
indexer/              # webhook handler + DB schema/migrations
scripts/              # setup: devnet wallet, test USDC mint, faucet, resolver bot
.github/workflows/    # CI: build + test + lint
docs/SPEC.md        # source of truth for design (§14 = build phases)
```

## Commands

| Task | Command |
|---|---|
| Build program | `anchor build` |
| Test (local validator) | `anchor test` |
| Deploy devnet | `anchor deploy --provider.cluster devnet` |
| Frontend dev | `npm run dev` (in `app/`) |
| Frontend build | `npm run build` (in `app/`) |
| Lint | `npm run lint` (in `app/`) |

Notes:
- Solana CLI is configured for devnet: `solana config set --url devnet` — keep it that way.
- Anchor version is pinned in `Anchor.toml` / CI — match it, don't upgrade casually.
- If the scaffold doesn't exist yet (early phases), follow the phase in issue tracker first.

## On-chain conventions

- **PDA seeds** (see docs/SPEC.md §5.1): `Config` = `["config"]`, `Market` = `["market", id_le_bytes]`, `Vault` = `["vault", market]`, `Position` = `["position", market, user]`.
- **Instruction flow**: each instruction is a struct with Anchor constraints; business logic stays small and reads from validated accounts.
- **Status machine**: `Market.status` is `Open → Resolved | Cancelled`. Enforce: bets only when `Open` + before `end_time`; resolve only after `end_time`; resolve/cancel once; claim once (`claimed` flag).
- **Payout** (§5.4): `user_payout = user_winning_stake * (total_pool - fee) / winning_pool`, `u128` math, floor division. If `winning_pool == 0`, treat as cancelled → refunds.
- **Errors**: extend `HunchQQError` rather than panicking/`unwrap()`. Frontend maps codes to friendly text in `app/src/lib/errors.ts`.
- **Events**: every state change emits (§5.6) — `MarketCreated`, `BetPlaced`, `MarketResolved`, `MarketCancelled`, `WinningsClaimed`, `RefundClaimed`. Indexer depends on these; don't rename without updating `indexer/`.

## Frontend conventions

- Tailwind utility-first; mobile responsive; no new UI libraries without an issue.
- Wallet: `@solana/wallet-adapter` (Phantom, Solflare, Backpack) only.
- Program ID and RPC come from env vars (`NEXT_PUBLIC_*`) — never hardcode.
- Show implied probability (`yes_pool / total`) and payout preview before confirm; surface friendly errors for every Anchor code.

## Git / PR workflow

- Branch from `main`; small focused PRs; `Closes #NN` in the description.
- Fill the PR template; program changes need `anchor build` + `anchor test` evidence, frontend needs `npm run build`.
- Don't commit: `target/`, `.anchor/`, `node_modules/`, `.next/`, keypairs, `.env`.

## Definition of done (any task)

1. Code follows the conventions above.
2. Tests added/updated and passing; edge cases for the changed path covered.
3. Docs updated if behavior changed (`docs/SPEC.md`, README, issue checklist ticked).
4. Nothing devnet-scoped leaked into mainnet direction; no secrets.
