"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import type { SectorAnalysis } from "@/lib/analysis";

// ─── 카테고리 매핑 ───

type Category =
  | "IT"
  | "금융"
  | "헬스케어"
  | "산업재"
  | "경기소비재"
  | "필수소비재"
  | "소재"
  | "커뮤니케이션"
  | "에너지"
  | "유틸리티"
  | "부동산"
  | "기타";

const CATEGORY_WEIGHT: Record<Category, number> = {
  IT: 600,
  금융: 300,
  헬스케어: 200,
  산업재: 250,
  경기소비재: 280,
  필수소비재: 120,
  소재: 200,
  커뮤니케이션: 150,
  에너지: 80,
  유틸리티: 60,
  부동산: 40,
  기타: 50,
};

function getCategory(name: string): Category {
  // IT/기술
  if (
    /반도체|소프트웨어|IT서비스|전자장비|컴퓨터|디스플레이|핸드셋|전자제품|전기제품|사무용전자|통신장비/.test(
      name
    )
  )
    return "IT";
  // 금융
  if (/은행|증권|보험|기타금융|창업투자|카드/.test(name)) return "금융";
  // 헬스케어
  if (/제약|생물공학|생명과학|건강관리/.test(name)) return "헬스케어";
  // 산업재
  if (
    /기계|조선|건설|전기장비|항공|해운|도로|운송|우주항공|상업서비스/.test(name)
  )
    return "산업재";
  // 커뮤니케이션
  if (/통신서비스|무선통신|다각화된통신|방송|엔터|게임|광고|출판|양방향/.test(name))
    return "커뮤니케이션";
  // 경기소비재
  if (
    /자동차|호텔|레스토랑|레저|인터넷과카탈|백화점|전문소매|판매|무역|다각화된소비|교육|섬유|의류|화장품|가구/.test(
      name
    )
  )
    return "경기소비재";
  // 필수소비재
  if (/식품|음료|담배|가정용/.test(name)) return "필수소비재";
  // 소재
  if (/화학|철강|비철금속|종이|목재|포장재|건축자재|건축제품/.test(name))
    return "소재";
  // 에너지
  if (/석유|에너지/.test(name)) return "에너지";
  // 유틸리티
  if (/유틸리티|전기유틸/.test(name)) return "유틸리티";
  // 부동산
  if (/부동산/.test(name)) return "부동산";
  return "기타";
}

