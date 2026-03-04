"use client";

import { useState } from "react";
import type { SectorAnalysis } from "@/lib/analysis";

type SortKey = "changeRate" | "name";

const statusBadge: Record<string, string> = {
  normal: "bg-gray-100 text-gray-600",
  crash: "bg-red-600 text-white",
  contrarian_drop: "bg-orange-500 text-white",
  underperform: "bg-yellow-500 text-white",
};

export default function SectorTable({
  sectors,
}: {
  sectors: SectorAnalysis[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("changeRate");
  const [asc, setAsc] = useState(true);

  const sorted = [...sectors].sort((a, b) => {
    if (sortKey === "name") {
      return asc
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }
    return asc ? a.changeRate - b.changeRate : b.changeRate - a.changeRate;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setAsc(!asc);
    else {
      setSortKey(key);
      setAsc(key === "name");
    }
  };

  const rateColor = (v: number) =>
    v >= 0 ? "text-red-600" : "text-blue-600";

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">업종별 등락률 ({sectors.length}개)</h2>
        <div className="flex gap-2">
          {(
            [
              ["등락률", "changeRate"],
              ["이름", "name"],
            ] as [string, SortKey][]
          ).map(([label, key]) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className={`text-xs px-3 py-1 rounded-full border ${
                sortKey === key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300"
              }`}
            >
              {label} {sortKey === key ? (asc ? "↑" : "↓") : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        {sorted.map((s) => (
          <div
            key={s.code}
            className={`bg-white rounded-lg border p-3 flex items-center justify-between ${
              s.status !== "normal" ? "border-l-4" : ""
            } ${
              s.status === "crash"
                ? "border-l-red-500"
                : s.status === "contrarian_drop"
                ? "border-l-orange-500"
                : s.status === "underperform"
                ? "border-l-yellow-500"
                : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-sm truncate">{s.name}</span>
                {s.status !== "normal" && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                      statusBadge[s.status]
                    }`}
                  >
                    {s.statusLabel}
                  </span>
                )}
              </div>
            </div>
            <span
              className={`text-base font-bold font-mono shrink-0 ml-3 ${rateColor(
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
