"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import AlertBanner from "@/components/AlertBanner";
import SectorTable from "@/components/SectorTable";
import PerformanceChart from "@/components/PerformanceChart";
import IndexCards from "@/components/IndexCards";
import SectorDetail from "@/components/SectorDetail";
import MarketBreadth from "@/components/MarketBreadth";
import SectorHeatmap from "@/components/SectorHeatmap";
import TopStocks from "@/components/TopStocks";
import type { AnalysisResult, Period } from "@/lib/analysis";

function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pulling, setPulling] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const THRESHOLD = 80;

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        isDragging.current = true;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && window.scrollY === 0) {
        setPulling(true);
        setPullY(Math.min(dy * 0.4, 120));
      } else {
        setPulling(false);
        setPullY(0);
      }
    };
    const onTouchEnd = async () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      if (pullY >= THRESHOLD * 0.4) {
        setRefreshing(true);
        setPullY(50);
        try { await onRefresh(); } finally {
          setRefreshing(false);
        }
      }
      setPulling(false);
      setPullY(0);
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullY, refreshing, onRefresh]);

  return { pulling: pulling || refreshing, pullY, refreshing };
}

type Tab = "overview" | "sectors";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "시장 현황", icon: "📊" },
  { key: "sectors", label: "업종 분석", icon: "📋" },
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
  const [dark, setDark] = useState(false);
  const [period, setPeriod] = useState<Period>("1d");

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const fetchData = useCallback((p?: Period) => {
    const q = p ?? period;
    return fetch(`/api/sectors?period=${q}`)
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
  }, [period]);

  const { pulling, pullY, refreshing } = usePullToRefresh(fetchData);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60 * 60 * 1000);
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
    <div className="min-h-screen pb-20 sm:pb-6 overflow-x-hidden">
      {pulling && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-transform duration-200"
          style={{ transform: `translateY(${pullY - 50}px)` }}
        >
          <div className="bg-card border border-card-border rounded-full p-2.5 shadow-lg">
            {refreshing ? (
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            ) : (
              <svg
                className="h-5 w-5 text-muted transition-transform"
                style={{ transform: pullY >= 32 ? "rotate(180deg)" : "rotate(0deg)" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
          </div>
        </div>
      )}
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
            <div className="flex items-center gap-2">
              <button
                onClick={toggleDark}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition text-muted"
                aria-label="다크모드 토글"
              >
                {dark ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
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
          </div>

          <div className="flex items-center justify-between mt-3 gap-3">
            <nav className="hidden sm:flex gap-1">
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
            <div className="flex gap-0.5 bg-slate-200/60 dark:bg-slate-700/60 rounded-lg p-0.5">
              {(["1d", "1w", "1m", "3m", "ytd", "1y"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPeriod(p);
                    setLoading(true);
                    fetchData(p);
                  }}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-md transition ${
                    period === p
                      ? "bg-white dark:bg-slate-600 text-foreground shadow-sm"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">
        {tab === "overview" && (
          <div className="space-y-5">
            <SectorHeatmap sectors={data.sectors} onSectorClick={openSector} />
            <MarketBreadth sectors={data.sectors} vkospi={data.vkospi} />
            <IndexCards indices={data.indices} period={period} />
            <TopStocks stocks={data.topStocks} />
            <AlertBanner alerts={data.alerts} onSectorClick={openSector} />
          </div>
        )}

        {tab === "sectors" && (
          <div className="space-y-5">
            <PerformanceChart sectors={data.sectors} onSectorClick={openSector} />
            <SectorTable sectors={data.sectors} onSectorClick={openSector} />
          </div>
        )}

        <footer className="text-[10px] text-muted text-center mt-10 space-y-0.5">
          <p>데이터 출처: 네이버 금융 · 1시간마다 자동 갱신</p>
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

      {selectedSector && (
        <SectorDetail
          sectorCode={selectedSector.code}
          sectorName={selectedSector.name}
          period={period}
          onClose={() => setSelectedSector(null)}
        />
      )}
    </div>
  );
}
