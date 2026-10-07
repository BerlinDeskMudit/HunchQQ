# Solana Prediction Market: End-to-End Project Guide

> Project name: **HunchQQ** (working title in code: `hunchqq`)
> Type: Web3 dApp on Solana (Anchor program + Next.js frontend)
> Purpose: Portfolio project to show real Solana, Rust and full-stack skills

### Scope decision (locked)

| Dimension | Decision |
|---|---|
| Network | **Devnet only** (test tokens, no real money) |
| Code quality | **Production-grade**: strict validation, full test coverage, CI, complete error handling |
| Features | **Phase 1 MVP only** — everything in section 2 Phase 1, fully finished |
| Out of scope | Audit, multisig, mainnet, compliance/licensing, AMM, oracle (deferred) |
| Delivery | GitHub repo **BerlinDeskMudit/HunchQQ**, CI green, devnet deployment, README with demo |

---

## 1. Overview

A decentralized prediction market where users bet on the outcome of real-world events (crypto prices, sports, tech, memes). Funds are held in program-owned vaults (PDAs), outcomes are resolved by an admin or an oracle, and winners claim payouts directly from the program. No trusted middleman holds the money.

**One-line pitch:** "Bet on anything, settle on-chain, trust no one."

### Goals
- Ship a working, deployed dApp on **devnet** with a live demo link
- Demonstrate secure Anchor program design (PDAs, CPIs, account validation)
- Demonstrate full-stack skills (wallet integration, indexing, clean UI)
- Produce a strong GitHub repo, README and demo video

### Non-goals (for the portfolio version)
- Real-money mainnet launch (regulatory risk, see section 13)
- Order books and complex market making
- Governance token

---

## 2. Feature List

### Phase 1: MVP
| Area | Feature |
|---|---|
| Program | Create binary (Yes/No) market with question and end time |
| Program | Place bet on Yes or No using an SPL token (test USDC) |
| Program | Pooled vault per market (PDA-owned token account) |
| Program | Admin resolves market and sets winning outcome |
| Program | Claim winnings (proportional payout) |
| Program | Cancel market and claim refund |
| Frontend | Wallet connect (Phantom, Solflare, Backpack) |
| Frontend | Market list, market detail page with odds, pool size, countdown |
| Frontend | "My Bets" page |

### Phase 2: Product polish
- Platform fee (1-2%) to a treasury
- User-created markets with a creation fee
- Categories and search
- Odds history chart
- Recent activity feed
- Leaderboard (profit, win rate, volume)
- Share links and Solana Blinks (bet from X/Twitter)
- Notifications for closing and resolved markets

### Phase 3: Advanced
- Pyth oracle for automatic price-based resolution
- Dispute window with challenger stake
- AMM pricing (LMSR) so users can sell shares before the end
- Multi-outcome and scalar (range) markets
- Liquidity providers who earn fees
- Referral system and reputation badges

---

## 3. Tech Stack

| Layer | Choice |
|---|---|
| Smart contract | Rust + Anchor |
| Tokens | SPL Token (test USDC mint on devnet) |
| Oracle | Pyth (Phase 3) |
| Frontend | Next.js + TypeScript + Tailwind |
| Wallet | `@solana/wallet-adapter` |
| Client SDK | `@coral-xyz/anchor`, `@solana/web3.js` |
| RPC / indexing | Helius or QuickNode (webhooks for events) |
| Off-chain DB | Postgres or Supabase (activity feed, leaderboard, charts) |
| Testing | Anchor tests (TypeScript, Mocha), optionally Bankrun / LiteSVM |
| CI | GitHub Actions |
| Hosting | Vercel (frontend), Solana devnet (program) |

---

## 4. System Architecture

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────────┐
│   Next.js    │────▶│  Wallet Adapter   │────▶│  Solana Program  │
│   Frontend   │     │  (sign & send tx) │     │  (Anchor / Rust) │
└──────┬───────┘     └───────────────────┘     └────────┬─────────┘
       │                                                │ emits events
       │ read                                           ▼
       │                                     ┌──────────────────┐
       │                                     │ Helius Webhooks  │
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

**Flow summary**
1. User connects wallet and picks a market.
2. Frontend builds a `place_bet` transaction; user signs it.
3. Program moves tokens from the user to the market vault and updates the position.
4. After the end time, the resolver calls `resolve_market`.
5. Winners call `claim_winnings` and the vault pays them out.
6. Indexer listens to events to power the feed, charts and leaderboard.

---

## 5. On-Chain Design

### 5.1 Accounts (PDAs)

