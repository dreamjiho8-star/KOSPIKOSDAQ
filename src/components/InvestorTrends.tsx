"use client";

import { useEffect, useState } from "react";
import type { SectorInvestorData } from "@/lib/krx";

interface InvestorTrendsData {
  sectors: SectorInvestorData[];
  lastUpdated: string;
}

function formatOk(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 10000) {
    return `${(value / 10000).toFixed(1)}조`;
  }
  return `${value.toLocaleString()}억`;
}

function RankingBox({
  title,
  items,
  valueKey,
  icon,
  onSectorClick,
}: {
  title: string;
  items: SectorInvestorData[];
  valueKey: "foreignNet" | "institutionNet" | "individualNet";
  icon: string;
  onSectorClick?: (code: string, name: string) => void;
}) {
  const buyTop = [...items]
    .sort((a, b) => b[valueKey] - a[valueKey])
    .slice(0, 5)
    .filter((s) => s[valueKey] > 0);

  const sellTop = [...items]
    .sort((a, b) => a[valueKey] - b[valueKey])
    .slice(0, 5)
    .filter((s) => s[valueKey] < 0);

  return (
    <div className="bg-card border border-card-border rounded-2xl p-4">
      <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5">
        <span>{icon}</span> {title}
      </h3>
      {buyTop.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-muted mb-1 font-medium">순매수 TOP</p>
          <div className="space-y-0.5">
            {buyTop.map((s, i) => (
              <div
                key={s.sectorCode}
                className="flex items-center justify-between py-2 px-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer active:scale-[0.99] transition"
                onClick={() => onSectorClick?.(s.sectorCode, s.sectorName)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted w-4 text-center">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium">{s.sectorName}</span>
                </div>
                <span className="text-sm font-bold text-red-600 dark:text-red-400 font-mono">
                  +{formatOk(s[valueKey])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {sellTop.length > 0 && (
        <div>
          <p className="text-[10px] text-muted mb-1 font-medium">순매도 TOP</p>
          <div className="space-y-0.5">
            {sellTop.map((s, i) => (
              <div
                key={s.sectorCode}
                className="flex items-center justify-between py-2 px-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer active:scale-[0.99] transition"
                onClick={() => onSectorClick?.(s.sectorCode, s.sectorName)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted w-4 text-center">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium">{s.sectorName}</span>
                </div>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono">
                  {formatOk(s[valueKey])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {buyTop.length === 0 && sellTop.length === 0 && (
        <p className="text-sm text-muted text-center py-2">데이터 없음</p>
      )}
    </div>
  );
}

export default function InvestorTrends({
  onSectorClick,
}: {
  onSectorClick?: (code: string, name: string) => void;
}) {
  const [data, setData] = useState<InvestorTrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/investors")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error || "데이터를 불러올 수 없습니다.");
        }
      })
      .catch(() => setError("투자자 데이터를 불러올 수 없습니다."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <h2 className="text-base font-bold mb-3">투자자별 순매수 TOP 섹터</h2>
        <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
          <div className="animate-spin h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-muted">투자자 데이터 분석 중...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <h2 className="text-base font-bold mb-3">투자자별 순매수 TOP 섹터</h2>
        <div className="bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-800 p-4 text-center">
          <p className="text-sm text-red-500">{error || "데이터 없음"}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-base font-bold mb-1">투자자별 순매수 TOP 섹터</h2>
      <p className="text-[10px] text-muted mb-3">
        KOSPI/KOSDAQ 시총 상위 120개 종목 기준 집계
      </p>
      <div className="space-y-3">
        <RankingBox
          title="외국인"
          icon="🌐"
          items={data.sectors}
          valueKey="foreignNet"
          onSectorClick={onSectorClick}
        />
        <RankingBox
          title="기관"
          icon="🏦"
          items={data.sectors}
          valueKey="institutionNet"
          onSectorClick={onSectorClick}
        />
        <RankingBox
          title="개인"
          icon="👤"
          items={data.sectors}
          valueKey="individualNet"
          onSectorClick={onSectorClick}
        />
      </div>
    </div>
  );
}
