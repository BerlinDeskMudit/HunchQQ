/**
 * Faucet: mint test USDC to a wallet (requires MINT + PAYER keypair).
 * Usage: MINT=<mint> TO=<wallet> AMOUNT=100 npx ts-node scripts/faucet.ts
 */
import { Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import anchor from "@coral-xyz/anchor";
import fs from "fs";
import os from "os";
import path from "path";

async function main() {
  const mint = new PublicKey(process.env.MINT!);
  const to = new PublicKey(process.env.TO!);
  const amount = Number(process.env.AMOUNT ?? 100) * 1_000_000;

  const connection = new anchor.web3.Connection(
    process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com",
    "confirmed"
  );
  const payerPath = process.env.PAYER ?? path.join(os.homedir(), ".config", "solana", "id.json");
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(payerPath, "utf8")))
  );

  const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, to);
  const sig = await mintTo(connection, payer, mint, ata.address, payer, amount);
  console.log(`minted ${amount / 1e6} tokens to ${to.toBase58()}`);
  console.log("tx:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
