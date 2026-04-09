"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { SectorAnalysis } from "@/lib/analysis";
import type { TopStock, StockInSector } from "@/lib/krx";
import { getFavorites, toggleFavoriteSector, toggleFavoriteStock } from "@/lib/favorites";
import StockSparkline from "./StockSparkline";

const rateColor = (v: number) =>
  v >= 0
    ? "text-red-600 dark:text-red-400"
    : "text-blue-600 dark:text-blue-400";

function formatMarketCap(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(1)}조`;
  return `${v.toLocaleString()}억`;
}

function formatPrice(v: number): string {
  return v.toLocaleString("ko-KR");
}

// 종목 상세 패널 (섹터 상세 API에서 데이터 가져옴)
function StockDetailPanel({
  stock,
  onClose,
  onSectorClick,
}: {
  stock: TopStock;
  onClose: () => void;
  onSectorClick: (code: string, name: string) => void;
}) {
  const [detail, setDetail] = useState<StockInSector | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stock.sectorCode) {
      setLoading(false);
      return;
    }
    fetch(`/api/sectors/${stock.sectorCode}?period=1d`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          const all = [
            ...(json.data.topByMarketCap || []),
            ...(json.data.topByVolatility || []),
          ];
          const found = all.find((s: StockInSector) => s.code === stock.code);
          if (found) setDetail(found);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [stock.code, stock.sectorCode]);

  const pos52 =
    detail?.high52w && detail?.low52w && detail.high52w > detail.low52w
      ? ((detail.price - detail.low52w) / (detail.high52w - detail.low52w)) * 100
      : null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-card border border-card-border rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto shadow-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더: 종목명 + 가격 */}
        <div className="px-4 pt-4 pb-3 border-b border-card-border">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-lg">{stock.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted">{stock.code}</span>
                <span className="text-xs text-muted">시총 {formatMarketCap(stock.marketCap)}</span>
              </div>
              {stock.sectorName && (
                <button
                  onClick={() => {
                    onSectorClick(stock.sectorCode!, stock.sectorName!);
                    onClose();
                  }}
                  className="text-xs text-blue-500 hover:text-blue-600 mt-1"
                >
                  {stock.sectorName} &rarr;
                </button>
              )}
            </div>
            <div className="text-right">
              {detail ? (
                <div className="text-xl font-extrabold">{formatPrice(detail.price)}</div>
              ) : (
                <div className="text-xl font-extrabold">&mdash;</div>
              )}
              <span className={`text-base font-bold ${rateColor(stock.changeRate)}`}>
                {stock.changeRate >= 0 ? "+" : ""}{stock.changeRate.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="p-4">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          )}

          {!loading && !detail && (
            <div className="text-center py-6 text-sm text-muted">
              상세 정보를 불러올 수 없습니다.
            </div>
          )}

          {detail && (
            <div className="space-y-3">
              {/* PER PBR EPS BPS 그리드 */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-muted">PER</div>
                  <div className="text-sm font-bold mt-0.5">
                    {detail.per !== null ? `${detail.per.toFixed(1)}배` : "-"}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-muted">PBR</div>
                  <div className="text-sm font-bold mt-0.5">
                    {detail.pbr !== null ? `${detail.pbr.toFixed(2)}배` : "-"}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-muted">EPS</div>
                  <div className="text-sm font-bold mt-0.5">
                    {detail.eps !== null ? `${detail.eps.toLocaleString()}원` : "-"}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-muted">BPS</div>
                  <div className="text-sm font-bold mt-0.5">
                    {detail.bps !== null ? `${detail.bps.toLocaleString()}원` : "-"}
                  </div>
                </div>
              </div>

              {/* 배당률 외인율 52주고 52주저 */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-muted">배당률</div>
                  <div className="text-sm font-bold mt-0.5">
                    {detail.dividendYield !== null ? `${detail.dividendYield.toFixed(2)}%` : "-"}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-muted">외인율</div>
                  <div className="text-sm font-bold mt-0.5">
                    {detail.foreignRate !== null ? `${detail.foreignRate.toFixed(1)}%` : "-"}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-muted">52주고</div>
                  <div className="text-sm font-bold mt-0.5">
                    {detail.high52w !== null ? formatPrice(detail.high52w) : "-"}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-muted">52주저</div>
                  <div className="text-sm font-bold mt-0.5">
                    {detail.low52w !== null ? formatPrice(detail.low52w) : "-"}
                  </div>
                </div>
              </div>

              {/* 52주 가격 위치 바 */}
              {pos52 !== null && detail.high52w && detail.low52w && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                  <div className="text-[10px] text-muted mb-2">52주 가격 위치</div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full relative">
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full shadow"
                      style={{ left: `calc(${Math.min(100, Math.max(0, pos52))}% - 6px)` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted mt-1">
                    <span>{formatPrice(detail.low52w)}</span>
                    <span>{formatPrice(detail.high52w)}</span>
                  </div>
                </div>
              )}

              {/* 30일 가격 차트 */}
              <StockSparkline stockCode={stock.code} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchModal({
  sectors,
  stocks,
  onSectorClick,
  onClose,
}: {
  sectors: SectorAnalysis[];
  stocks: TopStock[];
  onSectorClick: (code: string, name: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedStock, setSelectedStock] = useState<TopStock | null>(null);
  const [favs, setFavs] = useState(getFavorites());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (selectedStock) setSelectedStock(null);
      else onClose();
    }
  }, [selectedStock, onClose]);

  useEffect(() => {
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [handleEsc]);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (q.length === 0) return { sectors: [], stocks: [] };

    const matchedSectors = sectors.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.includes(q)
    ).slice(0, 10);

    const matchedStocks = stocks.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.includes(q)
    ).slice(0, 20);

    return { sectors: matchedSectors, stocks: matchedStocks };
  }, [q, sectors, stocks]);

  const hasResults = results.sectors.length > 0 || results.stocks.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-auto mt-16 sm:mt-24"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-card border border-card-border rounded-2xl shadow-2xl overflow-hidden mx-4">
          {/* 검색 입력 */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-card-border">
            <svg className="w-5 h-5 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="섹터명, 종목명, 종목코드 검색..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-muted hover:text-foreground text-xs"
              >
                지우기
              </button>
            )}
          </div>

          {/* 검색 결과 */}
          <div className="max-h-[60vh] overflow-y-auto">
            {q.length === 0 && (
              <div>
                {/* 즐겨찾기 섹터 */}
                {favs.sectors.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-[10px] text-muted font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50">
                      즐겨찾기 업종
                    </div>
                    {sectors.filter((s) => favs.sectors.includes(s.code)).map((s) => (
                      <div key={s.code} className="flex items-center">
                        <button
                          onClick={() => {
                            onSectorClick(s.code, s.name);
                            onClose();
                          }}
                          className="flex-1 flex items-center justify-between px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
                        >
                          <span className="text-sm font-medium">{s.name}</span>
                          <span className={`text-sm font-bold font-mono ml-2 ${rateColor(s.changeRate)}`}>
                            {s.changeRate >= 0 ? "+" : ""}{s.changeRate.toFixed(2)}%
                          </span>
                        </button>
                        <button
                          onClick={() => setFavs(toggleFavoriteSector(s.code))}
                          className="px-2 text-yellow-500 hover:text-yellow-600"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* 즐겨찾기 종목 */}
                {favs.stocks.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-[10px] text-muted font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50">
                      즐겨찾기 종목
                    </div>
                    {stocks.filter((s) => favs.stocks.includes(s.code)).map((s) => (
                      <div key={s.code} className="flex items-center">
                        <button
                          onClick={() => setSelectedStock(s)}
                          className="flex-1 flex items-center justify-between px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium">{s.name}</span>
                            <span className="text-[10px] text-muted ml-1.5">{s.code}</span>
                          </div>
                          <span className={`text-sm font-bold font-mono ml-2 ${rateColor(s.changeRate)}`}>
                            {s.changeRate >= 0 ? "+" : ""}{s.changeRate.toFixed(2)}%
                          </span>
                        </button>
                        <button
                          onClick={() => setFavs(toggleFavoriteStock(s.code))}
                          className="px-2 text-yellow-500 hover:text-yellow-600"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* 안내 */}
                <div className="px-4 py-6 text-center text-sm text-muted">
                  업종 79개 · 종목 {stocks.length.toLocaleString()}개 검색 가능
                </div>
              </div>
            )}

            {q.length > 0 && !hasResults && (
              <div className="px-4 py-8 text-center text-sm text-muted">
                &ldquo;{query}&rdquo; 검색 결과 없음
              </div>
            )}

            {/* 섹터 결과 */}
            {results.sectors.length > 0 && (
              <div>
                <div className="px-4 py-2 text-[10px] text-muted font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50">
                  업종 ({results.sectors.length})
                </div>
                {results.sectors.map((s) => (
                  <div key={s.code} className="flex items-center">
                    <button
                      onClick={() => {
                        onSectorClick(s.code, s.name);
                        onClose();
                      }}
                      className="flex-1 flex items-center justify-between px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium">{s.name}</span>
                        {s.status !== "normal" && (
                          <span className="ml-1.5 text-[10px] text-muted">
                            {s.statusLabel}
                          </span>
                        )}
                      </div>
                      <span className={`text-sm font-bold font-mono ml-2 ${rateColor(s.changeRate)}`}>
                        {s.changeRate >= 0 ? "+" : ""}{s.changeRate.toFixed(2)}%
                      </span>
                    </button>
                    <button
                      onClick={() => setFavs(toggleFavoriteSector(s.code))}
                      className={`px-2 ${favs.sectors.includes(s.code) ? "text-yellow-500" : "text-slate-300 dark:text-slate-600"} hover:text-yellow-500`}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 종목 결과 */}
            {results.stocks.length > 0 && (
              <div>
                <div className="px-4 py-2 text-[10px] text-muted font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50">
                  종목 ({results.stocks.length})
                </div>
                {results.stocks.map((s) => (
                  <div key={s.code} className="flex items-center">
                    <button
                      onClick={() => setSelectedStock(s)}
                      className="flex-1 flex items-center justify-between px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">{s.name}</span>
                          <span className="text-[10px] text-muted">{s.code}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted">
                            시총 {formatMarketCap(s.marketCap)}
                          </span>
                          {s.sectorName && (
                            <span className="text-[10px] text-blue-500">
                              {s.sectorName}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`text-sm font-bold font-mono ml-2 ${rateColor(s.changeRate)}`}>
                        {s.changeRate >= 0 ? "+" : ""}{s.changeRate.toFixed(2)}%
                      </span>
                    </button>
                    <button
                      onClick={() => setFavs(toggleFavoriteStock(s.code))}
                      className={`px-2 ${favs.stocks.includes(s.code) ? "text-yellow-500" : "text-slate-300 dark:text-slate-600"} hover:text-yellow-500`}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedStock && (
        <StockDetailPanel
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          onSectorClick={onSectorClick}
        />
      )}
    </div>
  );
}
