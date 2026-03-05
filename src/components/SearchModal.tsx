"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { SectorAnalysis } from "@/lib/analysis";
import type { TopStock } from "@/lib/krx";

const rateColor = (v: number) =>
  v >= 0
    ? "text-red-600 dark:text-red-400"
    : "text-blue-600 dark:text-blue-400";

function formatMarketCap(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(1)}조`;
  return `${v.toLocaleString()}억`;
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
              <div className="px-4 py-8 text-center text-sm text-muted">
                업종 79개 · 종목 {stocks.length.toLocaleString()}개 검색 가능
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
                  <button
                    key={s.code}
                    onClick={() => {
                      onSectorClick(s.code, s.name);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
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
                  <div
                    key={s.code}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium">{s.name}</span>
                        <span className="text-[10px] text-muted">{s.code}</span>
                      </div>
                      <span className="text-[10px] text-muted">
                        시총 {formatMarketCap(s.marketCap)}
                      </span>
                    </div>
                    <span className={`text-sm font-bold font-mono ml-2 ${rateColor(s.changeRate)}`}>
                      {s.changeRate >= 0 ? "+" : ""}{s.changeRate.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