| Account | Seeds | Purpose |
|---|---|---|
| `Config` | `["config"]` | Global settings: admin, treasury, fee, pause flag |
| `Market` | `["market", market_id (u64 LE)]` | One per market |
| `Vault` | `["vault", market]` | Token account holding bets for a market |
| `Position` | `["position", market, user]` | A user's stake in one market |

### 5.2 Account structs (sketch)

```rust
#[account]
pub struct Config {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,        // e.g. 200 = 2%
    pub market_count: u64,
    pub paused: bool,
    pub bump: u8,
}

#[account]
pub struct Market {
    pub id: u64,
    pub creator: Pubkey,
    pub resolver: Pubkey,
    pub mint: Pubkey,
    pub question: String,    // max ~200 chars
    pub end_time: i64,
    pub status: MarketStatus,
    pub winning_outcome: Option<u8>, // 0 = No, 1 = Yes
    pub yes_pool: u64,
    pub no_pool: u64,
    pub fee_collected: bool,
    pub bump: u8,
    pub vault_bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum MarketStatus { Open, Resolved, Cancelled }

#[account]
pub struct Position {
    pub market: Pubkey,
    pub user: Pubkey,
    pub yes_amount: u64,
    pub no_amount: u64,
    pub claimed: bool,
    pub bump: u8,
}
```

### 5.3 Instructions

| Instruction | Who | What it does |
|---|---|---|
| `initialize_config` | Admin | Sets fee, treasury, admin (one time) |
| `create_market` | Anyone | Creates market and vault; optional creation fee |
| `place_bet` | Anyone | Transfers tokens to vault, updates pool and position |
| `resolve_market` | Resolver | Sets winning outcome after `end_time` |
| `cancel_market` | Admin / Resolver | Marks market cancelled |
| `claim_winnings` | Winner | Pays proportional payout, marks claimed |
| `claim_refund` | Bettor | Refunds stake on a cancelled market |
| `withdraw_fees` | Admin | Sends collected fees to treasury |
| `set_paused` | Admin | Emergency stop for new bets and markets |

### 5.4 Payout math (pooled / parimutuel model)

```
total_pool    = yes_pool + no_pool
fee           = total_pool * fee_bps / 10_000
payout_pool   = total_pool - fee
winning_pool  = yes_pool  (if Yes won)  or  no_pool (if No won)

user_payout   = user_winning_stake * payout_pool / winning_pool
```

Notes:
- Use `u128` for intermediate multiplication to avoid overflow, then cast down.
- Round **down** so the vault never pays out more than it holds.
- Edge case: if `winning_pool == 0`, nobody can win, so treat as a cancelled market and refund everyone.
- Implied odds shown in the UI: `yes_odds = yes_pool / total_pool`.

### 5.5 Market lifecycle

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

### 5.6 Events (for the indexer)

`MarketCreated`, `BetPlaced`, `MarketResolved`, `MarketCancelled`, `WinningsClaimed`, `RefundClaimed`

Emit with `emit!` and decode them in the webhook handler.

---

## 6. Oracle Integration (Phase 3)

- **Price markets** (e.g. "Will SOL be above $250 on 31 Dec?"): store a Pyth price feed account and target price in the market. `resolve_market` reads the feed, checks it is fresh (staleness limit and confidence interval), then sets the outcome automatically.
- **Subjective markets**: a trusted resolver (single key, then multi-sig) resolves, with a **dispute window** where anyone can stake to challenge before payouts unlock.

---

## 7. Frontend Design

### Pages
| Route | Content |
|---|---|
| `/` | Trending and newest markets, categories, search |
| `/market/[id]` | Question, odds bar, pools, countdown, bet panel, odds chart, activity |
| `/create` | Create market form |
| `/portfolio` | Open bets, claimable winnings, history |
| `/leaderboard` | Top traders |

### Key UI details
- Show **implied probability** prominently (e.g. 63% Yes)
- Preview potential payout before the user confirms a bet
- Clear states: Open, Closed (awaiting resolution), Resolved, Cancelled
- One-click "Claim" button on resolved markets
- Friendly transaction error messages (map Anchor error codes to text)
- Mobile responsive

---

## 8. Off-Chain Services

- **Indexer**: Helius webhook, then API route, then DB. Stores markets, bets and resolutions for fast reads.
- **Tables**: `markets`, `bets`, `users`, `odds_snapshots`
- **Leaderboard**: computed from `bets` and resolved outcomes
- **Resolver bot** (optional): a script that resolves price markets at `end_time`

---

## 9. Security Checklist

