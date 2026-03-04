"use client";

import { useEffect, useState } from "react";
import AlertBanner from "@/components/AlertBanner";
import SectorTable from "@/components/SectorTable";
import PerformanceChart from "@/components/PerformanceChart";
import IndexCards from "@/components/IndexCards";
import SectorDetail from "@/components/SectorDetail";
import type { AnalysisResult } from "@/lib/analysis";

export default function Home() {
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<{
    code: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/sectors")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error || "데이터를 불러올 수 없습니다.");
        }
      })
      .catch(() => setError("서버에 연결할 수 없습니다."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">데이터 불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md w-full text-center">
          <p className="text-red-600 font-bold text-lg mb-2">오류 발생</p>
          <p className="text-red-500 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
          >
            다시 시도
          </button>
        </div>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 pb-20">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">KRX 섹터 모니터</h1>
        <p className="text-sm text-gray-500 mt-1">
          평균 업종 등락률:{" "}
          <span
            className={`font-bold ${
              data.avgSectorReturn >= 0 ? "text-red-600" : "text-blue-600"
            }`}
          >
            {data.avgSectorReturn >= 0 ? "+" : ""}
            {data.avgSectorReturn.toFixed(2)}%
          </span>
          {" / "}
          중위값:{" "}
          <span
            className={`font-bold ${
              data.medianSectorReturn >= 0 ? "text-red-600" : "text-blue-600"
            }`}
          >
            {data.medianSectorReturn >= 0 ? "+" : ""}
            {data.medianSectorReturn.toFixed(2)}%
          </span>
        </p>
      </div>

      {/* 경고 배너 */}
      <AlertBanner
        alerts={data.alerts}
        onSectorClick={(code, name) => setSelectedSector({ code, name })}
      />

      {/* 주요 지수 */}
      <IndexCards indices={data.indices} />

      {/* 등락률 차트 */}
      <PerformanceChart
        sectors={data.sectors}
        onSectorClick={(code, name) => setSelectedSector({ code, name })}
      />

      {/* 업종 테이블 */}
      <SectorTable
        sectors={data.sectors}
        onSectorClick={(code, name) => setSelectedSector({ code, name })}
      />

      {/* 섹터 상세 모달 */}
      {selectedSector && (
        <SectorDetail
          sectorCode={selectedSector.code}
          sectorName={selectedSector.name}
          onClose={() => setSelectedSector(null)}
        />
      )}

      {/* 하단 정보 */}
      <div className="text-xs text-gray-400 text-center mt-8 space-y-1">
        <p>데이터 출처: 네이버 금융 (finance.naver.com)</p>
        <p>
          급락: Z &lt; -2 | 급등: Z &gt; 2 | 역행하락/상승: 시장과 반대 |
          부진/강세: |Z| &gt; 1.5
        </p>
        <p>
          마지막 업데이트:{" "}
          {new Date(data.lastUpdated).toLocaleString("ko-KR")}
        </p>
      </div>
    </main>
  );
}
