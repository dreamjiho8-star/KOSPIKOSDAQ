"use client";

import { useEffect, useState, useCallback } from "react";
import AlertBanner from "@/components/AlertBanner";
import SectorTable from "@/components/SectorTable";
import PerformanceChart from "@/components/PerformanceChart";
import IndexCards from "@/components/IndexCards";
import SectorDetail from "@/components/SectorDetail";
import InvestorTrends from "@/components/InvestorTrends";
import MarketBreadth from "@/components/MarketBreadth";
import SectorHeatmap from "@/components/SectorHeatmap";
import type { AnalysisResult } from "@/lib/analysis";

type Tab = "overview" | "sectors" | "investors";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "시장 현황", icon: "📊" },
  { key: "sectors", label: "업종 분석", icon: "📋" },
  { key: "investors", label: "수급 동향", icon: "💰" },
];

export default function Home() {
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedSector, setSelectedSector] = useState<{
    code: string;
    name: string;
  } | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(() => {
    fetch("/api/sectors")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setData(json.data);
          setLastRefresh(new Date());
        } else {
          setError(json.error || "데이터를 불러올 수 없습니다.");
        }
      })
      .catch(() => setError("서버에 연결할 수 없습니다."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    // 5분마다 자동 새로고침
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const openSector = (code: string, name: string) =>
    setSelectedSector({ code, name });

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted text-sm">시장 데이터 불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-card border border-card-border rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="font-bold text-lg mb-2">데이터 로딩 실패</p>
          <p className="text-muted text-sm mb-4">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); fetchData(); }}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition"
          >
            다시 시도
          </button>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const upCount = data.sectors.filter((s) => s.changeRate > 0).length;
  const downCount = data.sectors.filter((s) => s.changeRate < 0).length;
  const flatCount = data.sectors.length - upCount - downCount;

  return (
    <div className="min-h-screen pb-20 sm:pb-6">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-40 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-card-border">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">
                KRX 섹터 모니터
              </h1>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-muted">
                  평균{" "}
                  <span
                    className={`font-bold ${
                      data.avgSectorReturn >= 0
                        ? "text-red-500 dark:text-red-400"
                        : "text-blue-500 dark:text-blue-400"
                    }`}
                  >
                    {data.avgSectorReturn >= 0 ? "+" : ""}
                    {data.avgSectorReturn.toFixed(2)}%
                  </span>
                </span>
                <span className="text-[10px] text-muted">
                  상승 {upCount} · 보합 {flatCount} · 하락 {downCount}
                </span>
              </div>
            </div>
            <div className="text-right">
              {lastRefresh && (
                <p className="text-[10px] text-muted">
                  {lastRefresh.toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  업데이트
                </p>
              )}
              <button
                onClick={() => { setLoading(false); fetchData(); }}
                className="text-xs text-blue-500 hover:text-blue-600 font-medium mt-0.5"
              >
                새로고침
              </button>
            </div>
          </div>

          {/* 탭 네비게이션 - 데스크톱 */}
          <nav className="hidden sm:flex gap-1 mt-3">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                  tab === t.key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-muted hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-5xl mx-auto px-4 py-5">
        {tab === "overview" && (
          <div className="space-y-5">
            <AlertBanner alerts={data.alerts} onSectorClick={openSector} />
            <IndexCards indices={data.indices} />
            <MarketBreadth sectors={data.sectors} />
            <SectorHeatmap sectors={data.sectors} onSectorClick={openSector} />
          </div>
        )}

        {tab === "sectors" && (
          <div className="space-y-5">
            <PerformanceChart sectors={data.sectors} onSectorClick={openSector} />
            <SectorTable sectors={data.sectors} onSectorClick={openSector} />
          </div>
        )}

        {tab === "investors" && (
          <div className="space-y-5">
            <InvestorTrends onSectorClick={openSector} />
          </div>
        )}

        {/* 하단 정보 */}
        <footer className="text-[10px] text-muted text-center mt-10 space-y-0.5">
          <p>데이터 출처: 네이버 금융 · 5분마다 자동 갱신</p>
          <p>
            급락: Z&lt;-2 · 급등: Z&gt;2 · 역행: 시장 반대 · 부진/강세:
            |Z|&gt;1.5
          </p>
          <p>
            마지막 데이터:{" "}
            {new Date(data.lastUpdated).toLocaleString("ko-KR")}
          </p>
        </footer>
      </main>

      {/* 하단 탭바 - 모바일 */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-card/90 backdrop-blur-xl border-t border-card-border z-40">
        <div className="flex">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-center transition ${
                tab === t.key
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted"
              }`}
            >
              <div className="text-lg">{t.icon}</div>
              <div
                className={`text-[10px] mt-0.5 ${
                  tab === t.key ? "font-bold" : ""
                }`}
              >
                {t.label}
              </div>
            </button>
          ))}
        </div>
      </nav>

      {/* 섹터 상세 모달 */}
      {selectedSector && (
        <SectorDetail
          sectorCode={selectedSector.code}
          sectorName={selectedSector.name}
          onClose={() => setSelectedSector(null)}
        />
      )}
    </div>
  );
}