- [ ] Every instruction checks signers and account ownership
- [ ] PDA seeds and bumps validated via Anchor constraints
- [ ] Token accounts checked for correct mint and authority
- [ ] Bets rejected after `end_time`; resolution rejected before it
- [ ] Resolve only once; claim only once (`claimed` flag)
- [ ] Checked arithmetic everywhere (`checked_add`, `checked_mul`), `u128` for payouts
- [ ] Rounding favors the vault
- [ ] Only the stored resolver can resolve; only admin can pause or withdraw fees
- [ ] Pause switch tested
- [ ] Question length and input bounds enforced
- [ ] No unchecked `remaining_accounts`
- [ ] Oracle freshness and confidence checks (Phase 3)

Add a short "Security considerations" section to the README. Reviewers notice this.

---

## 10. Testing Plan

**Happy paths**
- Create market, bet on both sides, resolve, winners claim, vault ends at ~0 (only fee dust)
- Cancel market, everyone gets a full refund

**Edge cases**
- Bet after end time fails
- Resolve before end time fails
- Resolve twice fails
- Claim twice fails
- Loser tries to claim and fails
- One side has zero bets (auto refund path)
- Wrong signer resolves and fails
- Fake token account or wrong mint fails
- Very large bets (overflow protection)
- Paused program rejects new bets

**Tooling**: Anchor TypeScript tests, Bankrun for time travel (to jump past `end_time`), and a coverage list in the README.

---

## 11. Deployment

1. `solana config set --url devnet`
2. Fund the deployer wallet with devnet SOL
3. `anchor build` then `anchor deploy`
4. Create a test USDC mint and distribute to testers
5. Run `initialize_config`
6. Deploy the frontend to Vercel with the program ID and RPC URL as env vars
7. Verify the program and publish the IDL

---

## 12. Suggested Folder Structure

```
predictsol/
├── programs/
│   └── predictsol/
│       └── src/
│           ├── lib.rs
│           ├── state/        (config.rs, market.rs, position.rs)
│           ├── instructions/ (create_market.rs, place_bet.rs, ...)
│           ├── errors.rs
│           └── events.rs
├── tests/
│   └── predictsol.ts
├── app/                      (Next.js frontend)
│   ├── src/app/
│   ├── src/components/
│   └── src/lib/              (anchor client, idl, helpers)
├── indexer/                  (webhook handler + DB schema)
├── scripts/                  (init config, create test mint, resolver bot)
├── Anchor.toml
└── README.md
```

---

## 13. Legal and Compliance Note

Real-money prediction markets and betting are regulated, and in some jurisdictions (including India) they may be restricted. For a portfolio project:
- Stay on **devnet** with **test tokens only**
- State clearly in the README that it is a technical demo, not a betting product
- Do not market it for real-money use

---

## 14. Build Phases (execution plan)

Each phase has explicit **deliverables** and **done when** criteria. A phase is not finished until its acceptance criteria pass.

---

### Phase 0 — Repo & toolchain
**Deliverables**
- Toolchain verified: `rustc`, `cargo`, `solana --version`, `anchor --version`, `node`
- `git init`, `.gitignore` (Rust/Anchor/Node/deploy keys), `README.md` skeleton
- GitHub repo `BerlinDeskMudit/HunchQQ` created and pushed
- GitHub Actions CI: `anchor build` + `anchor test` + lint on push/PR
- Devnet wallet generated; SOL airdrop script in `scripts/`

**Done when:** CI runs green on an empty/scaffolded project; `solana config get` points at devnet.

---

### Phase 1 — Program skeleton: state + `create_market`
**Deliverables**
- `anchor init hunchqq`; folder structure per section 12 (state/, instructions/, errors.rs, events.rs)
- Accounts: `Config`, `Market`, `Position` exactly per section 5.2
- Errors enum covering every failure path; events per section 5.6
- Instructions: `initialize_config`, `create_market` (creates market + vault PDA token account)
- Input bounds: question ≤ 200 chars, valid `end_time` in the future
- Test: init config once, create market, PDA derivation, account fields asserted; unauthorized signer fails

**Done when:** `anchor test` green; create-market happy path + 3 negative tests pass.

---

### Phase 2 — Betting: `place_bet`
**Deliverables**
- SPL-token transfer from user → market vault (checked amounts, correct mint/authority)
- Pool accounting (`yes_pool` / `no_pool`) and `Position` create-or-update
- Guards: paused program, after `end_time`, resolved/cancelled market, zero amount, overflow-checked math (`checked_add`, `u128` intermediates)
- Test: bet both sides, position round-trip, all guards fail correctly, wrong-mint token account fails

**Done when:** `anchor test` green including late-bet, paused, wrong-mint and overflow cases.

---

