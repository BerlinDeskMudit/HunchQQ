#!/usr/bin/env bash
# Devnet-only program deploy for HunchQQ.
# Usage: bash scripts/deploy-devnet.sh
set -euo pipefail

echo "[deploy] checking cluster..."
CURRENT=$(solana config get | grep -i "^Url" | awk '{print $2}')
if [[ "$CURRENT" != *"devnet"* ]]; then
  echo "ERROR: solana CLI must point at devnet (got $CURRENT). Run: solana config set --url devnet" >&2
  exit 1
fi

echo "[deploy] building..."
anchor build

echo "[deploy] syncing program id..."
anchor keys sync
anchor build

echo "[deploy] deploying to devnet..."
anchor deploy --provider.cluster devnet

PROGRAM_ID=$(anchor keys list | grep hunchqq | head -1 | awk '{print $2}')
echo "[deploy] done. Program ID: $PROGRAM_ID"
echo "[deploy] next: anchor idl init --provider.cluster devnet --program-id $PROGRAM_ID target/idl/hunchqq.json (or publish IDL for the frontend)"
