"use client";

import { useEffect, useState } from "react";
import type { SectorDetailResult, StockInSector } from "@/lib/krx";

interface Props {
  sectorCode: string;
  sectorName: string;
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

export default function SectorDetail({
  sectorCode,
  sectorName,
  onClose,
}: Props) {
  const [data, setData] = useState<SectorDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStock, setExpandedStock] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setExpandedStock(null);
    fetch(`/api/sectors/${sectorCode}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setData(json.data);
        else setError(json.error || "데이터를 불러올 수 없습니다.");
      })
      .catch(() => setError("서버에 연결할 수 없습니다."))
      .finally(() => setLoading(false));
  }, [sectorCode]);

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
        <div className="sticky top-0 bg-card border-b border-card-border px-4 py-3 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="font-bold text-lg">{sectorName}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-muted transition"
          >
            ✕
          </button>
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

          {data && (
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

              {/* 시총 상위 5 */}
              <section>
                <h4 className="font-bold text-sm text-muted mb-2">
                  시가총액 상위 5
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

              {/* 변동률 상위 5 */}
              <section>
                <h4 className="font-bold text-sm text-muted mb-2">
                  등락률 변동 상위 5
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
