#!/usr/bin/env bash
# HunchQQ — one-shot WSL toolchain setup (Rust, Agave/Solana CLI, Anchor via avm)
set -euo pipefail

log() { echo "[setup $(date +%H:%M:%S)] $*"; }

log "apt packages"
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y -qq
sudo apt-get install -y -qq build-essential pkg-config libssl-dev clang cmake libudev-dev curl git jq ufw 2>/dev/null || \
sudo apt-get install -y build-essential pkg-config libssl-dev clang cmake libudev-dev curl git jq

if ! command -v cargo >/dev/null 2>&1; then
  log "installing rustup"
  curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain stable --profile minimal
fi
source "$HOME/.cargo/env"
log "rustc $(rustc --version)"

if ! command -v solana >/dev/null 2>&1; then
  log "installing agave (solana cli)"
  sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
fi
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
log "solana $(solana --version)"

if ! command -v anchor >/dev/null 2>&1; then
  log "installing avm (this compiles, takes a while)"
  cargo install --git https://github.com/coral-xyz/anchor avm --force
  log "avm installing latest anchor (compiles anchor-cli)"
  avm install latest
  avm use latest
fi
log "anchor $(anchor --version)"

mkdir -p "$HOME/.config/solana"
if [ ! -f "$HOME/.config/solana/id.json" ]; then
  log "generating devnet wallet"
  solana-keygen new --no-bip39-passphrase -o "$HOME/.config/solana/id.json" --force
fi
solana config set --url devnet >/dev/null
log "wallet: $(solana address)"
for i in 1 2 3; do
  solana airdrop 2 >/dev/null 2>&1 && break
  sleep 5
done
log "balance: $(solana balance || true)"
log "SETUP COMPLETE"
