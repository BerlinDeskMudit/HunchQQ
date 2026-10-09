/**
 * One-time devnet setup: initialize_config for HunchQQ.
 * Usage: HUNCHQQ_PROGRAM_ID=<id> npx ts-node scripts/init-config.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { Program, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import fs from "fs";
import os from "os";
import path from "path";

async function main() {
  const programId = new PublicKey(process.env.HUNCHQQ_PROGRAM_ID!);
  const connection = new anchor.web3.Connection(
    process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com",
    "confirmed"
  );

  const walletPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const wallet = new Wallet(Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8")))));

  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  const idl = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "target", "idl", "hunchqq.json"), "utf8")
  );
  const program = new Program({ ...idl, address: programId.toBase58() }, provider);

  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);

  const feeBps = Number(process.env.FEE_BPS ?? 200);
  const signature = await program.methods
    .initializeConfig(feeBps, wallet.publicKey)
    .accountsStrict({
      admin: wallet.publicKey,
      config: configPda,
      systemProgram: PublicKey.default,
    } as any)
    .rpc();

  console.log("config initialized:", configPda.toBase58());
  console.log("tx:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
