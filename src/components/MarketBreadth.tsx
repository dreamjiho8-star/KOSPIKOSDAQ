"use client";

import type { SectorAnalysis } from "@/lib/analysis";

export default function MarketBreadth({
  sectors,
}: {
  sectors: SectorAnalysis[];
}) {
  const total = sectors.length;
  const up = sectors.filter((s) => s.changeRate > 0).length;
  const down = sectors.filter((s) => s.changeRate < 0).length;
  const flat = total - up - down;

  const upPct = total > 0 ? (up / total) * 100 : 0;
  const flatPct = total > 0 ? (flat / total) * 100 : 0;
  const downPct = total > 0 ? (down / total) * 100 : 0;

  // 시장 심리 점수: 0(극도 공포) ~ 100(극도 탐욕)
  const sentimentScore = total > 0 ? Math.round((up / total) * 100) : 50;
  const sentimentLabel =
    sentimentScore >= 75
      ? "극도 탐욕"
      : sentimentScore >= 60
      ? "탐욕"
      : sentimentScore >= 40
      ? "중립"
      : sentimentScore >= 25
      ? "공포"
      : "극도 공포";
  const sentimentColor =
    sentimentScore >= 75
      ? "text-red-500"
      : sentimentScore >= 60
      ? "text-orange-500"
      : sentimentScore >= 40
      ? "text-slate-500 dark:text-slate-400"
      : sentimentScore >= 25
      ? "text-blue-500"
      : "text-blue-700 dark:text-blue-400";

  const rates = sectors.map((s) => s.changeRate);
  const maxUp = Math.max(...rates);
  const maxDown = Math.min(...rates);

  return (
    <div className="bg-card border border-card-border rounded-2xl p-4">
      <h2 className="text-base font-bold mb-3">시장 심리</h2>

      {/* 심리 게이지 */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <div className="flex justify-between text-[10px] text-muted mb-1">
            <span>공포</span>
            <span>탐욕</span>
          </div>
          <div className="h-3 bg-gradient-to-r from-blue-500 via-slate-300 dark:via-slate-600 to-red-500 rounded-full relative">
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-slate-800 border-2 border-slate-800 dark:border-white rounded-full shadow-md transition-all"
              style={{ left: `calc(${sentimentScore}% - 8px)` }}
            />
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-2xl font-extrabold ${sentimentColor}`}>
            {sentimentScore}
          </div>
          <div className={`text-xs font-bold ${sentimentColor}`}>
            {sentimentLabel}
          </div>
        </div>
      </div>

      {/* 상승/보합/하락 비율 바 */}
      <div className="h-6 flex rounded-lg overflow-hidden mb-2">
        {upPct > 0 && (
          <div
            className="bg-red-500 dark:bg-red-400 flex items-center justify-center text-white text-[10px] font-bold transition-all"
            style={{ width: `${upPct}%` }}
          >
            {upPct >= 10 ? `${up}` : ""}
          </div>
        )}
        {flatPct > 0 && (
          <div
            className="bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 text-[10px] font-bold transition-all"
            style={{ width: `${flatPct}%` }}
          >
            {flatPct >= 10 ? `${flat}` : ""}
          </div>
        )}
        {downPct > 0 && (
          <div
            className="bg-blue-500 dark:bg-blue-400 flex items-center justify-center text-white text-[10px] font-bold transition-all"
            style={{ width: `${downPct}%` }}
          >
            {downPct >= 10 ? `${down}` : ""}
          </div>
        )}
      </div>

      <div className="flex justify-between text-[10px] text-muted">
        <span>
          상승 {up}개 ({upPct.toFixed(0)}%)
        </span>
        <span>
          하락 {down}개 ({downPct.toFixed(0)}%)
        </span>
      </div>

      {/* 최대 상승/하락 */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-2.5">
          <div className="text-[10px] text-muted mb-0.5">최대 상승 업종</div>
          <div className="text-sm font-bold text-red-600 dark:text-red-400">
            {maxUp >= 0 ? "+" : ""}{maxUp.toFixed(2)}%
          </div>
          <div className="text-xs text-muted truncate">
            {sectors.find((s) => s.changeRate === maxUp)?.name}
          </div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-2.5">
          <div className="text-[10px] text-muted mb-0.5">최대 하락 업종</div>
          <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
            {maxDown.toFixed(2)}%
          </div>
          <div className="text-xs text-muted truncate">
            {sectors.find((s) => s.changeRate === maxDown)?.name}
          </div>
        </div>
      </div>
    </div>
  );
}
