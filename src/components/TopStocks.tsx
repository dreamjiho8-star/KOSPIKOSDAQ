"use client";

import type { TopStock } from "@/lib/krx";

const rateColor = (v: number) =>
  v >= 0
    ? "text-red-600 dark:text-red-400"
    : "text-blue-600 dark:text-blue-400";

function formatMarketCap(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(1)}조`;
  return `${v.toLocaleString()}억`;
}

export default function TopStocks({ stocks }: { stocks: TopStock[] }) {
  const top = stocks.slice(0, 10);
  if (top.length === 0) return null;

  return (
    <div className="bg-card border border-card-border rounded-2xl p-4">
      <h2 className="text-base font-bold mb-3">시총 TOP 10</h2>
      <div className="space-y-1">
        {top.map((s, i) => (
          <div
            key={s.code}
            className="flex items-center justify-between py-1.5 px-1"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="text-xs text-muted font-mono w-5 text-right shrink-0">
                {i + 1}
              </span>
              <span className="text-sm font-medium truncate">{s.name}</span>
              <span className="text-[10px] text-muted shrink-0">
                {formatMarketCap(s.marketCap)}
              </span>
            </div>
            <span
              className={`text-sm font-bold font-mono shrink-0 ml-2 ${rateColor(
                s.changeRate
              )}`}
            >
              {s.changeRate >= 0 ? "+" : ""}
              {s.changeRate.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
