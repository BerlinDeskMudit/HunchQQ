import { BN } from "@coral-xyz/anchor";

export type MarketStatus = "open" | "resolved" | "cancelled";

export interface MarketAccount {
  id: BN;
  creator: string;
  resolver: string;
  mint: string;
  question: string;
  end_time: BN;
  status: MarketStatus;
  winning_outcome: number | null;
  yes_pool: BN;
  no_pool: BN;
  fee_collected: boolean;
}

export interface PositionAccount {
  market: string;
  user: string;
  yes_amount: BN;
  no_amount: BN;
  claimed: boolean;
}

/** Normalize Anchor's enum (object or string) to a plain string. */
export function statusOf(s: unknown): MarketStatus {
  if (typeof s === "string") return s as MarketStatus;
  if (s && typeof s === "object") {
    const k = Object.keys(s as object)[0];
    if (k) return k.toLowerCase() as MarketStatus;
  }
  return "open";
}

export const FEE_BPS_DEFAULT = 200;

export function totalPool(m: { yes_pool: BN; no_pool: BN }): bigint {
  return BigInt(m.yes_pool.toString()) + BigInt(m.no_pool.toString());
}

/** Implied probability of Yes in [0,1]; 0.5 when empty. */
export function yesProbability(m: { yes_pool: BN; no_pool: BN }): number {
  const t = totalPool(m);
  if (t === 0n) return 0.5;
  return Number(BigInt(m.yes_pool.toString())) / Number(t);
}

/** Parimutuel payout preview: stake * (total - fee) / winningPool (floored). */
export function previewPayout(
  stake: bigint,
  totalPool_: bigint,
  winningPool: bigint,
  feeBps: number = FEE_BPS_DEFAULT
): bigint {
  if (winningPool <= 0n) return stake; // zero-winner -> full refund
  const fee = (totalPool_ * BigInt(feeBps)) / 10_000n;
  const pool = totalPool_ - fee;
  return (stake * pool) / winningPool;
}

export function formatToken(raw: bigint | string | number, decimals = 6): string {
  const v = typeof raw === "bigint" ? raw : BigInt(raw);
  const whole = v / 10n ** BigInt(decimals);
  const frac = (v % 10n ** BigInt(decimals)).toString().padStart(decimals, "0");
  const trimmed = frac.replace(/0+$/, "").slice(0, 4);
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

export function toRaw(amount: string, decimals = 6): bigint {
  const [w, f = ""] = amount.split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(w || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
}

export function shortKey(key: string): string {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export function countdown(endTimeSec: number, nowMs = Date.now()): string {
  const diff = Math.floor(endTimeSec * 1000 - nowMs);
  if (diff <= 0) return "ended";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function explorerTx(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

export function explorerAccount(key: string): string {
  return `https://explorer.solana.com/address/${key}?cluster=devnet`;
}
