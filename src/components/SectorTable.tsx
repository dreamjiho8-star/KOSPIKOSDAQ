"use client";

import { useState, useMemo } from "react";
import type { SectorAnalysis } from "@/lib/analysis";
import { CATEGORIES, getCategory } from "@/lib/categories";

type ViewMode = "rate" | "name" | "category";

const statusBadge: Record<string, string> = {
  normal: "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
  crash: "bg-red-600 text-white",
  contrarian_drop: "bg-orange-500 text-white",
  underperform: "bg-yellow-500 text-white",
  surge: "bg-green-600 text-white",
  contrarian_rise: "bg-emerald-500 text-white",
  outperform: "bg-teal-500 text-white",
};

const rateColor = (v: number) =>
  v >= 0
    ? "text-red-600 dark:text-red-400"
    : "text-blue-600 dark:text-blue-400";

function SectorRow({
  s,
  onSectorClick,
}: {
  s: SectorAnalysis;
  onSectorClick?: (code: string, name: string) => void;
}) {
  return (
    <div
      onClick={() => onSectorClick?.(s.code, s.name)}
      className={`bg-card border border-card-border rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.99] transition ${
        s.status !== "normal" ? "border-l-4" : ""
      } ${
        s.status === "crash"
          ? "border-l-red-500"
          : s.status === "contrarian_drop"
          ? "border-l-orange-500"
          : s.status === "underperform"
          ? "border-l-yellow-500"
          : s.status === "surge"
          ? "border-l-green-500"
          : s.status === "contrarian_rise"
          ? "border-l-emerald-500"
          : s.status === "outperform"
          ? "border-l-teal-400"
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
  );
}

export default function SectorTable({
  sectors,
  onSectorClick,
}: {
  sectors: SectorAnalysis[];
  onSectorClick?: (code: string, name: string) => void;
}) {
  const [mode, setMode] = useState<ViewMode>("category");
  const [asc, setAsc] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const handleMode = (m: ViewMode) => {
    if (mode === m && m !== "category") setAsc(!asc);
    else {
      setMode(m);
      setAsc(m === "name");
    }
  };

  const toggleCollapse = (cat: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Flat sorted list for rate/name modes
  const sorted = useMemo(() => {
    if (mode === "category") return sectors;
    return [...sectors].sort((a, b) => {
      if (mode === "name")
        return asc
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      return asc ? a.changeRate - b.changeRate : b.changeRate - a.changeRate;
    });
  }, [sectors, mode, asc]);

  // Category groups
  const categoryGroups = useMemo(() => {
    const map = new Map<string, SectorAnalysis[]>();
    for (const s of sectors) {
      const cat = getCategory(s.name);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    // Sort sectors within each group by changeRate
    for (const [, secs] of map) {
      secs.sort((a, b) => a.changeRate - b.changeRate);
    }
    // Return in defined category order
    return CATEGORIES.filter((c) => map.has(c)).map((cat) => {
      const secs = map.get(cat)!;
      const avg =
        secs.reduce((sum, s) => sum + s.changeRate, 0) / secs.length;
      return { category: cat, sectors: secs, avgRate: avg };
    });
  }, [sectors]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold">
          전체 업종{" "}
          <span className="text-muted font-normal text-sm">
            {sectors.length}개
          </span>
        </h2>
        <div className="flex gap-1.5">
          {(
            [
              ["등락률", "rate"],
              ["이름", "name"],
              ["카테고리", "category"],
            ] as [string, ViewMode][]
          ).map(([label, key]) => (
            <button
              key={key}
              onClick={() => handleMode(key)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                mode === key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-card text-muted border-card-border hover:border-slate-400"
              }`}
            >
              {label}{" "}
              {mode === key && key !== "category" ? (asc ? "↑" : "↓") : ""}
            </button>
          ))}
        </div>
      </div>

      {mode === "category" ? (
        <div className="space-y-3">
          {categoryGroups.map(({ category, sectors: secs, avgRate }) => {
            const isCollapsed = collapsed.has(category);
            return (
              <div key={category}>
                <button
                  onClick={() => toggleCollapse(category)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted w-4">
                      {isCollapsed ? "▸" : "▾"}
                    </span>
                    <span className="font-bold text-sm">{category}</span>
                    <span className="text-xs text-muted">{secs.length}개</span>
                  </div>
                  <span
                    className={`text-sm font-bold font-mono ${rateColor(
                      avgRate
                    )}`}
                  >
                    평균 {avgRate >= 0 ? "+" : ""}
                    {avgRate.toFixed(2)}%
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="space-y-1.5 mt-1.5 ml-2">
                    {secs.map((s) => (
                      <SectorRow
                        key={s.code}
                        s={s}
                        onSectorClick={onSectorClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((s) => (
            <SectorRow key={s.code} s={s} onSectorClick={onSectorClick} />
          ))}
        </div>
      )}
    </div>
  );
}
