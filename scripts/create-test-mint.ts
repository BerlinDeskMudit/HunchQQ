/**
 * Creates a test USDC mint (6 decimals) on devnet and prints the mint address.
 * Optionally mints to a wallet: MINT_TO=<pubkey> AMOUNT=1000
 * Usage: npx ts-node scripts/create-test-mint.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import fs from "fs";
import os from "os";
import path from "path";

async function main() {
  const connection = new anchor.web3.Connection(
    process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com",
    "confirmed"
  );
  const walletPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8")))
  );

  const mint = await createMint(connection, payer, payer.publicKey, null, 6);
  console.log("test USDC mint:", mint.toBase58());

  if (process.env.MINT_TO) {
    const dest = new PublicKey(process.env.MINT_TO);
    const amount = Number(process.env.AMOUNT ?? 1000) * 1_000_000;
    const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, dest);
    await mintTo(connection, payer, mint, ata.address, payer, amount);
    console.log(`minted ${amount / 1e6} tokens to ${dest.toBase58()}`);
  }

  console.log("add to frontend .env.local:");
  console.log(`NEXT_PUBLIC_USDC_MINT=${mint.toBase58()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
