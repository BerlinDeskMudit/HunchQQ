# Toolchain Setup

hunch-prediction-market builds on **Windows (WSL2)**, **macOS**, and **Linux**. The program toolchain is Rust + Solana CLI (Agave) + Anchor; the frontend needs Node 20+.

> Solana CLI must stay pointed at **devnet**: `solana config set --url devnet`

## Option A — One-shot script (WSL / macOS / Linux)

```bash
git clone https://github.com/BerlinDeskMudit/hunch-prediction-market.git
cd hunch-prediction-market
bash scripts/setup-wsl-toolchain.sh
```

The script installs (idempotently):

1. System packages: `build-essential`, `pkg-config`, `libssl-dev`, `clang`, `cmake`, `libudev-dev`
2. Rust (rustup, stable)
3. Solana CLI / Agave (stable release binaries)
4. Anchor CLI via `avm` (latest stable)
5. A devnet keypair at `~/.config/solana/id.json` + airdrop

Verify:

```bash
rustc --version && solana --version && anchor --version && node --version
solana config get    # Url should be https://api.devnet.solana.com
```

## Option B — Manual install

### 1. Rust

```bash
curl https://sh.rustup.rs -sSf | sh -s -- -y
source "$HOME/.cargo/env"
```

### 2. Solana CLI (Agave)

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
source "$HOME/.cargo/env"   # adds ~/.local/share/solana/install/active_release/bin
solana --version
```

### 3. Anchor CLI

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install latest && avm use latest
anchor --version
```

Anchor version must match `Anchor.toml` — don't upgrade casually.

### 4. Node.js 20+

```bash
node --version   # >= 20
npm --version
```

## Wallet + devnet funds

```bash
solana-keygen new --no-bip39-passphrase -o ~/.config/solana/id.json   # if you have none
solana config set --url devnet
solana airdrop 2
solana balance
```

**Never commit keypairs.** `id.json` is gitignored.

## Windows notes

- Use **WSL2 with Ubuntu** — native Windows builds of Solana/Anchor are unreliable.
- Keep the repo on the Windows filesystem (`/mnt/c/...`) or inside WSL (`~/`); both work, but builds are faster inside the WSL filesystem.
- Docker Desktop WSL2 backend is optional (used only if you want a local Postgres).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `anchor: command not found` | `source ~/.cargo/env`, then `avm use latest` |
| `solana: command not found` | Re-run the Agave installer; check `~/.local/share/solana/install/active_release/bin` on PATH |
| `avm install` compile fails | `sudo apt install build-essential pkg-config libssl-dev clang cmake` and retry |
| Airdrop rate-limited | Wait 30s, retry, or use the [Solana faucet](https://faucet.solana.com) |
| `anchor test` can't find validator | `solana-test-validator` must be on PATH (part of Agave install) |
