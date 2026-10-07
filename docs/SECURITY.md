# Security

> Scope: **devnet demo**. No real funds, no audit performed, not production-ready. Do not deploy with real value.

## Threat model (what we defend against)

| Threat | Mitigation |
|---|---|
| Stealing the market vault | Vault is a PDA owned by the program; only program instructions can move tokens |
| Forging a market/position | Every account validated: owner, PDA seeds, bumps, mint, token authority |
| Betting after close | `place_bet` requires `status == Open` **and** `now < end_time` |
| Resolving early / twice | `resolve_market` requires `now >= end_time` and `status == Open` |
| Claiming twice / losers claiming | `claimed` flag + payout math gives losers 0; wrong status rejected |
| Integer overflow / overpay | `checked_*` everywhere, `u128` intermediates, floor rounding favors vault |
| Fee theft | `fee_bps` capped; only stored admin can `withdraw_fees` |
| Griefing via market spam | Question length bounds; optional creation fee (post-MVP) |
| Compromised admin key | Emergency `set_paused`; production path: multisig + timelock (post-MVP) |
| Stale oracle data | Oracle resolution is Phase 3+ with freshness/confidence checks (not in MVP) |

## Program checklist (§9 of the spec)

- [ ] Every instruction checks signers and account ownership
- [ ] PDA seeds and bumps validated via Anchor constraints
- [ ] Token accounts checked for correct mint and authority
- [ ] Bets rejected after `end_time`; resolution rejected before it
- [ ] Resolve only once; claim only once (`claimed` flag)
- [ ] Checked arithmetic everywhere; `u128` for payouts
- [ ] Rounding favors the vault
- [ ] Only the stored resolver can resolve; only admin can pause or withdraw fees
- [ ] Pause switch tested
- [ ] Question length and input bounds enforced
- [ ] No unchecked `remaining_accounts`
- [ ] Oracle freshness and confidence checks (Phase 3 — deferred)

Status is updated as phases land; each tick must correspond to a passing test.

## Frontend / ops

- Program ID and RPC come from `NEXT_PUBLIC_*` env vars — never hardcoded, never a private key in the browser.
- `.env*` files are gitignored; CI never receives secrets for forks.
- Webhook endpoint verifies payload shape and dedupes by transaction signature (idempotent).
- RPC keys are rate-limited server-side only where possible.

## Test coverage gates

`anchor test` must cover (see `docs/SPEC.md` §10):

- Happy: create → bet both sides → resolve → claim; vault ends at ≈ fee dust
- Happy: cancel → everyone refunded in full
- Negative: late bet, early resolve, double resolve, double claim, loser claim, wrong resolver, wrong mint, zero-winner side, overflow-sized bets, paused program

## Disclosure policy

Report vulnerabilities via **GitHub private security advisory** (Security → Report a vulnerability), not a public issue. Expect an acknowledgment within 72 hours. Since this is a devnet demo with no real funds, impact is limited to demo integrity — but reports are still welcome and credited.
