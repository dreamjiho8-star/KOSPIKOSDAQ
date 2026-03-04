"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import type { SectorAnalysis } from "@/lib/analysis";
import type { TreemapStock } from "@/lib/krx";

// 등락률 → 배경색
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

interface Rect { x: number; y: number; w: number; h: number; }

interface TreemapItem {
  id: string;
  label: string;
  value: number;
}

function squarify(items: TreemapItem[], rect: Rect): (TreemapItem & Rect)[] {
  if (items.length === 0) return [];
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return [];

  const result: (TreemapItem & Rect)[] = [];
  let remaining = [...items];
  let cr = { ...rect };

  while (remaining.length > 0) {
    const isWide = cr.w >= cr.h;
    const side = isWide ? cr.h : cr.w;
    const remTotal = remaining.reduce((s, i) => s + i.value, 0);

    let row: TreemapItem[] = [];
    let bestRatio = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = [...row, remaining[i]];
      const rowTotal = candidate.reduce((s, it) => s + it.value, 0);
      const rowW = (rowTotal / remTotal) * (isWide ? cr.w : cr.h);

      let worst = 0;
      for (const it of candidate) {
        const itemH = (it.value / rowTotal) * side;
        worst = Math.max(worst, Math.max(rowW / itemH, itemH / rowW));
      }
      if (worst <= bestRatio) { bestRatio = worst; row = candidate; }
      else break;
    }

    const rowTotal = row.reduce((s, i) => s + i.value, 0);
    const rowW = (rowTotal / remTotal) * (isWide ? cr.w : cr.h);
    let offset = 0;

    for (const item of row) {
      const sz = (item.value / rowTotal) * side;
      result.push(isWide
        ? { ...item, x: cr.x, y: cr.y + offset, w: rowW, h: sz }
        : { ...item, x: cr.x + offset, y: cr.y, w: sz, h: rowW });
      offset += sz;
    }

    cr = isWide
      ? { x: cr.x + rowW, y: cr.y, w: cr.w - rowW, h: cr.h }
      : { x: cr.x, y: cr.y + rowW, w: cr.w, h: cr.h - rowW };
    remaining = remaining.slice(row.length);
  }
  return result;
}

// 셀 데이터 (레이아웃 계산 결과)
interface CellData {
  code: string;
  name: string;
  sectorCode: string;
  sectorName: string;
  rate: number;
  mcap: number;
  x: number; y: number; w: number; h: number;
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // 레이아웃 전체를 한 번에 메모이제이션
  const { sectorRects, cells } = useMemo(() => {
    // 섹터별 그룹핑
    const groupMap = new Map<string, { name: string; stocks: TreemapStock[]; totalMcap: number }>();
    for (const s of stocks) {
      const g = groupMap.get(s.sectorCode) || { name: s.sectorName, stocks: [], totalMcap: 0 };
      g.stocks.push(s);
      g.totalMcap += s.marketCap;
      groupMap.set(s.sectorCode, g);
    }
    const groups = [...groupMap.entries()]
      .map(([code, g]) => ({ code, ...g }))
      .sort((a, b) => b.totalMcap - a.totalMcap);

    const sItems: TreemapItem[] = groups.map((g) => ({
      id: g.code, label: g.name, value: g.totalMcap,
    }));
    const sRects = squarify(sItems, { x: 0, y: 0, w: width, h: height });

    const allCells: CellData[] = [];
    for (const sr of sRects) {
      const grp = groups.find((g) => g.code === sr.id);
      if (!grp) continue;
      const sorted = grp.stocks.sort((a, b) => b.marketCap - a.marketCap);
      const stItems: TreemapItem[] = sorted.map((s) => ({
        id: s.code, label: s.name, value: s.marketCap,
      }));
      const pad = 1;
      const hdrH = 14;
      const inner = {
        x: sr.x + pad, y: sr.y + hdrH + pad,
        w: Math.max(sr.w - pad * 2, 1), h: Math.max(sr.h - hdrH - pad * 2, 1),
      };
      const stRects = squarify(stItems, inner);
      for (const r of stRects) {
        const st = sorted.find((s) => s.code === r.id);
        if (st) {
          allCells.push({
            code: st.code, name: st.name,
            sectorCode: st.sectorCode, sectorName: grp.name,
            rate: st.changeRate, mcap: st.marketCap,
            x: r.x, y: r.y, w: r.w, h: r.h,
          });
        }
      }
    }
    return { sectorRects: sRects, cells: allCells };
  }, [stocks, width, height]);

