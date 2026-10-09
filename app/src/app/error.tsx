"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg space-y-3 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="break-words text-sm text-gray-400">{error.message}</p>
      <div className="flex justify-center gap-3">
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/" className="btn-ghost">
          Back to markets
        </Link>
      </div>
    </div>
  );
}
