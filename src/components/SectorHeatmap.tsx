"use client";

import type { SectorAnalysis } from "@/lib/analysis";

function heatBg(rate: number): string {
  if (rate >= 4) return "#991b1b";
  if (rate >= 3) return "#b91c1c";
  if (rate >= 2) return "#dc2626";
  if (rate >= 1) return "#ef4444";
  if (rate >= 0.3) return "#f87171";
  if (rate > 0) return "#fca5a5";
  if (rate === 0) return "#6b7280";
  if (rate > -0.3) return "#93c5fd";
  if (rate > -1) return "#60a5fa";
  if (rate > -2) return "#3b82f6";
  if (rate > -3) return "#2563eb";
  if (rate > -4) return "#1d4ed8";
  return "#1e3a8a";
}

export default function SectorHeatmap({
  sectors,
  onSectorClick,
}: {
  sectors: SectorAnalysis[];
  onSectorClick?: (code: string, name: string) => void;
}) {
  if (sectors.length === 0) return null;

  return (
    <div className="bg-card border border-card-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold">섹터 히트맵</h2>
        <span className="text-[10px] text-muted">등락률 색상</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[...sectors]
          .sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate))
          .map((s) => (
            <button
              key={s.code}
              onClick={() => onSectorClick?.(s.code, s.name)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium hover:opacity-80 active:scale-95 transition"
              style={{ backgroundColor: heatBg(s.changeRate), color: "white" }}
            >
              <span className="block truncate max-w-[80px]">
                {s.name.length > 6 ? s.name.slice(0, 6) + ".." : s.name}
              </span>
              <span className="block text-[10px] font-bold opacity-90">
                {s.changeRate >= 0 ? "+" : ""}{s.changeRate.toFixed(1)}%
              </span>
            </button>
          ))}
      </div>

      <div className="flex items-center justify-center gap-1 mt-3">
        <span className="text-[10px] text-muted">-3%</span>
        <div className="flex gap-0.5">
          {["#1d4ed8", "#3b82f6", "#60a5fa", "#6b7280", "#fca5a5", "#ef4444", "#b91c1c"].map(
            (c, i) => (
              <div key={i} className="w-5 h-2 rounded-sm" style={{ backgroundColor: c }} />
            )
          )}
        </div>
        <span className="text-[10px] text-muted">+3%</span>
      </div>
    </div>
  );
}
