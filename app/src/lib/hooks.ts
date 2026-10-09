"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Program, Idl } from "@coral-xyz/anchor";
import {
  idl,
  PROGRAM_ID,
  configPda,
  marketPda,
  positionPda,
  getProgram,
} from "@/lib/anchor";
import { MarketAccount, PositionAccount, statusOf } from "@/lib/helpers";

/** Read-only program hooked to the active connection. */
export function useProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();
  return { connection, wallet };
}

export function useAllMarkets() {
  const { connection } = useConnection();
  const [markets, setMarkets] = useState<
    { address: PublicKey; data: MarketAccount }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
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

      const all = await program.account.market.all();
      const mapped = all
        .map((m: any) => ({
          address: m.publicKey as PublicKey,
          data: {
            ...m.account,
            status: statusOf(m.account.status),
            winning_outcome:
              m.account.winning_outcome === null || m.account.winning_outcome === undefined
                ? null
                : Number(m.account.winning_outcome),
          } as MarketAccount,
        }))
        .sort((a, b) => Number(b.data.id.toString()) - Number(a.data.id.toString()));
      setMarkets(mapped);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load markets");
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20_000);
    return () => clearInterval(t);
  }, [refresh]);

  return { markets, loading, error, refresh };
}

export function useMarket(id: string | undefined) {
  const { connection } = useConnection();
  const [market, setMarket] = useState<{ address: PublicKey; data: MarketAccount } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id || Number.isNaN(Number(id))) {
      setError("Invalid market id");
      setLoading(false);
      return;
    }
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

      const [pda] = marketPda(BigInt(id));
      const data: any = await program.account.market.fetch(pda);
      setMarket({
        address: pda,
        data: {
          ...data,
          status: statusOf(data.status),
          winning_outcome:
            data.winning_outcome === null || data.winning_outcome === undefined
              ? null
              : Number(data.winning_outcome),
        } as MarketAccount,
      });
    } catch (e: any) {
      setError(e?.message ?? "Market not found");
    } finally {
      setLoading(false);
    }
  }, [connection, id]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  return { market, loading, error, refresh };
}

export function useMyPosition(marketAddress: PublicKey | undefined) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [position, setPosition] = useState<PositionAccount | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!wallet.publicKey || !marketAddress) {
      setPosition(null);
      return;
    }
    setLoading(true);
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
      const [pda] = positionPda(marketAddress, wallet.publicKey);
      const data: any = await program.account.position.fetchNullable(pda);
      setPosition(data ?? null);
    } catch {
      setPosition(null);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet.publicKey, marketAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { position, loading, refresh };
}

export { configPda, marketPda, positionPda, getProgram, PROGRAM_ID };
