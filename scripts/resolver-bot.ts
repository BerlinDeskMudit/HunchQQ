/**
 * Resolver bot: polls for Open markets past end_time and resolves them.
 * The signing wallet must equal each market's `resolver`.
 *
 * Usage:
 *   HUNCHQQ_PROGRAM_ID=<id> DRY_RUN=1 npx ts-node scripts/resolver-bot.ts
 *
 * DRY_RUN=1 prints what it *would* resolve without sending transactions.
 */
import * as anchor from "@coral-xyz/anchor";
import { Program, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import fs from "fs";
import os from "os";
import path from "path";

const POLL_MS = Number(process.env.POLL_MS ?? 15_000);

async function main() {
  const programId = new PublicKey(process.env.HUNCHQQ_PROGRAM_ID!);
  const connection = new anchor.web3.Connection(
    process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com",
    "confirmed"
  );
  const walletPath =
    process.env.RESOLVER_KEYPAIR ??
    path.join(os.homedir(), ".config", "solana", "id.json");
  const wallet = new Wallet(
    Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8"))))
  );
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  const idl = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "target", "idl", "hunchqq.json"), "utf8")
  );
  const program = new Program<any>({ ...idl, address: programId.toBase58() }, provider);

  const dryRun = process.env.DRY_RUN === "1";
  console.log(`[resolver] polling every ${POLL_MS}ms (dry_run=${dryRun})`);

  for (;;) {
    try {
      const markets = await (program.account as any).market.all();
      const now = Math.floor(Date.now() / 1000);

      for (const { publicKey, account } of markets) {
        const m = account as any;
        const isOpen = typeof m.status === "object" && "open" in m.status;
        if (!isOpen) continue;
        if (m.endTime.toNumber() > now) continue;
        if (m.resolver.toBase58() !== wallet.publicKey.toBase58()) {
          console.log(`[resolver] market ${m.id} resolver != me, skipping`);
          continue;
        }

        // Resolution rule for price markets: placeholder heuristic.
        // Phase 3+ replaces this with Pyth feed reads.
        const outcome = Number(process.env.RESOLVE_OUTCOME ?? 1);

        if (dryRun) {
          console.log(`[resolver] DRY_RUN would resolve market ${m.id} -> ${outcome}`);
          continue;
        }

        const sig = await program.methods
          .resolveMarket(outcome)
          .accountsStrict({ resolver: wallet.publicKey, market: publicKey })
          .rpc();
        console.log(`[resolver] resolved market ${m.id} -> ${outcome}: ${sig}`);
      }
    } catch (e) {
      console.error("[resolver] error:", e);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