### Phase 3 — Resolution, claims, refunds, fees
**Deliverables**
- `resolve_market` (resolver-only, only after `end_time`, only once)
- `cancel_market` (admin/resolver, only before resolved)
- `claim_winnings` (parimutuel payout per section 5.4, `u128` math, round down, `claimed` flag, once-only)
- `claim_refund` (cancelled market) + auto-refund path when `winning_pool == 0`
- `withdraw_fees`, `set_paused`
- Platform fee (fee_bps → treasury) deducted before payout
- Events emitted for every state change
- Full test suite per section 10 (happy paths + all edge cases)

**Done when:** entire section 10 test list passes; vault balance ends at ≈ fee dust after full claim cycle.

---

### Phase 4 — Frontend (Next.js)
**Deliverables**
- Next.js + TypeScript + Tailwind, `@solana/wallet-adapter` (Phantom, Solflare, Backpack)
- Routes: `/`, `/market/[id]`, `/create`, `/portfolio`, `/leaderboard` (leaderboard can be mock data until Phase 5)
- Bet panel with implied probability, potential-payout preview, countdown, status banners
- One-click Claim; refund button on cancelled markets
- Anchor error codes → friendly messages; loading/error states; mobile responsive
- IDL + program ID from env vars

**Done when:** full user journey works against the devnet deployment with a real wallet: connect → browse → bet → (time skip) → resolve → claim.

---

### Phase 5 — Indexer + DB
**Deliverables**
- Supabase schema: `markets`, `bets`, `users`, `odds_snapshots` (+ migrations)
- Webhook/API route receiving program events, **idempotent** (event signature dedupe)
- Reads served from DB: market list, activity feed, portfolio, leaderboard
- Seed script + resolver-bot script (admin resolves markets at `end_time`)

**Done when:** placing a bet on-chain appears in the activity feed within seconds; replaying a webhook creates no duplicates.

---

### Phase 6 — Deploy, polish, ship
**Deliverables**
- Program deployed to devnet; `initialize_config` run; test-USDC mint + faucet script
- Vercel frontend deployment with env vars
- README: live demo, GIF of bet→claim flow, architecture diagram (section 4), program ID + explorer link, security considerations (section 9 checklist checked), test coverage list, "what I'd do next"
- Security pass: re-walk section 9 checklist line by line, fix findings
- Tagged release `v1.0.0`

**Done when:** a fresh visitor can open the Vercel URL, connect a devnet wallet, bet, and claim without any manual intervention from us.

---

### Phase map (summary)

| Phase | Area | Depends on |
|---|---|---|
| 0 | Repo, CI, toolchain | — |
| 1 | State + create_market | 0 |
| 2 | place_bet | 1 |
| 3 | Resolve/claim/refund/fees + full tests | 2 |
| 4 | Frontend | 3 (devnet deploy) |
| 5 | Indexer + DB | 3 |
| 6 | Deploy, README, security pass | 4, 5 |

Post-MVP (explicitly deferred): Pyth oracle, dispute window, LMSR AMM, multi-outcome markets, Blinks, mainnet hardening.

---

## 15. How to Present It

**README must have**
- Live demo link and demo video
- Screenshot or GIF of the bet and claim flow
- Architecture diagram (use the one above)
- Program ID and explorer link
- Security considerations and test coverage
- "What I'd do next" section

**Resume bullets (examples)**
- Built a decentralized prediction market on Solana using Rust/Anchor with PDA-based vaults, supporting market creation, pooled betting, resolution and claims.
- Integrated Pyth oracles for trustless, automatic market resolution.
- Wrote a full Anchor test suite covering edge cases (double-claims, overflow, unauthorized resolution).
- Built a Next.js frontend with wallet-adapter and a Helius-powered indexer for live activity feeds and leaderboards.

**Content ideas**
- "Building a prediction market on Solana" video series: one episode per phase
- A walkthrough of PDAs and vaults explained simply
- A post-mortem on bugs found during testing

---

## 16. Resources to Learn From

- Anchor documentation and Anchor book
- Solana Cookbook and Solana developer docs
- Solana Pay and Blinks/Actions docs
- Pyth Network docs (price feeds on Solana)
- Open-source references to study (read, do not copy): escrow examples in the Anchor repo, other open-source Solana AMM and market programs

---

## 17. Next Steps

1. Execute Phase 0: toolchain check, git init, CI, GitHub repo `BerlinDeskMudit/HunchQQ`
2. Phase 1: `Config`, `Market`, `create_market` + first tests
3. Phase 2: `place_bet` + guards
4. Keep a short dev log. It becomes content for your channel and README.
