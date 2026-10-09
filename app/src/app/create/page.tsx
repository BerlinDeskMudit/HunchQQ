"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getProgram, configPda, marketPda, vaultPda, USDC_MINT } from "@/lib/anchor";
import { friendlyError } from "@/lib/errors";

const MAX_QUESTION = 200;

export default function CreatePage() {
  const router = useRouter();
  const wallet = useWallet();

  const [question, setQuestion] = useState("");
  const [endDate, setEndDate] = useState("");
  const [resolver, setResolver] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const questionOk = question.trim().length > 0 && question.length <= MAX_QUESTION;
  const endTime = endDate ? Math.floor(new Date(endDate).getTime() / 1000) : 0;
  const timeOk = endTime > Math.floor(Date.now() / 1000) + 60;
  const mintOk = !!USDC_MINT;
  const canSubmit = questionOk && timeOk && mintOk && !busy;

  async function submit() {
    setError(null);
    if (!wallet.publicKey || !wallet.sendTransaction) {
      setError("Connect a wallet first.");
      return;
    }
    setBusy(true);
    setStatus("Building transaction…");
    try {
      const program = getProgram(wallet as any);
      const [configKey] = configPda();

      // Next id = on-chain market_count; derive the PDA ahead of time so we
      // can redirect to it after the tx confirms.
      const config: any = await program.account.config.fetch(configKey);
      const nextId = BigInt(config.marketCount.toString());
      const [marketKey] = marketPda(nextId);
      const [vaultKey] = vaultPda(marketKey);

      const resolverKey = resolver.trim()
        ? new PublicKey(resolver.trim())
        : wallet.publicKey;

      setStatus("Waiting for wallet approval…");
      const sig = await program.methods
        .createMarket(
          question.trim().slice(0, MAX_QUESTION),
          new BN(endTime),
          resolverKey
        )
        .accountsStrict({
          creator: wallet.publicKey,
          config: configKey,
          market: marketKey,
          mint: USDC_MINT!,
          vault: vaultKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        } as any)
        .rpc();

      setStatus(`Created: ${sig.slice(0, 8)}…`);
      router.push(`/market/${nextId.toString()}`);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
      setStatus(null);
    }
  }

  if (!wallet.publicKey) {
    return (
      <div className="card mx-auto max-w-lg space-y-3 text-center">
        <h1 className="text-lg font-semibold">Create a market</h1>
        <p className="text-sm text-gray-400">Connect a wallet to create a market.</p>
        <div className="flex justify-center">
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold">Create a market</h1>
      <p className="mb-6 text-sm text-gray-400">
        Anyone can create a binary (Yes/No) market. Betting opens immediately.
      </p>

      {!mintOk && (
        <div className="mb-4 rounded-lg border border-no/40 bg-no/10 px-4 py-3 text-sm text-no">
          NEXT_PUBLIC_USDC_MINT is not set — deploy the program and run
          scripts/create-test-mint.ts first (see README).
        </div>
      )}

      <div className="card space-y-4">
        <div>
          <label className="mb-1 block text-xs text-gray-400">
            Question ({question.length}/{MAX_QUESTION})
          </label>
          <textarea
            className="input min-h-[80px]"
            value={question}
            maxLength={MAX_QUESTION}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will BTC close above $100k on Dec 31?"
          />
          {!questionOk && question.length > 0 && (
            <p className="mt-1 text-xs text-no">Question must be 1–200 characters.</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-400">End time (local)</label>
          <input
            type="datetime-local"
            className="input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          {!timeOk && endDate && (
            <p className="mt-1 text-xs text-no">End time must be at least 1 minute ahead.</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-400">
            Resolver address (optional — defaults to you)
          </label>
          <input
            className="input font-mono"
            value={resolver}
            onChange={(e) => setResolver(e.target.value)}
            placeholder={wallet.publicKey.toBase58()}
          />
        </div>

        <button onClick={submit} disabled={!canSubmit} className="btn-primary w-full">
          {busy ? "Working…" : "Create market"}
        </button>

        {status && <p className="text-center text-xs text-accent">{status}</p>}
        {error && <p className="text-center text-xs text-no">{error}</p>}
      </div>
    </div>
  );
}
