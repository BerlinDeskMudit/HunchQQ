"use client";

import Link from "next/link";
import { useMarket } from "@/lib/hooks";
import { BetPanel } from "@/components/BetPanel";
import { OddsBar } from "@/components/OddsBar";
import { ResolverPanel } from "@/components/ResolverPanel";
import { StatusBadge } from "@/components/MarketCard";
import {
  countdown,
  explorerAccount,
  formatToken,
  totalPool,
  yesProbability,
} from "@/lib/helpers";

export default function MarketPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { market, loading, error, refresh } = useMarket(id);

  if (loading) {
    return <div className="card h-40 animate-pulse" />;
  }
  if (error || !market) {
    return (
      <div className="card text-center text-sm text-gray-400">
        {error ?? "Market not found."}{" "}
        <Link href="/" className="text-accent hover:underline">
          ← Back to markets
        </Link>
      </div>
    );
  }

  const m = market.data;
  const pool = totalPool(m);
  const yesPct = yesProbability(m);
  const bettingOpen = m.status === "open" && Date.now() < m.end_time.toNumber() * 1000;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="card">
          <div className="mb-2 flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold leading-snug">{m.question}</h1>
            <StatusBadge status={m.status} />
          </div>

          <OddsBar yesPct={yesPct} />

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-xs text-gray-500">Yes pool</div>
              <div className="font-mono text-yes">{formatToken(m.yes_pool.toString())}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">No pool</div>
              <div className="font-mono text-no">{formatToken(m.no_pool.toString())}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Total</div>
              <div className="font-mono">{formatToken(pool)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">
                {m.status === "open" ? "Closes in" : "Status"}
              </div>
              <div className="font-mono">
                {m.status === "open"
                  ? countdown(m.end_time.toNumber())
                  : m.status.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        <div className="card text-xs text-gray-400">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              Market&nbsp;
              <a
                href={explorerAccount(market.address.toBase58())}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-accent hover:underline"
              >
                {market.address.toBase58().slice(0, 12)}…
              </a>
            </div>
            <div>
              Resolver:&nbsp;
              <span className="font-mono">{m.resolver.slice(0, 8)}…{m.resolver.slice(-8)}</span>
            </div>
            <div>
              Ends:{" "}
              <span className="font-mono">
                {new Date(m.end_time.toNumber() * 1000).toLocaleString()}
              </span>
            </div>
            <div>
              Betting:{" "}
              <span className={bettingOpen ? "text-yes" : "text-no"}>
                {bettingOpen ? "open" : "closed"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <BetPanel market={m} marketAddress={market.address} onConfirmed={refresh} />
        <ResolverPanel market={m} onConfirmed={refresh} />
      </div>
    </div>
  );
}
