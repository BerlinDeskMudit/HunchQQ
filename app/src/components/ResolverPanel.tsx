"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, Idl } from "@coral-xyz/anchor";
import { idl, configPda, marketPda } from "@/lib/anchor";
import { friendlyError } from "@/lib/errors";
import { MarketAccount } from "@/lib/helpers";

interface Props {
  market: MarketAccount;
  onConfirmed: () => void;
}

/** Resolve (resolver only, after end) or cancel (admin/resolver) controls. */
export function ResolverPanel({ market, onConfirmed }: Props) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!wallet.publicKey || market.status !== "open") return null;

  const isResolver = wallet.publicKey.toBase58() === market.resolver;
  if (!isResolver) return null;

  const ended = Date.now() >= market.end_time.toNumber() * 1000;
  const [marketKey] = marketPda(BigInt(market.id.toString()));
  const [configKey] = configPda();

  async function run(kind: "resolveYes" | "resolveNo" | "cancel") {
    setError(null);
    if (!wallet.publicKey || !wallet.sendTransaction) return;
    setBusy(true);
    setStatus("Waiting for wallet approval…");
    try {
      const readWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction!,
        signAllTransactions: wallet.signAllTransactions!,
      };
      const program = new Program(idl as Idl, { connection, ...readWallet } as any);

      const ix =
        kind === "cancel"
          ? program.methods.cancelMarket().accountsStrict({
              signer: wallet.publicKey!,
              config: configKey,
              market: marketKey,
            } as any)
          : program.methods
              .resolveMarket(kind === "resolveYes" ? 1 : 0)
              .accountsStrict({
                resolver: wallet.publicKey!,
                market: marketKey,
              } as any);

      const sig = await ix.rpc();
      setStatus(`Done: ${sig.slice(0, 8)}…${sig.slice(-8)}`);
      onConfirmed();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(null), 5000);
    }
  }

  return (
    <div className="card space-y-3 border-accent/30">
      <div className="text-xs font-semibold uppercase tracking-wide text-accent">
        Resolver controls
      </div>
      {ended ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => run("resolveYes")}
            disabled={busy}
            className="btn-primary bg-yes/80 hover:bg-yes"
          >
            Resolve YES
          </button>
          <button
            onClick={() => run("resolveNo")}
            disabled={busy}
            className="btn-primary bg-no/80 hover:bg-no"
          >
            Resolve NO
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-500">
          Resolution unlocks after the market end time.
        </p>
      )}
      <button
        onClick={() => run("cancel")}
        disabled={busy}
        className="btn-ghost w-full text-no"
      >
        Cancel market (refunds all bettors)
      </button>
      {status && <p className="text-center text-xs text-accent">{status}</p>}
      {error && <p className="text-center text-xs text-no">{error}</p>}
    </div>
  );
}
