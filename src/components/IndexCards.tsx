"use client";

import type { IndexAnalysis, Period } from "@/lib/analysis";

const PERIOD_LABELS: Record<Period, string> = {
  "1d": "전일비",
  "1w": "1주",
  "1m": "1개월",
  "3m": "3개월",
  ytd: "연초대비",
  "1y": "1년",
};

export default function IndexCards({
  indices,
  period = "1d",
}: {
  indices: IndexAnalysis[];
  period?: Period;
}) {
  if (indices.length === 0) return null;

  const rateColor = (v: number | null) => {
    if (v === null) return "text-muted";
    return v >= 0
      ? "text-red-600 dark:text-red-400"
      : "text-blue-600 dark:text-blue-400";
  };

  return (
    <div>
      <h2 className="text-base font-bold mb-3">주요 지수</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {indices.map((idx) => (
          <div
            key={idx.code}
            className="bg-card border border-card-border rounded-2xl p-3"
          >
            <div className="text-xs text-muted mb-1 font-medium">{idx.name}</div>
            <div className="text-lg font-extrabold font-mono tracking-tight">
              {idx.closePrice.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-bold ${rateColor(idx.changeRate)}`}>
                {idx.changeRate >= 0 ? "+" : ""}
                {idx.changeRate.toFixed(2)}%
              </span>
              {period !== "1d" && (
                <span className="text-[10px] text-muted font-medium">
                  {PERIOD_LABELS[period]}
                </span>
              )}
            </div>
            {period === "1d" && (
              <div className="flex gap-3 mt-1.5 text-[10px]">
                {idx.weekReturn !== null && (
                  <span className={`${rateColor(idx.weekReturn)} font-medium`}>
                    주 {idx.weekReturn >= 0 ? "+" : ""}
                    {idx.weekReturn.toFixed(1)}%
                  </span>
                )}
                {idx.monthReturn !== null && (
                  <span className={`${rateColor(idx.monthReturn)} font-medium`}>
                    월 {idx.monthReturn >= 0 ? "+" : ""}
                    {idx.monthReturn.toFixed(1)}%
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
