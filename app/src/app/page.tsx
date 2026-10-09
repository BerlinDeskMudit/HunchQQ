"use client";

import { useAllMarkets } from "@/lib/hooks";
import { MarketCard } from "@/components/MarketCard";

export default function HomePage() {
  const { markets, loading, error, refresh } = useAllMarkets();

  const open = markets.filter((m) => m.data.status === "open");
  const closed = markets.filter((m) => m.data.status !== "open");

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Prediction markets</h1>
            <p className="text-sm text-gray-400">
              Bet Yes/No on real-world events. Funds sit in program-owned vaults.
            </p>
          </div>
          <button onClick={refresh} className="btn-ghost text-xs">
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-no/40 bg-no/10 px-4 py-3 text-sm text-no">
            {error}
          </div>
        )}

        {loading && markets.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card h-36 animate-pulse bg-panel/60" />
            ))}
          </div>
        ) : markets.length === 0 ? (
          <div className="card text-center text-sm text-gray-400">
            No markets yet.{" "}
            <a href="/create" className="text-accent hover:underline">
              Create the first one →
            </a>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {open.map((m) => (
                <MarketCard key={m.address.toBase58()} market={m.data} />
              ))}
            </div>
            {closed.length > 0 && (
              <>
                <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Closed
                </h2>
                <div className="grid gap-4 opacity-70 sm:grid-cols-2 lg:grid-cols-3">
                  {closed.map((m) => (
                    <MarketCard key={m.address.toBase58()} market={m.data} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
