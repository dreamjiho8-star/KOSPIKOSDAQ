"use client";

import { useEffect, useState, useRef, useLayoutEffect } from "react";
import type { SectorDetailResult, StockInSector } from "@/lib/krx";
import StockSparkline from "./StockSparkline";

interface Props {
  sectorCode: string;
  sectorName: string;
  period?: string;
  onClose: () => void;
}

function StockRow({
  stock,
  rank,
  expanded,
  onToggle,
}: {
  stock: StockInSector;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const rateColor = (v: number) =>
    v >= 0
      ? "text-red-600 dark:text-red-400"
      : "text-blue-600 dark:text-blue-400";

  const pos52 =
    stock.high52w && stock.low52w && stock.high52w > stock.low52w
      ? ((stock.price - stock.low52w) / (stock.high52w - stock.low52w)) * 100
      : null;

  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        onClick={onToggle}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted font-mono w-4 text-center">
              {rank}
            </span>
            <span className="font-medium text-sm truncate">{stock.name}</span>
            <span className="text-[10px] text-muted">{expanded ? "▲" : "▼"}</span>
          </div>
          <div className="text-[10px] text-muted ml-6">
            시총 {stock.marketCap.toLocaleString()}억
          </div>
        </div>
        <div className="text-right shrink-0 ml-3">
          <div className="font-mono text-sm font-bold">
            {stock.price.toLocaleString()}
          </div>
          <div
            className={`text-xs font-bold ${rateColor(stock.changeRate)}`}
          >
            {stock.changeRate >= 0 ? "+" : ""}
            {stock.changeRate.toFixed(2)}%
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-card-border">
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: "PER", value: stock.per !== null ? `${stock.per}배` : "-" },
              { label: "PBR", value: stock.pbr !== null ? `${stock.pbr}배` : "-" },
              { label: "EPS", value: stock.eps !== null ? `${stock.eps.toLocaleString()}원` : "-" },
              { label: "BPS", value: stock.bps !== null ? `${stock.bps.toLocaleString()}원` : "-" },
              { label: "배당률", value: stock.dividendYield !== null ? `${stock.dividendYield}%` : "-" },
              { label: "외인율", value: stock.foreignRate !== null ? `${stock.foreignRate}%` : "-" },
              { label: "52주고", value: stock.high52w !== null ? stock.high52w.toLocaleString() : "-" },
              { label: "52주저", value: stock.low52w !== null ? stock.low52w.toLocaleString() : "-" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-[9px] text-muted">{label}</div>
                <div className="text-[11px] font-bold font-mono">{value}</div>
              </div>
            ))}
          </div>
          {/* 52주 포지션 바 */}
          {pos52 !== null && (
            <div className="mt-2">
              <div className="text-[9px] text-muted mb-0.5">52주 가격 위치</div>
              <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full relative">
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-500 rounded-full shadow"
                  style={{ left: `calc(${Math.min(100, Math.max(0, pos52))}% - 5px)` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-muted mt-0.5">
                <span>{stock.low52w?.toLocaleString()}</span>
                <span>{stock.high52w?.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── squarify (미니 트리맵용) ── */
interface Rect { x: number; y: number; w: number; h: number }
interface TreeItem { stock: StockInSector; weight: number; rect: Rect }

function squarify(
  items: { stock: StockInSector; weight: number }[],
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
  return v >= 10000
    ? `${(v / 10000).toFixed(1)}조`
    : `${v.toLocaleString()}억`;
}

function StockPopup({ stock, onClose }: { stock: StockInSector; onClose: () => void }) {
  const rc = (v: number) =>
    v >= 0 ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400";

  const pos52 =
    stock.high52w && stock.low52w && stock.high52w > stock.low52w
      ? ((stock.price - stock.low52w) / (stock.high52w - stock.low52w)) * 100
      : null;

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-card w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl overflow-y-auto max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-card-border flex items-center justify-between">
          <div>
            <h4 className="font-bold text-base">{stock.name}</h4>
            <p className="text-[10px] text-muted">시총 {formatMcap(stock.marketCap)}</p>
          </div>
          <div className="text-right">
            <div className="font-mono text-base font-bold">{stock.price.toLocaleString()}</div>
            <div className={`text-xs font-bold ${rc(stock.changeRate)}`}>
              {stock.changeRate >= 0 ? "+" : ""}{stock.changeRate.toFixed(2)}%
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "PER", value: stock.per !== null ? `${stock.per}배` : "-" },
              { label: "PBR", value: stock.pbr !== null ? `${stock.pbr}배` : "-" },
              { label: "EPS", value: stock.eps !== null ? `${stock.eps.toLocaleString()}원` : "-" },
              { label: "BPS", value: stock.bps !== null ? `${stock.bps.toLocaleString()}원` : "-" },
              { label: "배당률", value: stock.dividendYield !== null ? `${stock.dividendYield}%` : "-" },
              { label: "외인율", value: stock.foreignRate !== null ? `${stock.foreignRate}%` : "-" },
              { label: "52주고", value: stock.high52w !== null ? stock.high52w.toLocaleString() : "-" },
              { label: "52주저", value: stock.low52w !== null ? stock.low52w.toLocaleString() : "-" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center bg-slate-50 dark:bg-slate-800 rounded-lg py-2">
                <div className="text-[9px] text-muted">{label}</div>
                <div className="text-[11px] font-bold font-mono">{value}</div>
              </div>
            ))}
          </div>
          {pos52 !== null && (
            <div>
              <div className="text-[9px] text-muted mb-1">52주 가격 위치</div>
              <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full relative">
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-500 rounded-full shadow"
                  style={{ left: `calc(${Math.min(100, Math.max(0, pos52))}% - 5px)` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-muted mt-0.5">
                <span>{stock.low52w?.toLocaleString()}</span>
                <span>{stock.high52w?.toLocaleString()}</span>
              </div>
            </div>
          )}
          <StockSparkline stockCode={stock.code} />
        </div>
      </div>
    </div>
  );
}

function MiniTreemap({ stocks }: { stocks: StockInSector[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [selectedStock, setSelectedStock] = useState<StockInSector | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      setSize({ w: width, h: Math.max(200, width * 0.55) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const items = stocks.map((s) => ({
    stock: s,
    weight: Math.max(s.marketCap, 1),
  }));

  const cells = size.w > 0 ? squarify(items, 0, 0, size.w, size.h) : [];

  const showTooltip = (stock: StockInSector, e: React.MouseEvent | React.TouchEvent) => {
    const tip = tooltipRef.current;
    const container = containerRef.current;
    if (!tip || !container) return;
    const cr = container.getBoundingClientRect();
    let cx: number, cy: number;
    if ("touches" in e) {
      cx = e.touches[0].clientX - cr.left;
      cy = e.touches[0].clientY - cr.top;
    } else {
      cx = e.clientX - cr.left;
      cy = e.clientY - cr.top;
    }
    tip.innerHTML = `<div class="font-bold">${stock.name}</div><div class="font-mono">${stock.changeRate >= 0 ? "+" : ""}${stock.changeRate.toFixed(2)}%</div><div class="text-[10px] opacity-80">시총 ${formatMcap(stock.marketCap)}</div>`;
    tip.style.opacity = "1";
    // Position: prefer above cursor, shift if near edges
    const tipW = 140;
    let left = cx - tipW / 2;
    if (left < 0) left = 0;
    if (left + tipW > size.w) left = size.w - tipW;
    let top = cy - 60;
    if (top < 0) top = cy + 20;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };

  const hideTooltip = () => {
    const tip = tooltipRef.current;
    if (tip) tip.style.opacity = "0";
  };

  return (
    <>
      <div ref={containerRef} className="w-full">
        {size.w > 0 && (
          <div
            className="relative"
            style={{ width: size.w, height: size.h }}
            onMouseLeave={hideTooltip}
            onTouchEnd={hideTooltip}
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
                  className="absolute flex flex-col items-center justify-center overflow-hidden cursor-pointer"
                  style={{
                    left: rect.x + 1,
                    top: rect.y + 1,
                    width: Math.max(0, rect.w - 2),
                    height: Math.max(0, rect.h - 2),
                    backgroundColor: rateToColor(stock.changeRate),
                    color: tc,
                    borderRadius: 6,
                  }}
                  onClick={() => { hideTooltip(); setSelectedStock(stock); }}
                  onMouseEnter={(e) => showTooltip(stock, e)}
                  onMouseMove={(e) => showTooltip(stock, e)}
                  onTouchStart={(e) => showTooltip(stock, e)}
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
            {/* Tooltip */}
            <div
              ref={tooltipRef}
              className="absolute pointer-events-none bg-slate-900 text-white text-xs rounded-lg px-3 py-2 text-center shadow-lg transition-opacity duration-150 z-10"
              style={{ opacity: 0, width: 140 }}
            />
          </div>
        )}
      </div>
      {selectedStock && (
        <StockPopup stock={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </>
  );
}

type DetailTab = "heatmap" | "info";

export default function SectorDetail({
  sectorCode,
  sectorName,
  period = "1d",
  onClose,
}: Props) {
  const [data, setData] = useState<SectorDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStock, setExpandedStock] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("heatmap");

  useEffect(() => {
    setLoading(true);
    setError(null);
    setExpandedStock(null);
    fetch(`/api/sectors/${sectorCode}?period=${period}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setData(json.data);
        else setError(json.error || "데이터를 불러올 수 없습니다.");
      })
      .catch(() => setError("서버에 연결할 수 없습니다."))
      .finally(() => setLoading(false));
  }, [sectorCode, period]);

  const rateColor = (v: number) =>
    v >= 0
      ? "text-red-600 dark:text-red-400"
      : "text-blue-600 dark:text-blue-400";

  const formatOk = (v: number) => {
    const prefix = v >= 0 ? "+" : "";
    return `${prefix}${v.toLocaleString()}`;
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-card w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-card border-b border-card-border rounded-t-2xl z-10">
          <div className="px-4 py-3 flex items-center justify-between">
            <h3 className="font-bold text-lg">{sectorName}</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-muted transition"
            >
              ✕
            </button>
          </div>
          {data && (
            <div className="flex px-4 gap-1 pb-2">
              {([
                ["heatmap", "히트맵"],
                ["info", "상세 정보"],
              ] as [DetailTab, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setDetailTab(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
                    detailTab === key
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-card text-muted border-card-border hover:border-slate-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 space-y-5">
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-muted text-sm">종목 정보 불러오는 중...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          {data && detailTab === "heatmap" && (
            <MiniTreemap stocks={data.topByMarketCap} />
          )}

          {data && detailTab === "info" && (
            <>
              {/* 섹터 밸류에이션 요약 */}
              <section>
                <h4 className="font-bold text-sm text-muted mb-2">
                  섹터 밸류에이션
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "평균 PER", value: data.valuation.avgPer, unit: "배" },
                    { label: "평균 PBR", value: data.valuation.avgPbr, unit: "배" },
                    { label: "평균 배당률", value: data.valuation.avgDividendYield, unit: "%" },
                  ].map(({ label, value, unit }) => (
                    <div
                      key={label}
                      className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center"
                    >
                      <div className="text-[10px] text-muted mb-0.5">{label}</div>
                      <div className="text-base font-bold font-mono">
                        {value !== null ? `${value}${unit}` : "-"}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 시총 순 전체 종목 */}
              <section>
                <h4 className="font-bold text-sm text-muted mb-2">
                  시가총액 순 ({data.topByMarketCap.length}개)
                  <span className="font-normal text-[10px] ml-1">(클릭하여 상세보기)</span>
                </h4>
                <div className="space-y-1.5">
                  {data.topByMarketCap.map((s, i) => (
                    <StockRow
                      key={s.code}
                      stock={s}
                      rank={i + 1}
                      expanded={expandedStock === `mcap-${s.code}`}
                      onToggle={() =>
                        setExpandedStock(
                          expandedStock === `mcap-${s.code}` ? null : `mcap-${s.code}`
                        )
                      }
                    />
                  ))}
                </div>
              </section>

              {/* 변동률 상위 10 */}
              <section>
                <h4 className="font-bold text-sm text-muted mb-2">
                  등락률 변동 상위 10
                </h4>
                <div className="space-y-1.5">
                  {data.topByVolatility.map((s, i) => (
                    <StockRow
                      key={s.code}
                      stock={s}
                      rank={i + 1}
                      expanded={expandedStock === `vol-${s.code}`}
                      onToggle={() =>
                        setExpandedStock(
                          expandedStock === `vol-${s.code}` ? null : `vol-${s.code}`
                        )
                      }
                    />
                  ))}
                </div>
              </section>

              {/* 투자자별 매매동향 */}
              <section>
                <div className="flex items-baseline justify-between mb-2">
                  <h4 className="font-bold text-sm text-muted">
                    투자자별 매매동향
                  </h4>
                  <span className="text-[10px] text-muted">단위 : 억</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "외국인", value: data.investor.foreignNet },
                    { label: "기관", value: data.investor.institutionNet },
                    { label: "개인", value: data.investor.individualNet },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center"
                    >
                      <div className="text-xs text-muted mb-1">{label}</div>
                      <div
                        className={`text-base font-bold font-mono ${rateColor(
                          value
                        )}`}
                      >
                        {formatOk(value)}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted mt-1">
                  * 시총 상위 종목 기준 합산 (근사치)
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
