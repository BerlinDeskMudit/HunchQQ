#!/usr/bin/env bash
# Create a devnet keypair + fund it. Never commits or prints the key.
set -euo pipefail

WALLET="${1:-$HOME/.config/solana/id.json}"

if [ ! -f "$WALLET" ]; then
  mkdir -p "$(dirname "$WALLET")"
  solana-keygen new --no-bip39-passphrase -o "$WALLET" --force
  echo "[wallet] created $WALLET"
fi

solana config set --url devnet >/dev/null
ADDR=$(solana address -k "$WALLET")
echo "[wallet] address: $ADDR"

for i in 1 2 3; do
  if solana airdrop 2 2>/dev/null; then break; fi
  echo "[wallet] airdrop failed, retrying in 10s ($i/3)"
  sleep 10
done

echo "[wallet] balance: $(solana balance -k "$WALLET" || true)"
