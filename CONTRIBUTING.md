# Contributing to HunchQQ

Thanks for your interest in contributing! This is a Solana prediction-market dApp (Anchor + Next.js) built as a devnet-only technical demo.

## Ground rules

- **Devnet only.** Never add mainnet deployment, real-money paths, or private keys to the repo.
- **No secrets.** Keys, RPC tokens and `.env` files stay out of git (see `.gitignore`).
- Production-grade bar: every instruction needs account validation, checked arithmetic, and tests.

## Getting started

1. Fork and clone the repo.
2. Toolchain: Rust, Solana CLI (Agave), Anchor CLI, Node 20+ (see `docs/SPEC.md` §3).
3. `anchor build && anchor test` must pass before you open a PR.

## How we work

- **Issues** are scoped per build phase (see the issue tracker). Claim an issue by commenting on it.
- **PRs** reference the issue (`Closes #12`), keep a focused diff, and include tests for any program change.
- Program changes require `anchor test` green; frontend changes require a working `npm run build`.
- Review: one approval merges; squash-merge preferred.

## Project layout

```
programs/hunchqq/   # Anchor program (Rust)
tests/              # Anchor test suite
app/                # Next.js frontend
indexer/            # Webhook handler + DB schema
scripts/            # Setup, faucet, resolver bot
```

## Reporting bugs

Use the bug report issue template: include steps, expected/actual behavior, and environment (OS, CLI versions, wallet).

## Security

Do not open public issues for vulnerabilities holding funds logic — email the maintainer via the security contact in the README, then we'll coordinate disclosure.
