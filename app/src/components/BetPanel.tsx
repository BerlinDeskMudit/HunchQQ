"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import { getProgram, marketPda, positionPda, configPda, vaultPda } from "@/lib/anchor";
import { friendlyError } from "@/lib/errors";
import {
  MarketAccount,
  formatToken,
  previewPayout,
  toRaw,
  totalPool,
} from "@/lib/helpers";
import { useMyPosition } from "@/lib/hooks";

interface Props {
  market: MarketAccount;
  marketAddress: PublicKey;
  onConfirmed: () => void;
}

export function BetPanel({ market, marketAddress, onConfirmed }: Props) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { position, refresh: refreshPosition } = useMyPosition(marketAddress);
  const [side, setSide] = useState<0 | 1>(1);
  const [amount, setAmount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pool = totalPool(market);
  const winningPool =
    side === 1 ? BigInt(market.yes_pool.toString()) : BigInt(market.no_pool.toString());

  let stakeRaw = 0n;
  try {
    stakeRaw = toRaw(amount || "0");
  } catch {
    stakeRaw = 0n;
  }
  const payout = previewPayout(stakeRaw, pool, winningPool);

  const bettingOpen =
    market.status === "open" && Date.now() < market.end_time.toNumber() * 1000;

  const mint = new PublicKey(market.mint);
  const [marketKey] = marketPda(BigInt(market.id.toString()));
  const [vaultKey] = vaultPda(marketKey);
  const [configKey] = configPda();

  async function userAta(): Promise<PublicKey> {
    return getAssociatedTokenAddressSync(mint, wallet.publicKey!);
  }

  async function placeBet() {
    setError(null);
    if (!wallet.publicKey || !wallet.sendTransaction) {
      setError("Connect a wallet first.");
      return;
    }
    if (stakeRaw <= 0n) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setBusy(true);
    setStatus("Checking token account…");
    try {
      const ata = await userAta();
      try {
        await getAccount(connection, ata);
      } catch {
        setError("No test-USDC account found. Run the faucet first (see README).");
        setBusy(false);
        setStatus(null);
        return;
      }

      const [positionKey] = positionPda(marketKey, wallet.publicKey);
      const program = getProgram(wallet as any);

      setStatus("Waiting for wallet approval…");
      const sig = await program.methods
        .placeBet(new BN(stakeRaw.toString()), side)
        .accountsStrict({
          user: wallet.publicKey,
          config: configKey,
          market: marketKey,
          mint,
          userToken: ata,
          vault: vaultKey,
          position: positionKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();

      setStatus(`Bet placed: ${sig.slice(0, 8)}…${sig.slice(-8)}`);
      await refreshPosition();
      onConfirmed();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(null), 5000);
    }
  }

  async function claim(method: "claimWinnings" | "claimRefund") {
    setError(null);
    if (!wallet.publicKey || !wallet.sendTransaction) return;
    setBusy(true);
    setStatus("Waiting for wallet approval…");
    try {
      const ata = await userAta();
      const [positionKey] = positionPda(marketKey, wallet.publicKey);
      const program = getProgram(wallet as any);

      const ix = program.methods[method]() as any;
      const accounts: Record<string, PublicKey> =
        method === "claimWinnings"
          ? {
              user: wallet.publicKey,
              config: configKey,
              market: marketKey,
              position: positionKey,
              mint,
              vault: vaultKey,
              userToken: ata,
              tokenProgram: TOKEN_PROGRAM_ID,
            }
          : {
              user: wallet.publicKey,
              market: marketKey,
              position: positionKey,
              mint,
              vault: vaultKey,
              userToken: ata,
              tokenProgram: TOKEN_PROGRAM_ID,
            };

      const sig = await ix.accountsStrict(accounts).rpc();
      setStatus(
        `${method === "claimWinnings" ? "Claimed" : "Refunded"}: ${sig.slice(0, 8)}…${sig.slice(-8)}`
      );
      await refreshPosition();
      onConfirmed();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(null), 5000);
    }
  }

  if (!wallet.publicKey) {
    return (
      <div className="card space-y-3 text-center">
        <p className="text-sm text-gray-400">Connect a wallet to bet on this market.</p>
        <div className="flex justify-center">
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  const stakeOnSide =
    (side === 1 ? position?.yes_amount?.toNumber() : position?.no_amount?.toNumber()) ?? 0;

  return (
    <div className="card space-y-4">
      {market.status === "resolved" ? (
        <div className="space-y-3">
          <p className="text-sm">
            Market resolved:{" "}
            <strong className={market.winning_outcome === 1 ? "text-yes" : "text-no"}>
              {market.winning_outcome === 1 ? "YES" : "NO"}
            </strong>
          </p>
          {position && !position.claimed ? (
            <button
              onClick={() => claim("claimWinnings")}
              disabled={busy}
              className="btn-primary w-full"
            >
              {busy ? "Working…" : "Claim winnings"}
            </button>
          ) : (
            <p className="text-xs text-gray-500">
              {position?.claimed ? "Already claimed." : "No position on this market."}
            </p>
          )}
        </div>
      ) : market.status === "cancelled" ? (
        <div className="space-y-3">
          <p className="text-sm text-no">Market cancelled — reclaim your stake.</p>
          {position && !position.claimed ? (
            <button
              onClick={() => claim("claimRefund")}
              disabled={busy}
              className="btn-primary w-full"
            >
              {busy ? "Working…" : "Claim refund"}
            </button>
          ) : (
            <p className="text-xs text-gray-500">
              {position?.claimed ? "Already refunded." : "No position on this market."}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSide(1)}
              className={`${side === 1 ? "btn-yes" : "btn-ghost"} w-full`}
            >
              Yes
            </button>
            <button
              onClick={() => setSide(0)}
              className={`${side === 0 ? "btn-no" : "btn-ghost"} w-full`}
            >
              No
            </button>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-400">Amount (USDC)</label>
            <input
              className="input"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="10"
            />
          </div>

          <div className="rounded-lg border border-edge bg-ink px-3 py-2 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Potential payout</span>
              <span className="font-mono text-white">{formatToken(payout)} USDC</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>Your stake on {side === 1 ? "Yes" : "No"}</span>
              <span className="font-mono">{formatToken(stakeOnSide)} USDC</span>
            </div>
          </div>

          {!bettingOpen && (
            <p className="text-xs text-no">Betting is closed for this market.</p>
          )}

          <button
            onClick={placeBet}
            disabled={busy || !bettingOpen}
            className="btn-primary w-full"
          >
            {busy ? "Working…" : `Bet ${side === 1 ? "Yes" : "No"}`}
          </button>
        </>
      )}

      {status && <p className="text-center text-xs text-accent">{status}</p>}
      {error && <p className="text-center text-xs text-no">{error}</p>}
    </div>
  );
}
