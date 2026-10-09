"use client";

export function OddsBar({ yesPct }: { yesPct: number }) {
  const clamped = Math.max(0, Math.min(1, yesPct));
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-edge">
        <div
          className="bg-yes transition-all duration-500"
          style={{ width: `${clamped * 100}%` }}
        />
        <div className="flex-1 bg-no" />
      </div>
      <div className="mt-1 flex justify-between font-mono text-xs">
        <span className="text-yes">{Math.round(clamped * 100)}% Yes</span>
        <span className="text-no">{Math.round((1 - clamped) * 100)}% No</span>
      </div>
    </div>
  );
}
