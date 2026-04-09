"use client";

import { useState, useRef, useLayoutEffect, useMemo } from "react";
import type { TopStock } from "@/lib/krx";

interface Rect { x: number; y: number; w: number; h: number }
interface TreeItem { stock: TopStock; weight: number; rect: Rect }

function squarify(
  items: { stock: TopStock; weight: number }[],
  x: number, y: number, w: number, h: number,
): TreeItem[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ ...items[0], rect: { x, y, w, h } }];

  const total = items.reduce((s, i) => s + i.weight, 0);
  const sorted = [...items].sort((a, b) => b.weight - a.weight);
  const result: TreeItem[] = [];

  let cx = x, cy = y, cw = w, ch = h;
  let remaining = [...sorted];
  let remTotal = total;

  while (remaining.length > 0) {
    const isHoriz = cw >= ch;
    const side = isHoriz ? ch : cw;
    let row: typeof remaining = [];
    let rowTotal = 0;
    let bestRatio = Infinity;

    for (const item of remaining) {
      const testRow = [...row, item];
      const testTotal = rowTotal + item.weight;
      const stripLen = (testTotal / remTotal) * (isHoriz ? cw : ch);
      let worstRatio = 0;
      for (const r of testRow) {
        const cellLen = (r.weight / testTotal) * side;
        const ratio = Math.max(stripLen / cellLen, cellLen / stripLen);
        worstRatio = Math.max(worstRatio, ratio);
      }
      if (worstRatio <= bestRatio) {
        bestRatio = worstRatio;
        row = testRow;
        rowTotal = testTotal;
      } else break;
    }

    const stripFrac = rowTotal / remTotal;
    const stripLen = stripFrac * (isHoriz ? cw : ch);
    let offset = 0;
    for (const item of row) {
      const cellFrac = item.weight / rowTotal;
      const cellLen = cellFrac * side;
      result.push({
        ...item,
        rect: isHoriz
          ? { x: cx, y: cy + offset, w: stripLen, h: cellLen }
          : { x: cx + offset, y: cy, w: cellLen, h: stripLen },
      });
      offset += cellLen;
    }

    if (isHoriz) { cx += stripLen; cw -= stripLen; }
    else { cy += stripLen; ch -= stripLen; }

    remaining = remaining.slice(row.length);
    remTotal -= rowTotal;
  }
  return result;
}

function rateToColor(rate: number): string {
  if (rate >= 6) return "#450a0a";
  if (rate >= 5) return "#7f1d1d";
  if (rate >= 4) return "#991b1b";
  if (rate >= 3) return "#b91c1c";
  if (rate >= 2) return "#dc2626";
  if (rate >= 1) return "#ef4444";
  if (rate >= 0.3) return "#f87171";
  if (rate > 0) return "#fca5a5";
  if (rate === 0) return "#4b5563";
  if (rate > -0.3) return "#93c5fd";
  if (rate > -1) return "#60a5fa";
  if (rate > -2) return "#3b82f6";
  if (rate > -3) return "#2563eb";
  if (rate > -4) return "#1d4ed8";
  if (rate > -5) return "#1e3a8a";
  if (rate > -6) return "#172554";
  return "#0c1a3d";
}

function formatMcap(v: number) {
  return v >= 10000 ? `${(v / 10000).toFixed(1)}조` : `${v.toLocaleString()}억`;
}

type ViewMode = "all" | "sector";

