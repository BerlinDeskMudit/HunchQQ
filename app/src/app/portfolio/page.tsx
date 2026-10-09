"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Program, Idl, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { idl } from "@/lib/anchor";
import {
  MarketAccount,
  formatToken,
  previewPayout,
  statusOf,
  totalPool,
} from "@/lib/helpers";
import { StatusBadge } from "@/components/MarketCard";

interface Row {
  positionKey: PublicKey;
  marketId: number;
  market: MarketAccount | null;
  yes: BN;
  no: BN;
  claimed: boolean;
}

function useReadProgram() {
  const { connection } = useConnection();
  return { connection };
}

export default function PortfolioPage() {
  const wallet = useWallet();
  const { connection } = useReadProgram();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet.publicKey) {
      setRows([]);
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const readWallet = {
          publicKey: PublicKey.default,
          signTransaction: async (t: any) => t,
          signAllTransactions: async (t: any) => t,
        };
        const program = new Program(idl as Idl, {
          connection,
          publicKey: readWallet.publicKey,
          signTransaction: readWallet.signTransaction,
          signAllTransactions: readWallet.signAllTransactions,
        } as any);

        const positions = await program.account.position.all([
          { memcmp: { offset: 8 + 32, bytes: wallet.publicKey.toBase58() } },
        ]);

        const out: Row[] = [];
        for (const p of positions) {
          const acc = p.account as any;
          // Derive market id from the position's market pubkey by fetching it.
          let marketAcc: any = null;
          try {
            marketAcc = await program.account.market.fetch(acc.market);
          } catch {
            marketAcc = null;
          }
          out.push({
            positionKey: p.publicKey,
            marketId: marketAcc ? Number(marketAcc.id.toString()) : -1,
            market: marketAcc
              ? ({
                  ...marketAcc,
                  status: statusOf(marketAcc.status),
                  winning_outcome:
                    marketAcc.winning_outcome === null ||
                    marketAcc.winning_outcome === undefined
                      ? null
                      : Number(marketAcc.winning_outcome),
                } as MarketAccount)
              : null,
            yes: acc.yes_amount,
            no: acc.no_amount,
            claimed: acc.claimed,
          });
        }
        setRows(out.sort((a, b) => b.marketId - a.marketId));
      } catch (e: any) {
        setError(e?.message ?? "Failed to load portfolio");
      } finally {
        setLoading(false);
      }
    })();
  }, [connection, wallet.publicKey]);

  if (!wallet.publicKey) {
    return (
      <div className="card mx-auto max-w-lg space-y-3 text-center">
        <h1 className="text-lg font-semibold">Portfolio</h1>
        <p className="text-sm text-gray-400">Connect a wallet to see your bets.</p>
        <div className="flex justify-center">
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Portfolio</h1>
      <p className="mb-6 text-sm text-gray-400">Your open bets, claimable winnings and history.</p>

      {error && (
        <div className="mb-4 rounded-lg border border-no/40 bg-no/10 px-4 py-3 text-sm text-no">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="card h-20 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="card text-center text-sm text-gray-400">
          No bets yet.{" "}
          <Link href="/" className="text-accent hover:underline">
            Browse markets →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const m = r.market;
            const stake = BigInt(r.yes.toString()) + BigInt(r.no.toString());
            let claimable = 0n;
            let label = "";
            if (m && m.status === "resolved" && !r.claimed) {
              const winning = m.winning_outcome === 1 ? BigInt(m.yes_pool.toString()) : BigInt(m.no_pool.toString());
              const myWin = m.winning_outcome === 1 ? BigInt(r.yes.toString()) : BigInt(r.no.toString());
              if (winning > 0n && myWin > 0n) {
                claimable = previewPayout(myWin, totalPool(m), winning);
                label = "claimable";
              } else if (winning === 0n) {
                claimable = stake;
                label = "refundable";
              }
            } else if (m && m.status === "cancelled" && !r.claimed) {
              claimable = stake;
              label = "refundable";
            }

            return (
              <div key={r.positionKey.toBase58()} className="card flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={m ? `/market/${r.marketId}` : "#"}
                      className="truncate font-medium hover:text-accent"
                    >
                      {m ? m.question : `Market #${r.marketId}`}
                    </Link>
                    {m && <StatusBadge status={m.status} />}
                  </div>
                  <div className="mt-1 font-mono text-xs text-gray-400">
                    Yes {formatToken(r.yes.toString())} · No {formatToken(r.no.toString())} ·{" "}
                    {r.claimed ? "settled" : label || "open"}
                  </div>
                </div>
                <div className="text-right">
                  {claimable > 0n && (
                    <div className="font-mono text-sm text-yes">
                      {formatToken(claimable)} USDC
                    </div>
                  )}
                  <Link href={m ? `/market/${r.marketId}` : "#"} className="btn-ghost mt-1 text-xs">
                    {claimable > 0n ? "Claim →" : "View →"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
