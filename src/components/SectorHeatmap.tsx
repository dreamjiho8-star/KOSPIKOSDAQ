"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import type { SectorAnalysis } from "@/lib/analysis";
import type { TreemapStock } from "@/lib/krx";

// 등락률 → 배경색 (CSS 직접 지정)
function heatBg(rate: number): string {
  if (rate >= 4) return "#991b1b";   // red-800
  if (rate >= 3) return "#b91c1c";   // red-700
  if (rate >= 2) return "#dc2626";   // red-600
  if (rate >= 1) return "#ef4444";   // red-500
  if (rate >= 0.3) return "#f87171"; // red-400
  if (rate > 0) return "#fca5a5";    // red-300
  if (rate === 0) return "#6b7280";  // gray-500
  if (rate > -0.3) return "#93c5fd"; // blue-300
  if (rate > -1) return "#60a5fa";   // blue-400
  if (rate > -2) return "#3b82f6";   // blue-500
  if (rate > -3) return "#2563eb";   // blue-600
  if (rate > -4) return "#1d4ed8";   // blue-700
  return "#1e3a8a";                   // blue-900
}

// Squarified treemap layout
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TreemapItem {
  id: string;
  label: string;
  subLabel: string;
  value: number; // area (시총)
  rate: number;  // 색상용
  sectorCode?: string;
  sectorName?: string;
}

function squarify(items: TreemapItem[], rect: Rect): (TreemapItem & Rect)[] {
  if (items.length === 0) return [];

  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return [];

  const result: (TreemapItem & Rect)[] = [];
  let remaining = [...items];
  let currentRect = { ...rect };

  while (remaining.length > 0) {
    const isWide = currentRect.w >= currentRect.h;
    const side = isWide ? currentRect.h : currentRect.w;
    const remainingTotal = remaining.reduce((s, i) => s + i.value, 0);

    // Find optimal row
    let row: TreemapItem[] = [];
    let bestRatio = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = [...row, remaining[i]];
      const rowTotal = candidate.reduce((s, it) => s + it.value, 0);
      const rowWidth = (rowTotal / remainingTotal) * (isWide ? currentRect.w : currentRect.h);

      // Calculate worst aspect ratio in this row
      let worstRatio = 0;
      for (const it of candidate) {
        const itemHeight = (it.value / rowTotal) * side;
        const ratio = Math.max(rowWidth / itemHeight, itemHeight / rowWidth);
        worstRatio = Math.max(worstRatio, ratio);
      }

      if (worstRatio <= bestRatio) {
        bestRatio = worstRatio;
        row = candidate;
      } else {
        break;
      }
    }

    // Layout the row
    const rowTotal = row.reduce((s, i) => s + i.value, 0);
    const rowWidth = (rowTotal / remainingTotal) * (isWide ? currentRect.w : currentRect.h);

    let offset = 0;
    for (const item of row) {
      const itemSize = (item.value / rowTotal) * side;

      if (isWide) {
        result.push({
          ...item,
          x: currentRect.x,
          y: currentRect.y + offset,
          w: rowWidth,
          h: itemSize,
        });
      } else {
        result.push({
          ...item,
          x: currentRect.x + offset,
          y: currentRect.y,
          w: itemSize,
          h: rowWidth,
        });
      }
      offset += itemSize;
    }

    // Update remaining rect
    if (isWide) {
      currentRect = {
        x: currentRect.x + rowWidth,
        y: currentRect.y,
        w: currentRect.w - rowWidth,
        h: currentRect.h,
      };
    } else {
      currentRect = {
        x: currentRect.x,
        y: currentRect.y + rowWidth,
        w: currentRect.w,
        h: currentRect.h - rowWidth,
      };
    }

    remaining = remaining.slice(row.length);
  }

  return result;
}

