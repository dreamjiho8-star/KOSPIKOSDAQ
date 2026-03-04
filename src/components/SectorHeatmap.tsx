"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import type { SectorAnalysis } from "@/lib/analysis";

// ─── 섹터 시총 가중치 (대략적 비율) ───

function sectorWeight(name: string): number {
  if (/반도체/.test(name)) return 500;
  if (/은행/.test(name)) return 150;
  if (/자동차/.test(name)) return 130;
  if (/바이오/.test(name)) return 100;
  if (/인터넷/.test(name)) return 80;
  if (/전기전자|전자장비/.test(name)) return 70;
  if (/석유화학|화학/.test(name)) return 60;
  if (/철강|금속/.test(name)) return 50;
  if (/보험/.test(name)) return 45;
  if (/증권/.test(name)) return 40;
  if (/제약/.test(name)) return 40;
  if (/통신장비|통신서비스|통신/.test(name)) return 35;
  if (/건설/.test(name)) return 35;
  if (/에너지|전력|유틸/.test(name)) return 30;
  if (/식품|음식|음료/.test(name)) return 28;
  if (/운송|항공|해운/.test(name)) return 25;
  if (/미디어|엔터|게임|소프트/.test(name)) return 25;
  if (/부동산/.test(name)) return 22;
  if (/금융|기타금융/.test(name)) return 20;
  if (/기계|조선/.test(name)) return 20;
  if (/섬유|의류|패션/.test(name)) return 15;
  if (/종이|목재|가구/.test(name)) return 10;
  return 18;
}

// ─── Color helpers (-6% ~ +6% range) ───

function heatBg(rate: number): string {
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
    .map((s) => ({ sector: s, value: sectorWeight(s.name) }))
    .sort((a, b) => b.value - a.value);

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

// ─── Treemap rendering (shared between inline and fullscreen) ───

function TreemapCanvas({
  sectors,
  width,
  height,
  fullscreen,
  onSectorClick,
}: {
  sectors: SectorAnalysis[];
  width: number;
  height: number;
  fullscreen?: boolean;
  onSectorClick?: (code: string, name: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const rects = useMemo(
    () => squarifiedLayout(sectors, width, height),
    [sectors, width, height]
  );

  const showTooltip = useCallback(
    (e: React.MouseEvent, sector: SectorAnalysis) => {
      const tip = tooltipRef.current;
      const container = containerRef.current;
      if (!tip || !container) return;
      const cr = container.getBoundingClientRect();
      let tx = e.clientX - cr.left + 12;
      let ty = e.clientY - cr.top - 40;
      if (tx + 150 > cr.width) tx = tx - 170;
      if (ty < 0) ty = e.clientY - cr.top + 16;
      tip.style.left = `${tx}px`;
      tip.style.top = `${ty}px`;
      tip.style.opacity = "1";
      tip.innerHTML = `<strong>${sector.name}</strong><br/><span style="color:${
        sector.changeRate >= 0 ? "#ef4444" : "#3b82f6"
      };font-weight:700">${
        sector.changeRate >= 0 ? "+" : ""
      }${sector.changeRate.toFixed(2)}%</span>`;
    },
    []
  );

  const hideTooltip = useCallback(() => {
    const tip = tooltipRef.current;
    if (tip) tip.style.opacity = "0";
  }, []);

  const GAP = 1;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-lg"
      style={{ height: `${height}px` }}
    >
      {rects.map((rect) => {
        const { sector, x, y, w, h } = rect;
        const bg = heatBg(sector.changeRate);
        const tc = textColor(sector.changeRate);
        const nameSize = fullscreen
          ? Math.min(14, Math.max(8, Math.min(w / 6, h / 3)))
          : Math.min(11, Math.max(6, Math.min(w / 7, h / 3)));
        const rateSize = fullscreen
          ? Math.min(15, Math.max(9, Math.min(w / 5, h / 2.5)))
          : Math.min(12, Math.max(7, Math.min(w / 6, h / 2.5)));
        const showName = w > 30 && h > 18;
        const showRate = w > 24 && h > 12;

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
                style={{ fontSize: `${nameSize}px`, maxWidth: `${w - 4}px` }}
              >
                {sector.name}
              </span>
            )}
            {showRate && (
              <span
                className="font-extrabold leading-tight"
                style={{ fontSize: `${rateSize}px` }}
              >
                {sector.changeRate >= 0 ? "+" : ""}
                {sector.changeRate.toFixed(2)}%
              </span>
            )}
          </button>
        );
      })}

      <div
        ref={tooltipRef}
        className="absolute pointer-events-none z-50 bg-slate-900 dark:bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg transition-opacity duration-150"
        style={{ opacity: 0 }}
      />
    </div>
  );
}

// ─── Main component ───

export default function SectorHeatmap({
  sectors,
  onSectorClick,
}: {
  sectors: SectorAnalysis[];
  onSectorClick?: (code: string, name: string) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const el = wrapperRef.current;
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

  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  const mapHeight = useMemo(
    () => Math.max(280, containerWidth * 0.55),
    [containerWidth]
  );

  if (sectors.length === 0) return null;

  return (
    <>
      <div
        ref={wrapperRef}
        className="bg-card border border-card-border rounded-2xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">섹터 히트맵</h2>
          <button
            onClick={() => setFullscreen(true)}
            className="text-xs text-blue-500 hover:text-blue-600 font-medium"
          >
            크게보기
          </button>
        </div>

        {containerWidth > 0 && (
          <TreemapCanvas
            sectors={sectors}
            width={containerWidth}
            height={mapHeight}
            onSectorClick={onSectorClick}
          />
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-1 mt-3">
          <span className="text-[10px] text-muted">-6%</span>
          <div className="flex gap-0.5">
            {[
              "#172554",
              "#1d4ed8",
              "#3b82f6",
              "#60a5fa",
              "#4b5563",
              "#fca5a5",
              "#ef4444",
              "#b91c1c",
              "#7f1d1d",
            ].map((c, i) => (
              <div
                key={i}
                className="w-4 h-2 rounded-sm"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <span className="text-[10px] text-muted">+6%</span>
        </div>
      </div>

      {/* Fullscreen modal */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFullscreen(false);
          }}
        >
          <div className="w-full max-w-6xl bg-card rounded-2xl p-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">섹터 히트맵</h2>
              <button
                onClick={() => setFullscreen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition text-lg"
              >
                X
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <TreemapCanvas
                sectors={sectors}
                width={Math.min(1152, window.innerWidth - 64)}
                height={Math.min(680, window.innerHeight - 160)}
                fullscreen
                onSectorClick={onSectorClick}
              />
            </div>
            <div className="flex items-center justify-center gap-1 mt-3">
              <span className="text-[10px] text-muted">-6%</span>
              <div className="flex gap-0.5">
                {[
                  "#172554",
                  "#1d4ed8",
                  "#3b82f6",
                  "#60a5fa",
                  "#4b5563",
                  "#fca5a5",
                  "#ef4444",
                  "#b91c1c",
                  "#7f1d1d",
                ].map((c, i) => (
                  <div
                    key={i}
                    className="w-5 h-2.5 rounded-sm"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted">+6%</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