  // 순수 DOM 조작 기반 툴팁 (React state 사용 안 함 → 리렌더 제로)
  const showTooltip = useCallback((e: React.MouseEvent, cell: CellData) => {
    const tip = tooltipRef.current;
    const container = containerRef.current;
    if (!tip || !container) return;
    const cRect = container.getBoundingClientRect();
    const tRect = e.currentTarget.getBoundingClientRect();
    const cx = tRect.left - cRect.left + tRect.width / 2;
    const cy = tRect.top - cRect.top - 6;

    tip.style.left = `${cx}px`;
    tip.style.top = `${cy}px`;
    tip.style.display = "block";
    tip.innerHTML = `
      <div style="font-weight:700;font-size:13px">${cell.name}</div>
      <div style="color:#94a3b8;font-size:10px">${cell.sectorName}</div>
      <div style="font-weight:700;color:${cell.rate >= 0 ? "#f87171" : "#60a5fa"}">${cell.rate >= 0 ? "+" : ""}${cell.rate.toFixed(2)}%</div>
      <div style="color:#94a3b8;font-size:10px">시총 ${cell.mcap.toLocaleString()}억</div>
    `;
  }, []);

  const hideTooltip = useCallback(() => {
    const tip = tooltipRef.current;
    if (tip) tip.style.display = "none";
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl"
      style={{ width, height, background: "#1a1a2e" }}
    >
      {/* 섹터 라벨 */}
      {sectorRects.map((sr) => (
        <div
          key={sr.id}
          className="absolute border border-slate-800/60"
          style={{ left: sr.x, top: sr.y, width: sr.w, height: sr.h }}
        >
          {sr.w > 40 && (
            <div
              className="absolute top-0 left-0 px-1 text-[9px] font-bold text-white/70 truncate z-10"
              style={{ maxWidth: sr.w }}
            >
              {sr.label}
            </div>
          )}
        </div>
      ))}

      {/* 종목 셀 */}
      {cells.map((cell) => {
        const showName = cell.w > 35 && cell.h > 20;
        const showRate = cell.w > 25 && cell.h > 14;
        const fs = Math.min(12, Math.max(8, Math.min(cell.w / 5, cell.h / 3)));

        return (
          <div
            key={cell.code}
            className="absolute flex flex-col items-center justify-center cursor-pointer"
            style={{
              left: cell.x + 0.5, top: cell.y + 0.5,
              width: Math.max(cell.w - 1, 1), height: Math.max(cell.h - 1, 1),
              backgroundColor: heatBg(cell.rate), borderRadius: 2,
            }}
            onMouseEnter={(e) => showTooltip(e, cell)}
            onMouseLeave={hideTooltip}
            onClick={() => onSectorClick?.(cell.sectorCode, cell.sectorName)}
          >
            {showName && (
              <span className="text-white font-bold truncate leading-tight"
                style={{ fontSize: Math.max(fs, 8), maxWidth: cell.w - 4 }}
              >
                {cell.name.length > Math.floor(cell.w / 8)
                  ? cell.name.slice(0, Math.floor(cell.w / 8))
                  : cell.name}
              </span>
            )}
            {showRate && (
              <span className="text-white/90 font-bold leading-tight"
                style={{ fontSize: Math.max(fs - 2, 7) }}
              >
                {cell.rate >= 0 ? "+" : ""}{cell.rate.toFixed(1)}%
              </span>
            )}
          </div>
        );
      })}

      {/* DOM 직접 조작 툴팁 (리렌더 없음) */}
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none z-50 rounded-lg px-3 py-2 text-xs shadow-xl"
        style={{
          display: "none",
          transform: "translate(-50%, -100%)",
          backgroundColor: "rgba(15,23,42,0.95)",
          color: "white",
        }}
      />
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
  const outerRef = useRef<HTMLDivElement>(null);

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
    const el = outerRef.current;
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
    <div ref={outerRef} className="bg-card border border-card-border rounded-2xl p-4">
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
        <div className="flex flex-wrap gap-1.5">
          {[...sectors].sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate)).map((s) => (
            <button
              key={s.code}
              onClick={() => onSectorClick?.(s.code, s.name)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium hover:opacity-80 active:scale-95"
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
      )}

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
