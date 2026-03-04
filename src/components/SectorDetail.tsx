"use client";

import { useEffect, useState } from "react";
import type { SectorDetailResult } from "@/lib/krx";

interface Props {
  sectorCode: string;
  sectorName: string;
  onClose: () => void;
}

export default function SectorDetail({
  sectorCode,
  sectorName,
  onClose,
}: Props) {
  const [data, setData] = useState<SectorDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
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
    v >= 0 ? "text-red-600" : "text-blue-600";

  const formatRate = (v: number) =>
    `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

  const formatOk = (v: number) => {
    const prefix = v >= 0 ? "+" : "";
    return `${prefix}${v.toLocaleString()}`;
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between rounded-t-2xl sm:rounded-t-xl">
          <h3 className="font-bold text-lg">{sectorName}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-5">
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-gray-400 text-sm">종목 정보 불러오는 중...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          {data && (
            <>
              {/* 시총 상위 5 */}
              <section>
                <h4 className="font-bold text-sm text-gray-700 mb-2">
                  시가총액 상위 5
                </h4>
                <div className="space-y-1.5">
                  {data.topByMarketCap.map((s, i) => (
                    <div
                      key={s.code}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 font-mono w-4">
                            {i + 1}
                          </span>
                          <span className="font-medium text-sm truncate">
                            {s.name}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 ml-6">
                          시총 {s.marketCap.toLocaleString()}억
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="font-mono text-sm font-bold">
                          {s.price.toLocaleString()}
                        </div>
                        <div
                          className={`text-xs font-bold ${rateColor(
                            s.changeRate
                          )}`}
                        >
                          {formatRate(s.changeRate)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 변동률 상위 5 */}
              <section>
                <h4 className="font-bold text-sm text-gray-700 mb-2">
                  등락률 변동 상위 5
                </h4>
                <div className="space-y-1.5">
                  {data.topByVolatility.map((s, i) => (
                    <div
                      key={s.code}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs text-gray-400 font-mono w-4">
                          {i + 1}
                        </span>
                        <span className="font-medium text-sm truncate">
                          {s.name}
                        </span>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="font-mono text-sm font-bold">
                          {s.price.toLocaleString()}
                        </div>
                        <div
                          className={`text-xs font-bold ${rateColor(
                            s.changeRate
                          )}`}
                        >
                          {formatRate(s.changeRate)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 투자자별 매매동향 */}
              <section>
                <div className="flex items-baseline justify-between mb-2">
                  <h4 className="font-bold text-sm text-gray-700">
                    투자자별 매매동향
                  </h4>
                  <span className="text-[10px] text-gray-400">단위 : 억</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "외국인", value: data.investor.foreignNet },
                    { label: "기관", value: data.investor.institutionNet },
                    { label: "개인", value: data.investor.individualNet },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="bg-gray-50 rounded-lg p-3 text-center"
                    >
                      <div className="text-xs text-gray-500 mb-1">{label}</div>
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
                <p className="text-[10px] text-gray-400 mt-1">
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
