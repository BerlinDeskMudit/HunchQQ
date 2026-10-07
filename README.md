# HunchQQ

> Bet on anything, settle on-chain, trust no one.

A decentralized prediction market on **Solana** — pooled (parimutuel) Yes/No bets held in program-owned PDA vaults, resolved on-chain, claimed directly from the program. **Devnet only, test tokens only — technical demo, not a betting product.**

## Status

Build in progress. Plan: [HunchQQDocs.md](./HunchQQDocs.md)

| Phase | Scope | Status |
|---|---|---|
| 0 | Repo, CI, toolchain | in progress |
| 1 | State accounts + `create_market` | pending |
| 2 | `place_bet` | pending |
| 3 | Resolve / claim / refund / fees + full tests | pending |
| 4 | Next.js frontend | pending |
| 5 | Indexer + DB | pending |
| 6 | Devnet deploy, README, security pass | pending |

## Stack

- **Program**: Rust + Anchor (SPL Token)
- **Frontend**: Next.js + TypeScript + Tailwind + `@solana/wallet-adapter`
- **Indexer**: Helius webhook → Supabase (Postgres)
- **Network**: Solana devnet

## Architecture

```
Next.js Frontend ──▶ Wallet Adapter ──▶ Anchor Program (PDAs: Config / Market / Vault / Position)
       │                                          │ events
       ▼                                          ▼
   Supabase API ◀──────── Indexer ◀──────── Helius Webhooks
```

## Security considerations

- Strict Anchor account validation (signers, seeds, bumps, mint/authority checks)
- Checked arithmetic everywhere; `u128` intermediates for payouts; rounding favors the vault
- One-time resolution and claims; bets after `end_time` and resolution before it rejected
- Pause switch for emergency stop

_(Full checklist: HunchQQDocs.md §9)_

## License

MIT
