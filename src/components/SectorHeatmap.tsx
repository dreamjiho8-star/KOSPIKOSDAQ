"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import type { SectorAnalysis } from "@/lib/analysis";

// ─── Color helpers ───

function heatBg(rate: number): string {
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
  return "#1e3a8a";
}

function textColor(rate: number): string {
  if (Math.abs(rate) < 0.3) return rate >= 0 ? "#7f1d1d" : "#1e3a8a";
  return "#ffffff";
}

// ─── Squarified treemap layout ───

interface Rect {
  sector: SectorAnalysis;
  x: number;
  y: number;
  w: number;
  h: number;
}

function squarifiedLayout(
  sectors: SectorAnalysis[],
  width: number,
  height: number
): Rect[] {
  if (width <= 0 || height <= 0 || sectors.length === 0) return [];

  const items = [...sectors]
    .sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate))
    .map((s) => ({ sector: s, value: 1 + Math.abs(s.changeRate) }));

  const rects: Rect[] = [];
  let remaining = items;
  let x = 0,
    y = 0,
    w = width,
    h = height;
  let remTotal = remaining.reduce((s, i) => s + i.value, 0);

  while (remaining.length > 0) {
    if (remaining.length === 1) {
      rects.push({ sector: remaining[0].sector, x, y, w, h });
      break;
    }

    const isWide = w >= h;
    const shortSide = isWide ? h : w;

    // Find best row (minimize worst aspect ratio)
    let bestEnd = 0;
    let bestAspect = Infinity;
    let runSum = 0;

    for (let i = 0; i < remaining.length; i++) {
      runSum += remaining[i].value;
      const rowArea = (runSum / remTotal) * w * h;
      const rowLen = rowArea / shortSide;

      let worst = 0;
      for (let j = 0; j <= i; j++) {
        const itemLen = (remaining[j].value / runSum) * shortSide;
        const ar = Math.max(rowLen / itemLen, itemLen / rowLen);
        worst = Math.max(worst, ar);
      }

      if (worst <= bestAspect) {
        bestAspect = worst;
        bestEnd = i;
      } else {
        break;
      }
    }

    // Layout the row
    const row = remaining.slice(0, bestEnd + 1);
    const rowSum = row.reduce((s, i) => s + i.value, 0);
    const rowArea = (rowSum / remTotal) * w * h;
    const rowLen = rowArea / shortSide;

    if (isWide) {
      let cy = y;
      for (const item of row) {
        const itemH = (item.value / rowSum) * h;
        rects.push({ sector: item.sector, x, y: cy, w: rowLen, h: itemH });
        cy += itemH;
      }
      x += rowLen;
      w -= rowLen;
    } else {
      let cx = x;
      for (const item of row) {
        const itemW = (item.value / rowSum) * w;
        rects.push({ sector: item.sector, x: cx, y, w: itemW, h: rowLen });
        cx += itemW;
      }
      y += rowLen;
      h -= rowLen;
    }

    remaining = remaining.slice(bestEnd + 1);
    remTotal -= rowSum;
  }

  return rects;
}

// ─── Component ───

export default function SectorHeatmap({
  sectors,
  onSectorClick,
}: {
  sectors: SectorAnalysis[];
  onSectorClick?: (code: string, name: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const mapHeight = useMemo(
    () => Math.max(280, containerWidth * 0.55),
    [containerWidth]
  );

  const rects = useMemo(
    () => squarifiedLayout(sectors, containerWidth, mapHeight),
    [sectors, containerWidth, mapHeight]
  );

  // DOM-based tooltip for performance
  const showTooltip = useCallback(
    (e: React.MouseEvent, sector: SectorAnalysis) => {
      const tip = tooltipRef.current;
      if (!tip) return;
      const container = containerRef.current;
      if (!container) return;
      const cr = container.getBoundingClientRect();
      let tx = e.clientX - cr.left + 12;
      let ty = e.clientY - cr.top - 36;
      if (tx + 140 > cr.width) tx = tx - 160;
      if (ty < 0) ty = e.clientY - cr.top + 16;
      tip.style.left = `${tx}px`;
      tip.style.top = `${ty}px`;
      tip.style.opacity = "1";
      tip.innerHTML = `<strong>${sector.name}</strong><br/><span style="color:${
        sector.changeRate >= 0 ? "#ef4444" : "#3b82f6"
      };font-weight:700">${sector.changeRate >= 0 ? "+" : ""}${sector.changeRate.toFixed(
        2
      )}%</span>`;
    },
    []
  );

  const hideTooltip = useCallback(() => {
    const tip = tooltipRef.current;
    if (tip) tip.style.opacity = "0";
  }, []);

  if (sectors.length === 0) return null;

  const GAP = 1;

  return (
    <div className="bg-card border border-card-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold">섹터 히트맵</h2>
        <span className="text-[10px] text-muted">클릭하여 상세보기</span>
      </div>

      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-lg"
        style={{ height: `${mapHeight}px` }}
      >
        {rects.map((rect) => {
          const { sector, x, y, w, h } = rect;
          const bg = heatBg(sector.changeRate);
          const tc = textColor(sector.changeRate);
          const fontSize = Math.min(12, Math.max(7, Math.min(w / 7, h / 3)));
          const rateFontSize = Math.min(
            13,
            Math.max(8, Math.min(w / 6, h / 2.5))
          );
          const showName = w > 36 && h > 22;
          const showRate = w > 28 && h > 14;

          return (
            <button
              key={sector.code}
              onClick={() => onSectorClick?.(sector.code, sector.name)}
              onMouseMove={(e) => showTooltip(e, sector)}
              onMouseLeave={hideTooltip}
              className="absolute flex flex-col items-center justify-center overflow-hidden hover:brightness-110 active:brightness-90 transition-[filter]"
              style={{
                left: `${x + GAP / 2}px`,
                top: `${y + GAP / 2}px`,
                width: `${Math.max(0, w - GAP)}px`,
                height: `${Math.max(0, h - GAP)}px`,
                backgroundColor: bg,
                color: tc,
              }}
            >
              {showName && (
                <span
                  className="font-bold truncate leading-tight px-0.5"
                  style={{
                    fontSize: `${fontSize}px`,
                    maxWidth: `${w - 4}px`,
                  }}
                >
                  {sector.name}
                </span>
              )}
              {showRate && (
                <span
                  className="font-extrabold leading-tight"
                  style={{ fontSize: `${rateFontSize}px` }}
                >
                  {sector.changeRate >= 0 ? "+" : ""}
                  {sector.changeRate.toFixed(2)}%
                </span>
              )}
            </button>
          );
        })}

        {/* Tooltip */}
        <div
          ref={tooltipRef}
          className="absolute pointer-events-none z-50 bg-slate-900 dark:bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg transition-opacity duration-150"
          style={{ opacity: 0 }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-1 mt-3">
        <span className="text-[10px] text-muted">-3%</span>
        <div className="flex gap-0.5">
          {[
            "#1d4ed8",
            "#3b82f6",
            "#60a5fa",
            "#6b7280",
            "#fca5a5",
            "#ef4444",
            "#b91c1c",
          ].map((c, i) => (
            <div
              key={i}
              className="w-5 h-2 rounded-sm"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted">+3%</span>
      </div>
    </div>
  );
}