// 섹터별 트리맵 (섹터 안에 종목이 보이는 2-level 트리맵)
function StockTreemap({
  stocks,
  width,
  height,
  onSectorClick,
}: {
  stocks: TreemapStock[];
  width: number;
  height: number;
  onSectorClick?: (code: string, name: string) => void;
}) {
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; name: string; rate: number; mcap: number; sector: string;
  } | null>(null);
  // 섹터별 그룹핑
  const sectorGroups = useMemo(() => {
    const map = new Map<string, { name: string; stocks: TreemapStock[]; totalMcap: number }>();
    for (const s of stocks) {
      const existing = map.get(s.sectorCode) || { name: s.sectorName, stocks: [], totalMcap: 0 };
      existing.stocks.push(s);
      existing.totalMcap += s.marketCap;
      map.set(s.sectorCode, existing);
    }
    return [...map.entries()]
      .map(([code, g]) => ({ code, ...g }))
      .sort((a, b) => b.totalMcap - a.totalMcap);
  }, [stocks]);

  // 1st level: 섹터 사각형
  const sectorItems: TreemapItem[] = sectorGroups.map((g) => ({
    id: g.code,
    label: g.name,
    subLabel: "",
    value: g.totalMcap,
    rate: 0, // 섹터 경계용
    sectorCode: g.code,
    sectorName: g.name,
  }));

  const sectorRects = squarify(sectorItems, { x: 0, y: 0, w: width, h: height });

  // 2nd level: 섹터 안의 종목 사각형
  const allCells: { stock: TreemapStock; x: number; y: number; w: number; h: number; sectorName: string }[] = [];

  for (const sRect of sectorRects) {
    const group = sectorGroups.find((g) => g.code === sRect.id);
    if (!group) continue;

    const stockItems: TreemapItem[] = group.stocks
      .sort((a, b) => b.marketCap - a.marketCap)
      .map((s) => ({
        id: s.code,
        label: s.name,
        subLabel: `${s.changeRate >= 0 ? "+" : ""}${s.changeRate.toFixed(2)}%`,
        value: s.marketCap,
        rate: s.changeRate,
      }));

    // Inner padding
    const pad = 1;
    const headerH = 14;
    const innerRect = {
      x: sRect.x + pad,
      y: sRect.y + headerH + pad,
      w: Math.max(sRect.w - pad * 2, 1),
      h: Math.max(sRect.h - headerH - pad * 2, 1),
    };

    const stockRects = squarify(stockItems, innerRect);
    for (const sr of stockRects) {
      const stock = group.stocks.find((s) => s.code === sr.id);
      if (stock) {
        allCells.push({ stock, x: sr.x, y: sr.y, w: sr.w, h: sr.h, sectorName: group.name });
      }
    }
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{ width, height, background: "#1a1a2e" }}
    >
      {/* 섹터 경계선 + 라벨 */}
      {sectorRects.map((sr) => (
        <div
          key={sr.id}
          className="absolute border border-slate-800/60"
          style={{ left: sr.x, top: sr.y, width: sr.w, height: sr.h }}
        >
          <div
            className="absolute top-0 left-0 px-1 text-[9px] font-bold text-white/70 truncate z-10"
            style={{ maxWidth: sr.w }}
          >
            {sr.w > 40 ? sr.label : ""}
          </div>
        </div>
      ))}

      {/* 종목 셀 */}
      {allCells.map(({ stock, x, y, w, h, sectorName }) => {
        const showName = w > 35 && h > 20;
        const showRate = w > 25 && h > 14;
        const fontSize = Math.min(12, Math.max(8, Math.min(w / 5, h / 3)));

        return (
          <div
            key={stock.code}
            className="absolute flex flex-col items-center justify-center cursor-pointer hover:brightness-125 hover:z-20 transition-all"
            style={{
              left: x + 0.5,
              top: y + 0.5,
              width: Math.max(w - 1, 1),
              height: Math.max(h - 1, 1),
              backgroundColor: heatBg(stock.changeRate),
              borderRadius: 2,
            }}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.parentElement?.getBoundingClientRect();
              if (!rect) return;
              const cx = e.currentTarget.getBoundingClientRect();
              setTooltip({
                x: cx.left - rect.left + cx.width / 2,
                y: cx.top - rect.top - 4,
                name: stock.name,
                rate: stock.changeRate,
                mcap: stock.marketCap,
                sector: sectorName,
              });
            }}
            onMouseLeave={() => setTooltip(null)}
            onClick={() => onSectorClick?.(stock.sectorCode, sectorName)}
          >
            {showName && (
              <span
                className="text-white font-bold truncate leading-tight"
                style={{ fontSize: Math.max(fontSize, 8), maxWidth: w - 4 }}
              >
                {stock.name.length > Math.floor(w / 8)
                  ? stock.name.slice(0, Math.floor(w / 8))
                  : stock.name}
              </span>
            )}
            {showRate && (
              <span
                className="text-white/90 font-bold leading-tight"
                style={{ fontSize: Math.max(fontSize - 2, 7) }}
              >
                {stock.changeRate >= 0 ? "+" : ""}
                {stock.changeRate.toFixed(1)}%
              </span>
            )}
          </div>
        );
      })}

      {/* 호버 툴팁 */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-50 bg-slate-900/95 text-white rounded-lg px-3 py-2 text-xs shadow-xl -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-bold text-sm">{tooltip.name}</div>
          <div className="text-muted text-[10px]">{tooltip.sector}</div>
          <div className={`font-bold ${tooltip.rate >= 0 ? "text-red-400" : "text-blue-400"}`}>
            {tooltip.rate >= 0 ? "+" : ""}{tooltip.rate.toFixed(2)}%
          </div>
          <div className="text-slate-400 text-[10px]">
            시총 {tooltip.mcap.toLocaleString()}억
          </div>
        </div>
      )}
    </div>
  );
}

