"use client";

import { useState, useMemo } from "react";
import type { EtfGapData } from "@/lib/krx";

const rateColor = (v: number) =>
  v >= 0
    ? "text-red-600 dark:text-red-400"
    : "text-blue-600 dark:text-blue-400";

function formatMcap(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(1)}조`;
  return `${v.toLocaleString()}억`;
}

type SortKey = "gapOpen" | "gapClose" | "recovery" | "marketCap";

export default function EtfGapTable({ etfs }: { etfs: EtfGapData[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("gapOpen");
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let list = etfs;
    if (q) {
      list = etfs.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.code.includes(q) ||
          e.trackingIndex.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortKey === "gapOpen") return Math.abs(b.todayGapOpen) - Math.abs(a.todayGapOpen);
      if (sortKey === "gapClose") return Math.abs(b.todayGapClose) - Math.abs(a.todayGapClose);
      if (sortKey === "recovery") return b.avgRecovery - a.avgRecovery;
      return b.marketCap - a.marketCap;
    });
  }, [etfs, sortKey, filter]);

  if (etfs.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-2xl p-8 text-center text-muted">
        ETF 데이터를 가져올 수 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 설명 카드 */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
        <h2 className="font-bold text-base mb-1.5">ETF 갭 트레이딩 모니터</h2>
        <p className="text-xs text-muted leading-relaxed">
          한국상장 미국 추종 ETF의 <span className="font-bold">시가-NAV 괴리율</span>(밤사이 미국장 변동이 시가에 얼마나 반영됐는지)과
          최근 30일 <span className="font-bold">갭 회복 패턴</span>(시가갭이 종가까지 얼마나 줄어드는지)을 보여줍니다.
        </p>
        <ul className="text-[11px] text-muted mt-2 space-y-0.5">
          <li>• <span className="font-bold">시가갭</span>: 오늘 시가 vs 전일 NAV (단일가매매 결과)</li>
          <li>• <span className="font-bold">종가갭</span>: 오늘 종가 vs 오늘 NAV</li>
          <li>• <span className="font-bold">회복</span>: |시가갭| - |종가갭| 30일 평균 + 갭 축소된 일수 비율</li>
        </ul>
      </div>

      {/* 컨트롤 */}
      <div className="bg-card border border-card-border rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="ETF명 / 추종지수 검색"
          className="flex-1 min-w-[180px] bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-sm outline-none placeholder:text-muted"
        />
        <div className="flex gap-1">
          {([
            ["gapOpen", "시가갭"],
            ["gapClose", "종가갭"],
            ["recovery", "회복폭"],
            ["marketCap", "시총"],
          ] as [SortKey, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`px-2.5 py-1 text-[11px] rounded-md transition ${
                sortKey === k
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-muted hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 px-3 py-2 text-[10px] font-bold text-muted uppercase border-b border-card-border bg-slate-50 dark:bg-slate-800/50">
          <div className="col-span-5">ETF / 추종지수</div>
          <div className="col-span-2 text-right">시가갭</div>
          <div className="col-span-2 text-right">종가갭</div>
          <div className="col-span-3 text-right">30일 회복</div>
        </div>
        {filtered.map((e) => (
          <div
            key={e.code}
            className="grid grid-cols-12 px-3 py-2.5 border-b border-card-border last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
          >
            <div className="col-span-5 min-w-0">
              <div className="text-sm font-medium truncate">{e.name}</div>
              <div className="flex items-center gap-2 text-[10px] text-muted">
                <span>{e.code}</span>
                {e.trackingIndex && <span className="truncate">{e.trackingIndex}</span>}
                <span>{formatMcap(e.marketCap)}</span>
              </div>
            </div>
            <div className={`col-span-2 text-right text-sm font-bold font-mono ${rateColor(e.todayGapOpen)}`}>
              {e.todayGapOpen >= 0 ? "+" : ""}{e.todayGapOpen.toFixed(2)}%
            </div>
            <div className={`col-span-2 text-right text-sm font-bold font-mono ${rateColor(e.todayGapClose)}`}>
              {e.todayGapClose >= 0 ? "+" : ""}{e.todayGapClose.toFixed(2)}%
            </div>
            <div className="col-span-3 text-right">
              <div className={`text-sm font-bold font-mono ${e.avgRecovery > 0 ? "text-green-600 dark:text-green-400" : "text-muted"}`}>
                {e.avgRecovery >= 0 ? "+" : ""}{e.avgRecovery.toFixed(2)}%p
              </div>
              <div className="text-[10px] text-muted">
                {e.recoveryDays}/{e.totalDays}일 ({e.recoveryRate.toFixed(0)}%)
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted">
            검색 결과가 없습니다.
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted text-center">
        * 데이터: KRX ETF 일별 통계 · 6시간 캐시 · 시가는 단일가매매(08:30~09:00) 결과 반영
      </p>
    </div>
  );
}
