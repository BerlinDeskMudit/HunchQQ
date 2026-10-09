"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OddsBar } from "./OddsBar";
import {
  MarketAccount,
  countdown,
  formatToken,
  totalPool,
  yesProbability,
} from "@/lib/helpers";

const STATUS_STYLE: Record<string, string> = {
  open: "border-yes/50 text-yes",
  resolved: "border-accent/50 text-accent",
  cancelled: "border-no/50 text-no",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLE[status] ?? "border-edge text-gray-400"}`}>{status}</span>;
}

function CountdownText({ endTime }: { endTime: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono text-xs text-gray-400">{countdown(endTime)}</span>;
}

export function MarketCard({ market }: { market: MarketAccount }) {
  const pool = totalPool(market);
  const yesPct = yesProbability(market);
  const endSec = market.end_time.toNumber();

  return (
    <Link href={`/market/${market.id.toString()}`} className="card block">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="font-medium leading-snug text-white">{market.question}</h3>
        <StatusBadge status={market.status} />
      </div>
      <OddsBar yesPct={yesPct} />
      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
        <span className="font-mono">{formatToken(pool)} USDC pool</span>
        {market.status === "open" ? (
          <CountdownText endTime={endSec} />
        ) : (
          <span className="font-mono">
            {market.status === "resolved"
              ? `winner: ${market.winning_outcome === 1 ? "YES" : "NO"}`
              : "cancelled"}
          </span>
        )}
      </div>
    </Link>
  );
}
