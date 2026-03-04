"use client";

import type { SectorAnalysis } from "@/lib/analysis";

const statusConfig: Record<
  string,
  { bg: string; badge: string; icon: string }
> = {
  crash: {
    bg: "bg-red-50 border-red-200",
    badge: "bg-red-600 text-white",
    icon: "🔻",
  },
  contrarian_drop: {
    bg: "bg-orange-50 border-orange-200",
    badge: "bg-orange-500 text-white",
    icon: "⚠️",
  },
  underperform: {
    bg: "bg-yellow-50 border-yellow-200",
    badge: "bg-yellow-500 text-white",
    icon: "📉",
  },
  surge: {
    bg: "bg-green-50 border-green-200",
    badge: "bg-green-600 text-white",
    icon: "🔺",
  },
  contrarian_rise: {
    bg: "bg-emerald-50 border-emerald-200",
    badge: "bg-emerald-500 text-white",
    icon: "🚀",
  },
  outperform: {
    bg: "bg-teal-50 border-teal-200",
    badge: "bg-teal-500 text-white",
    icon: "📈",
  },
  normal: { bg: "", badge: "", icon: "" },
};

export default function AlertBanner({
  alerts,
  onSectorClick,
}: {
  alerts: SectorAnalysis[];
  onSectorClick?: (code: string, name: string) => void;
}) {
  if (alerts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
        <p className="text-green-800 font-medium text-center">
          현재 특이 섹터 없음 - 모든 섹터가 정상 범위 내에서 움직이고 있습니다
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-6">
      <h2 className="text-lg font-bold">
        특이 섹터 ({alerts.length}개)
      </h2>
      {alerts.map((alert) => {
        const config = statusConfig[alert.status];
        return (
          <div
            key={alert.code}
            onClick={() => onSectorClick?.(alert.code, alert.name)}
            className={`border rounded-xl p-4 cursor-pointer hover:brightness-95 active:brightness-90 transition ${config.bg}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{config.icon}</span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${config.badge}`}
              >
                {alert.statusLabel}
              </span>
            </div>
            <p className="font-bold text-lg">{alert.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xl font-bold ${
                  alert.changeRate >= 0 ? "text-red-600" : "text-blue-600"
                }`}
              >
                {alert.changeRate >= 0 ? "+" : ""}
                {alert.changeRate.toFixed(2)}%
              </span>
            </div>
            {alert.reason && (
              <p className="text-sm text-gray-600 mt-2">{alert.reason}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