function sectorWeight(name: string): number {
  if (/반도체/.test(name)) return 500;
  if (/은행/.test(name)) return 150;
  if (/자동차$/.test(name)) return 130;
  if (/생물공학/.test(name)) return 100;
  if (/인터넷/.test(name)) return 80;
  if (/전자장비/.test(name)) return 70;
  if (/화학/.test(name)) return 60;
  if (/철강|비철금속/.test(name)) return 50;
  if (/보험/.test(name)) return 45;
  if (/증권/.test(name)) return 40;
  if (/제약/.test(name)) return 40;
  if (/통신/.test(name)) return 35;
  if (/건설/.test(name)) return 35;
  if (/에너지|유틸/.test(name)) return 30;
  if (/식품|음료/.test(name)) return 28;
  if (/운송|항공|해운/.test(name)) return 25;
  if (/엔터|게임|소프트/.test(name)) return 25;
  if (/부동산/.test(name)) return 22;
  if (/금융/.test(name)) return 20;
  if (/기계|조선/.test(name)) return 20;
  if (/섬유|의류/.test(name)) return 15;
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

// ─── Generic squarified layout ───

interface LayoutItem {
  id: string;
  value: number;
}

interface LayoutRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function squarify(
  items: LayoutItem[],
  x: number,
  y: number,
  w: number,
  h: number
): LayoutRect[] {
  if (w <= 0 || h <= 0 || items.length === 0) return [];

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const rects: LayoutRect[] = [];
  let remaining = sorted;
  let cx = x,
    cy = y,
    cw = w,
    ch = h;
  let remTotal = remaining.reduce((s, i) => s + i.value, 0);

  while (remaining.length > 0) {
    if (remaining.length === 1) {
      rects.push({ id: remaining[0].id, x: cx, y: cy, w: cw, h: ch });
      break;
    }

    const isWide = cw >= ch;
    const shortSide = isWide ? ch : cw;

    let bestEnd = 0;
    let bestAspect = Infinity;
    let runSum = 0;

    for (let i = 0; i < remaining.length; i++) {
      runSum += remaining[i].value;
      const rowArea = (runSum / remTotal) * cw * ch;
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
    const rowArea = (rowSum / remTotal) * cw * ch;
    const rowLen = rowArea / shortSide;

    if (isWide) {
      let ry = cy;
      for (const item of row) {
        const itemH = (item.value / rowSum) * ch;
        rects.push({ id: item.id, x: cx, y: ry, w: rowLen, h: itemH });
        ry += itemH;
      }
      cx += rowLen;
      cw -= rowLen;
    } else {
      let rx = cx;
      for (const item of row) {
        const itemW = (item.value / rowSum) * cw;
        rects.push({ id: item.id, x: rx, y: cy, w: itemW, h: rowLen });
        rx += itemW;
      }
      cy += rowLen;
      ch -= rowLen;
    }

    remaining = remaining.slice(bestEnd + 1);
    remTotal -= rowSum;
  }

  return rects;
}

// ─── 2-level treemap: category → sectors ───

interface CategoryGroup {
  category: Category;
  sectors: SectorAnalysis[];
  totalWeight: number;
}

interface TreemapRect {
  sector: SectorAnalysis;
  category: Category;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CategoryRect {
  category: Category;
  x: number;
  y: number;
  w: number;
  h: number;
}

function buildTreemap(
  sectors: SectorAnalysis[],
  width: number,
  height: number
): { sectorRects: TreemapRect[]; categoryRects: CategoryRect[] } {
  if (width <= 0 || height <= 0 || sectors.length === 0)
    return { sectorRects: [], categoryRects: [] };

  // Group by category
  const groupMap = new Map<Category, SectorAnalysis[]>();
  for (const s of sectors) {
    const cat = getCategory(s.name);
    if (!groupMap.has(cat)) groupMap.set(cat, []);
    groupMap.get(cat)!.push(s);
  }

  const groups: CategoryGroup[] = [];
  for (const [category, secs] of groupMap) {
    const totalWeight = secs.reduce((sum, s) => sum + sectorWeight(s.name), 0);
    groups.push({ category, sectors: secs, totalWeight });
  }

  // Layout categories
  const catItems: LayoutItem[] = groups.map((g) => ({
    id: g.category,
    value: Math.max(g.totalWeight, CATEGORY_WEIGHT[g.category]),
  }));

  const catRects = squarify(catItems, 0, 0, width, height);
  const catRectMap = new Map(catRects.map((r) => [r.id, r]));

  const sectorRects: TreemapRect[] = [];
  const categoryRects: CategoryRect[] = [];
  const HEADER_H = 14; // category label height
  const BORDER = 1;

  for (const group of groups) {
    const cr = catRectMap.get(group.category);
    if (!cr) continue;

    // Category rect (with border inset)
    const cx = cr.x + BORDER;
    const cy = cr.y + BORDER;
    const cw = cr.w - BORDER * 2;
    const ch = cr.h - BORDER * 2;

    categoryRects.push({
      category: group.category,
      x: cx,
      y: cy,
      w: cw,
      h: ch,
    });

    // Sectors go below the header
    const headerH = ch > 30 ? HEADER_H : 0;
    const sx = cx;
    const sy = cy + headerH;
    const sw = cw;
    const sh = ch - headerH;

    if (sw <= 0 || sh <= 0) continue;

    const sectorItems: LayoutItem[] = group.sectors.map((s) => ({
      id: s.code,
      value: sectorWeight(s.name),
    }));

    const sRects = squarify(sectorItems, sx, sy, sw, sh);
    const sectorMap = new Map(group.sectors.map((s) => [s.code, s]));

    for (const sr of sRects) {
      const sector = sectorMap.get(sr.id);
      if (!sector) continue;
      sectorRects.push({
        sector,
        category: group.category,
        x: sr.x,
        y: sr.y,
        w: sr.w,
        h: sr.h,
      });
    }
  }

  return { sectorRects, categoryRects };
}

// ─── Treemap rendering ───

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

  const { sectorRects, categoryRects } = useMemo(
    () => buildTreemap(sectors, width, height),
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
      const cat = getCategory(sector.name);
      tip.innerHTML = `<span style="opacity:0.6;font-size:10px">${cat}</span><br/><strong>${sector.name}</strong><br/><span style="color:${
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
      className="relative w-full overflow-hidden rounded-lg bg-slate-950"
      style={{ height: `${height}px` }}
    >
      {/* Category labels */}
      {categoryRects.map((cr) => {
        const fontSize = fullscreen
          ? Math.min(11, Math.max(7, cr.w / 12))
          : Math.min(9, Math.max(6, cr.w / 14));
        const showLabel = cr.w > 40 && cr.h > 30;
        return (
          <div
            key={cr.category}
            className="absolute overflow-hidden pointer-events-none"
            style={{
              left: `${cr.x}px`,
              top: `${cr.y}px`,
              width: `${cr.w}px`,
              height: `${cr.h}px`,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {showLabel && (
              <div
                className="truncate px-1 font-bold text-white/50 uppercase tracking-wide"
                style={{ fontSize: `${fontSize}px`, lineHeight: "14px" }}
              >
                {cr.category}
              </div>
            )}
          </div>
        );
      })}

      {/* Sector cells */}
      {sectorRects.map((rect) => {
        const { sector, x, y, w, h } = rect;
        const bg = heatBg(sector.changeRate);
        const tc = textColor(sector.changeRate);
        const nameSize = fullscreen
          ? Math.min(13, Math.max(7, Math.min(w / 6, h / 3)))
          : Math.min(10, Math.max(6, Math.min(w / 7, h / 3)));
        const rateSize = fullscreen
          ? Math.min(14, Math.max(8, Math.min(w / 5, h / 2.5)))
          : Math.min(11, Math.max(7, Math.min(w / 6, h / 2.5)));
        const showName = w > 28 && h > 16;
        const showRate = w > 22 && h > 10;

        return (
          <button
            key={sector.code}
            onClick={() => onSectorClick?.(sector.code, sector.name)}
            onMouseMove={(e) => showTooltip(e, sector)}
            onMouseLeave={hideTooltip}
            className="absolute flex flex-col items-center justify-center overflow-hidden hover:brightness-125 active:brightness-90 transition-[filter]"
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

// ─── Fullscreen modal ───

function FullscreenModal({
  sectors,
  onSectorClick,
  onClose,
}: {
  sectors: SectorAnalysis[];
  onSectorClick?: (code: string, name: string) => void;
  onClose: () => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-6xl bg-card rounded-2xl p-4 shadow-2xl flex flex-col"
        style={{ height: "min(90vh, 800px)" }}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h2 className="text-lg font-bold">섹터 히트맵</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition text-lg"
          >
            X
          </button>
        </div>
        <div ref={areaRef} className="flex-1 min-h-0 overflow-hidden">
          {size.w > 0 && size.h > 0 && (
            <TreemapCanvas
              sectors={sectors}
              width={size.w}
              height={size.h}
              fullscreen
              onSectorClick={onSectorClick}
            />
          )}
        </div>
        <div className="flex items-center justify-center gap-1 mt-3 shrink-0">
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

      {fullscreen && (
        <FullscreenModal
          sectors={sectors}
          onSectorClick={onSectorClick}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  );
}