export default function MarketTreemap({ stocks }: { stocks: TopStock[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [mode, setMode] = useState<ViewMode>("all");
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      setSize({ w: width, h: Math.max(300, width * 0.55) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 섹터별 그룹
  const sectorGroups = useMemo(() => {
    const map = new Map<string, TopStock[]>();
    for (const s of stocks) {
      const key = s.sectorName || "기타";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries())
      .map(([name, list]) => ({
        name,
        stocks: list,
        totalMcap: list.reduce((sum, s) => sum + s.marketCap, 0),
        avgRate: list.length > 0
          ? list.reduce((sum, s) => sum + s.changeRate * s.marketCap, 0) /
            list.reduce((sum, s) => sum + s.marketCap, 0)
          : 0,
      }))
      .sort((a, b) => b.totalMcap - a.totalMcap);
  }, [stocks]);

  // 현재 표시할 종목
  const displayStocks = useMemo(() => {
    if (mode === "sector" && selectedSector) {
      return stocks.filter((s) => (s.sectorName || "기타") === selectedSector);
    }
    return stocks.slice(0, 80); // 전체 모드에서는 시총 상위 80개
  }, [stocks, mode, selectedSector]);

  const items = displayStocks.map((s) => ({
    stock: s,
    weight: Math.max(s.marketCap, 1),
  }));

  const cells = size.w > 0 ? squarify(items, 0, 0, size.w, size.h) : [];

  const showTooltip = (stock: TopStock, e: React.MouseEvent) => {
    const tip = tooltipRef.current;
    const container = containerRef.current;
    if (!tip || !container) return;
    const cr = container.getBoundingClientRect();
    const cx = e.clientX - cr.left;
    const cy = e.clientY - cr.top;
    tip.innerHTML = `<div class="font-bold">${stock.name}</div><div class="font-mono">${stock.changeRate >= 0 ? "+" : ""}${stock.changeRate.toFixed(2)}%</div><div class="text-[10px] opacity-80">시총 ${formatMcap(stock.marketCap)}</div>${stock.sectorName ? `<div class="text-[10px] opacity-60">${stock.sectorName}</div>` : ""}`;
    tip.style.opacity = "1";
    const tipW = 150;
    let left = cx - tipW / 2;
    if (left < 0) left = 0;
    if (left + tipW > size.w) left = size.w - tipW;
    let top = cy - 70;
    if (top < 0) top = cy + 20;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };

  const hideTooltip = () => {
    const tip = tooltipRef.current;
    if (tip) tip.style.opacity = "0";
  };

  return (
    <div className="bg-card border border-card-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold">
          {mode === "sector" && selectedSector
            ? `${selectedSector} (${displayStocks.length}개)`
            : `전체 시장 트리맵 (${displayStocks.length}개)`}
        </h2>
        <div className="flex gap-1">
          {mode === "sector" && selectedSector && (
            <button
              onClick={() => { setSelectedSector(null); setMode("all"); }}
              className="text-[10px] px-2 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-700/80 text-muted hover:text-foreground transition"
            >
              전체보기
            </button>
          )}
        </div>
      </div>

      {/* 섹터 필터 칩 */}
      {mode === "all" && (
        <div className="flex flex-wrap gap-1 mb-3">
          {sectorGroups.slice(0, 15).map((g) => (
            <button
              key={g.name}
              onClick={() => { setMode("sector"); setSelectedSector(g.name); }}
              className="text-[10px] px-2 py-1 rounded-full border border-card-border hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1"
            >
              <span>{g.name}</span>
              <span className={`font-mono font-bold ${g.avgRate >= 0 ? "text-red-500" : "text-blue-500"}`}>
                {g.avgRate >= 0 ? "+" : ""}{g.avgRate.toFixed(1)}%
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 트리맵 */}
      <div ref={containerRef} className="w-full">
        {size.w > 0 && (
          <div
            className="relative"
            style={{ width: size.w, height: size.h }}
            onMouseLeave={hideTooltip}
          >
            {cells.map(({ stock, rect }) => {
              const showName = rect.w >= 40 && rect.h >= 24;
              const showRate = rect.w >= 35 && rect.h >= 38;
              const showMcap = rect.w >= 40 && rect.h >= 52;
              const tc = Math.abs(stock.changeRate) < 0.3
                ? (stock.changeRate >= 0 ? "#7f1d1d" : "#1e3a8a")
                : "#ffffff";
              return (
                <div
                  key={stock.code}
                  className="absolute flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:brightness-110 transition-all"
                  style={{
                    left: rect.x + 1,
                    top: rect.y + 1,
                    width: Math.max(0, rect.w - 2),
                    height: Math.max(0, rect.h - 2),
                    backgroundColor: rateToColor(stock.changeRate),
                    color: tc,
                    borderRadius: 6,
                  }}
                  onMouseEnter={(e) => showTooltip(stock, e)}
                  onMouseMove={(e) => showTooltip(stock, e)}
                >
                  {showName && (
                    <span className="font-bold text-xs leading-tight text-center px-1 truncate max-w-full">
                      {stock.name}
                    </span>
                  )}
                  {showRate && (
                    <span className="text-[11px] font-mono font-bold mt-0.5">
                      {stock.changeRate >= 0 ? "+" : ""}
                      {stock.changeRate.toFixed(2)}%
                    </span>
                  )}
                  {showMcap && (
                    <span className="text-[9px] opacity-70 mt-0.5">
                      {formatMcap(stock.marketCap)}
                    </span>
                  )}
                </div>
              );
            })}
            <div
              ref={tooltipRef}
              className="absolute pointer-events-none bg-slate-900 text-white text-xs rounded-lg px-3 py-2 text-center shadow-lg transition-opacity duration-150 z-10"
              style={{ opacity: 0, width: 150 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
