"use client";

import { useMemo, useState } from "react";
import { MOCK_LEADERBOARD, LeaderRow } from "@/lib/mock";
import { shortKey } from "@/lib/helpers";

type SortKey = "profit" | "wins" | "volume";

export default function LeaderboardPage() {
  const [sort, setSort] = useState<SortKey>("profit");
  const [desc, setDesc] = useState(true);

  const rows = useMemo(() => {
    const copy = [...MOCK_LEADERBOARD];
    copy.sort((a, b) => (desc ? b[sort] - a[sort] : a[sort] - b[sort]));
    return copy;
  }, [sort, desc]);

  function header(key: SortKey, label: string) {
    return (
      <button
        onClick={() => {
          if (sort === key) setDesc(!desc);
          else {
            setSort(key);
            setDesc(true);
          }
        }}
        className={`text-left hover:text-white ${sort === key ? "text-white" : ""}`}
      >
        {label}
        {sort === key ? (desc ? " ↓" : " ↑") : ""}
      </button>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">Leaderboard</h1>
      <p className="mb-6 text-sm text-gray-400">
        Top traders by profit. Live data arrives with the indexer (Phase 5) — currently seeded
        demo rows.
      </p>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-xs text-gray-400">
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Wallet</th>
              <th className="px-4 py-3 text-left">{header("profit", "Profit")}</th>
              <th className="px-4 py-3 text-left">{header("wins", "Wins")}</th>
              <th className="px-4 py-3 text-left">Win rate</th>
              <th className="px-4 py-3 text-left">{header("volume", "Volume")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: LeaderRow, i: number) => (
              <tr key={r.wallet} className="border-b border-edge/50 last:border-0">
                <td className="px-4 py-3 font-mono text-gray-500">{i + 1}</td>
                <td className="px-4 py-3 font-mono">{shortKey(r.wallet)}</td>
                <td
                  className={`px-4 py-3 font-mono ${r.profit >= 0 ? "text-yes" : "text-no"}`}
                >
                  {r.profit >= 0 ? "+" : ""}
                  {r.profit.toFixed(2)}
                </td>
                <td className="px-4 py-3 font-mono">{r.wins}</td>
                <td className="px-4 py-3 font-mono">
                  {Math.round((r.wins / r.bets) * 100)}%
                </td>
                <td className="px-4 py-3 font-mono text-gray-400">{r.volume}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
