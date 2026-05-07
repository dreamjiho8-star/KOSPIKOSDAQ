"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import type { EtfGapData } from "@/lib/krx";

const rateColor = (v: number) =>
  v >= 0
    ? "text-red-600 dark:text-red-400"
    : "text-blue-600 dark:text-blue-400";

function formatMcap(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(1)}조`;
  return `${v.toLocaleString()}억`;
}

function naverUrl(code: string): string {
  return `https://finance.naver.com/item/main.naver?code=${code}`;
}

type SortKey = "gapOpen" | "gapClose" | "recovery" | "marketCap";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 10;

// ETF 이름에서 운용사 추출 (첫 단어)
function extractManager(name: string): string {
  return name.split(/\s+/)[0];
}

// 추종지수 단순화 (그룹화용)
function simplifyIndex(idx: string): string {
  if (!idx) return "기타";
  return idx.replace(/\s+/g, "");
}

// 드롭다운 컴포넌트
function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, number][];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const displayLabel =
    value === "ALL" ? "전체" : `${value} (${options.find((o) => o[0] === value)?.[1] ?? 0})`;

  return (
    <div ref={ref} className="relative flex-1 min-w-[160px]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg text-sm transition"
      >
        <span className="text-[10px] text-muted shrink-0">{label}</span>
        <span className="flex-1 text-left truncate font-medium">{displayLabel}</span>
        <svg
          className={`w-3.5 h-3.5 text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-card-border rounded-lg shadow-lg z-30 max-h-72 overflow-y-auto">
          <button
            onClick={() => { onChange("ALL"); setOpen(false); }}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition ${
              value === "ALL" ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold" : ""
            }`}
          >
            <span>전체</span>
          </button>
          {options.map(([k, count]) => (
            <button
              key={k}
              onClick={() => { onChange(k); setOpen(false); }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition ${
                value === k ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold" : ""
              }`}
            >
              <span className="truncate text-left">{k}</span>
              <span className="text-[10px] text-muted shrink-0">{count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EtfGapTable({ etfs }: { etfs: EtfGapData[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("gapOpen");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filter, setFilter] = useState("");
  const [manager, setManager] = useState<string>("ALL");
  const [trackIdx, setTrackIdx] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  // 운용사 / 추종지수 옵션
  const { managers, indices } = useMemo(() => {
    const mgrCount = new Map<string, number>();
    const idxCount = new Map<string, number>();
    for (const e of etfs) {
      const m = extractManager(e.name);
      mgrCount.set(m, (mgrCount.get(m) || 0) + 1);
      const i = simplifyIndex(e.trackingIndex);
      idxCount.set(i, (idxCount.get(i) || 0) + 1);
    }
    const sortByCount = (a: [string, number], b: [string, number]) => b[1] - a[1];
    return {
      managers: Array.from(mgrCount.entries()).sort(sortByCount),
      indices: Array.from(idxCount.entries()).sort(sortByCount),
    };
  }, [etfs]);

  // 필터링 + 정렬
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let list = etfs;

    if (manager !== "ALL") {
      list = list.filter((e) => extractManager(e.name) === manager);
    }
    if (trackIdx !== "ALL") {
      list = list.filter((e) => simplifyIndex(e.trackingIndex) === trackIdx);
    }
    if (q) {
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.code.includes(q) ||
          e.trackingIndex.toLowerCase().includes(q)
      );
    }

    const dir = sortDir === "desc" ? -1 : 1;
    return [...list].sort((a, b) => {
      let diff = 0;
      if (sortKey === "gapOpen") diff = a.todayGapOpen - b.todayGapOpen;
      else if (sortKey === "gapClose") diff = a.todayGapClose - b.todayGapClose;
      else if (sortKey === "recovery") diff = a.avgRecovery - b.avgRecovery;
      else diff = a.marketCap - b.marketCap;
      return diff * dir;
    });
  }, [etfs, sortKey, sortDir, filter, manager, trackIdx]);

  // 매수 시그널: 시가갭 < 0 + 30일 회복폭 > 0
  // 시가갭 작은 순(가장 음수=매수매력 큼) 정렬, 최대 10개
  const buySignals = useMemo(() => {
    return etfs
      .filter((e) => e.todayGapOpen < 0 && e.avgRecovery > 0)
      .sort((a, b) => a.todayGapOpen - b.todayGapOpen)
      .slice(0, 10);
  }, [etfs]);

  // 필터/정렬 바뀌면 1페이지로 리셋
  useEffect(() => {
    setPage(1);
  }, [filter, manager, trackIdx, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (etfs.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-2xl p-8 text-center text-muted">
        ETF 데이터를 가져올 수 없습니다.
      </div>
    );
  }

  // 정렬 버튼 클릭 시: 같은 키면 방향 토글, 다른 키면 desc로 시작
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortDir === "desc" ? " ↓" : " ↑";
  };

  // 페이지 번호 표시 로직 (앞뒤 2개씩 + ...)
  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];
    const range = 1;
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("...");
      for (let i = Math.max(2, safePage - range); i <= Math.min(totalPages - 1, safePage + range); i++) {
        pages.push(i);
      }
      if (safePage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [safePage, totalPages]);

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

      {/* 매수 시그널 카드 */}
      <div className="bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-green-200 dark:border-green-800">
          <h3 className="font-bold text-base text-green-700 dark:text-green-400">
            🎯 매수 시그널 후보 ({buySignals.length})
          </h3>
          <p className="text-[11px] text-muted mt-0.5">
            시가가 NAV보다 저평가(디스카운트) + 30일 평균 갭 축소 경향 → 장중 회복으로 차익 가능
          </p>
        </div>

        {buySignals.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">
            현재 조건을 만족하는 ETF가 없습니다.
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-12 px-3 py-2 text-[10px] font-bold text-muted uppercase border-b border-green-200 dark:border-green-800 bg-green-100/50 dark:bg-green-900/20">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-4">ETF / 추종지수</div>
              <div className="col-span-1 text-right">시가총액</div>
              <div className="col-span-2 text-right">시가갭</div>
              <div className="col-span-2 text-right">회복폭</div>
              <div className="col-span-2 text-right">회복비율</div>
            </div>
            {buySignals.map((e, i) => (
              <div
                key={e.code}
                className="grid grid-cols-12 px-3 py-2.5 border-b border-green-200/50 dark:border-green-800/50 last:border-b-0 hover:bg-green-100/40 dark:hover:bg-green-900/20 transition items-center"
              >
                <div className="col-span-1 text-center text-xs font-bold text-green-700 dark:text-green-400">
                  {i + 1}
                </div>
                <div className="col-span-4 min-w-0">
                  <a
                    href={naverUrl(e.code)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium truncate block hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                  >
                    {e.name}
                  </a>
                  <div className="flex items-center gap-2 text-[10px] text-muted whitespace-nowrap">
                    <span className="shrink-0">{e.code}</span>
                    {e.trackingIndex && (
                      <span className="truncate min-w-0">{e.trackingIndex}</span>
                    )}
                  </div>
                </div>
                <div className="col-span-1 text-right text-xs font-mono text-muted whitespace-nowrap">
                  {formatMcap(e.marketCap)}
                </div>
                <div className="col-span-2 text-right text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                  {e.todayGapOpen.toFixed(2)}%
                </div>
                <div className="col-span-2 text-right text-sm font-bold font-mono text-green-600 dark:text-green-400">
                  +{e.avgRecovery.toFixed(2)}%p
                </div>
                <div className="col-span-2 text-right">
                  <div className="text-sm font-bold font-mono">
                    {e.recoveryRate.toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-muted">
                    {e.recoveryDays}/{e.totalDays}일
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 컨트롤 */}
      <div className="bg-card border border-card-border rounded-2xl p-3 space-y-2">
        {/* 검색창 */}
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="ETF명 / 종목코드 / 추종지수 검색"
          className="w-full bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-sm outline-none placeholder:text-muted"
        />

        {/* 운용사 / 추종지수 드롭다운 */}
        <div className="flex flex-wrap gap-2">
          <FilterDropdown
            label="운용사"
            value={manager}
            options={managers}
            onChange={setManager}
          />
          <FilterDropdown
            label="추종지수"
            value={trackIdx}
            options={indices}
            onChange={setTrackIdx}
          />
        </div>

        {/* 정렬 버튼 */}
        <div className="flex items-center gap-2 pt-1 border-t border-card-border">
          <span className="text-[10px] font-bold text-muted shrink-0 w-12">정렬</span>
          <div className="flex flex-wrap gap-1">
            {([
              ["gapOpen", "시가갭"],
              ["gapClose", "종가갭"],
              ["recovery", "회복폭"],
              ["marketCap", "시총"],
            ] as [SortKey, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => handleSort(k)}
                className={`px-2.5 py-1 text-[11px] rounded-md transition ${
                  sortKey === k
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-muted hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {label}{sortIcon(k)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 결과 카운트 */}
      <div className="text-[11px] text-muted px-1">
        총 {filtered.length}개 · {safePage}/{totalPages} 페이지
      </div>

      {/* 테이블 */}
      <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 px-3 py-2 text-[10px] font-bold text-muted uppercase border-b border-card-border bg-slate-50 dark:bg-slate-800/50">
          <div className="col-span-4">ETF / 추종지수</div>
          <div className="col-span-1 text-right">시가총액</div>
          <div className="col-span-2 text-right">시가갭</div>
          <div className="col-span-2 text-right">종가갭</div>
          <div className="col-span-3 text-right">30일 회복</div>
        </div>
        {pageItems.map((e) => (
          <div
            key={e.code}
            className="grid grid-cols-12 px-3 py-2.5 border-b border-card-border last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition items-center"
          >
            <div className="col-span-4 min-w-0">
              <a
                href={naverUrl(e.code)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium truncate block hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
              >
                {e.name}
              </a>
              <div className="flex items-center gap-2 text-[10px] text-muted whitespace-nowrap">
                <span className="shrink-0">{e.code}</span>
                {e.trackingIndex && (
                  <span className="truncate min-w-0">{e.trackingIndex}</span>
                )}
              </div>
            </div>
            <div className="col-span-1 text-right text-xs font-mono text-muted whitespace-nowrap">
              {formatMcap(e.marketCap)}
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
            조건에 맞는 ETF가 없습니다.
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setPage(safePage - 1)}
            disabled={safePage === 1}
            className="px-2.5 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-muted hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            ‹
          </button>
          {pageNumbers.map((p, idx) =>
            p === "..." ? (
              <span key={`ellip-${idx}`} className="px-1.5 text-xs text-muted">…</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`min-w-[28px] px-2 py-1 text-xs rounded-md transition ${
                  safePage === p
                    ? "bg-blue-600 text-white font-bold"
                    : "bg-slate-100 dark:bg-slate-800 text-muted hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => setPage(safePage + 1)}
            disabled={safePage === totalPages}
            className="px-2.5 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-muted hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            ›
          </button>
        </div>
      )}

      <p className="text-[10px] text-muted text-center">
        * 데이터: KRX ETF 일별 통계 · 6시간 캐시 · 시가는 단일가매매(08:30~09:00) 결과 반영
      </p>
    </div>
  );
}
