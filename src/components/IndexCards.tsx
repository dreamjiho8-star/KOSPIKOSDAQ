"use client";

import type { IndexAnalysis } from "@/lib/analysis";

export default function IndexCards({ indices }: { indices: IndexAnalysis[] }) {
  if (indices.length === 0) return null;

  const rateColor = (v: number | null) => {
    if (v === null) return "text-gray-400";
    return v >= 0 ? "text-red-600" : "text-blue-600";
  };

  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold mb-3">주요 지수</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {indices.map((idx) => (
          <div
            key={idx.code}
            className="bg-white rounded-xl border p-3"
          >
            <div className="text-xs text-gray-500 mb-1">{idx.name}</div>
            <div className="text-lg font-bold font-mono">
              {idx.closePrice.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className={`text-sm font-bold ${rateColor(idx.changeRate)}`}>
              {idx.changeRate >= 0 ? "+" : ""}
              {idx.changeRate.toFixed(2)}%
            </div>
            <div className="flex gap-3 mt-1 text-[10px]">
              {idx.weekReturn !== null && (
                <span className={rateColor(idx.weekReturn)}>
                  주 {idx.weekReturn >= 0 ? "+" : ""}
                  {idx.weekReturn.toFixed(1)}%
                </span>
              )}
              {idx.monthReturn !== null && (
                <span className={rateColor(idx.monthReturn)}>
                  월 {idx.monthReturn >= 0 ? "+" : ""}
                  {idx.monthReturn.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