// 간단한 섹터 히트맵 (종목 데이터 없을 때 폴백)
function SimpleSectorMap({
  sectors,
  onSectorClick,
}: {
  sectors: SectorAnalysis[];
  onSectorClick?: (code: string, name: string) => void;
}) {
  const sorted = [...sectors].sort(
    (a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate)
  );

  return (
    <div className="flex flex-wrap gap-1.5">
      {sorted.map((s) => (
        <button
          key={s.code}
          onClick={() => onSectorClick?.(s.code, s.name)}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium transition hover:opacity-80 active:scale-95"
          style={{ backgroundColor: heatBg(s.changeRate), color: "white" }}
          title={`${s.name}: ${s.changeRate >= 0 ? "+" : ""}${s.changeRate.toFixed(2)}%`}
        >
          <span className="block truncate max-w-[80px]">
            {s.name.length > 6 ? s.name.slice(0, 6) + ".." : s.name}
          </span>
          <span className="block text-[10px] font-bold opacity-90">
            {s.changeRate >= 0 ? "+" : ""}
            {s.changeRate.toFixed(1)}%
          </span>
        </button>
      ))}
    </div>
  );
}

export default function SectorHeatmap({
  sectors,
  onSectorClick,
}: {
  sectors: SectorAnalysis[];
  onSectorClick?: (code: string, name: string) => void;
}) {
  const [treemapStocks, setTreemapStocks] = useState<TreemapStock[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [containerWidth, setContainerWidth] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/investors")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.treemapStocks) {
          setTreemapStocks(json.data.treemapStocks);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(Math.floor(w));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (sectors.length === 0) return null;

  const treemapHeight = Math.max(300, Math.round(containerWidth * 0.65));

  return (
    <div ref={containerRef} className="bg-card border border-card-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold">시장 히트맵</h2>
        <span className="text-[10px] text-muted">시총 비례 크기 · 등락률 색상</span>
      </div>

      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : treemapStocks && treemapStocks.length > 0 ? (
        <StockTreemap stocks={treemapStocks} width={containerWidth - 32} height={treemapHeight} onSectorClick={onSectorClick} />
      ) : (
        <SimpleSectorMap sectors={sectors} onSectorClick={onSectorClick} />
      )}

      {/* 범례 */}
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
