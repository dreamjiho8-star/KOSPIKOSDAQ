"use client";

import type { SectorAnalysis } from "@/lib/analysis";

const statusConfig: Record<
  string,
  { bg: string; badge: string; icon: string }
> = {
  crash: {
    bg: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800",
    badge: "bg-red-600 text-white",
    icon: "🔻",
  },
  contrarian_drop: {
    bg: "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800",
    badge: "bg-orange-500 text-white",
    icon: "⚠️",
  },
  underperform: {
    bg: "bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800",
    badge: "bg-yellow-500 text-white",
    icon: "📉",
  },
  surge: {
    bg: "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800",
    badge: "bg-green-600 text-white",
    icon: "🔺",
  },
  contrarian_rise: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
    badge: "bg-emerald-500 text-white",
    icon: "🚀",
  },
  outperform: {
    bg: "bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800",
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
      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-2xl p-4">
        <p className="text-green-800 dark:text-green-300 font-medium text-center text-sm">
          ✅ 모든 섹터가 정상 범위 내에서 움직이고 있습니다
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-base font-bold">
        특이 섹터{" "}
        <span className="text-muted font-normal text-sm">
          {alerts.length}개
        </span>
      </h2>
      {alerts.map((alert) => {
        const config = statusConfig[alert.status];
        return (
          <div
            key={alert.code}
            onClick={() => onSectorClick?.(alert.code, alert.name)}
            className={`border rounded-2xl p-4 cursor-pointer hover:brightness-95 dark:hover:brightness-110 active:scale-[0.99] transition ${config.bg}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{config.icon}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.badge}`}
              >
                {alert.statusLabel}
              </span>
            </div>
            <p className="font-bold text-base">{alert.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xl font-extrabold ${
                  alert.changeRate >= 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-blue-600 dark:text-blue-400"
                }`}
              >
                {alert.changeRate >= 0 ? "+" : ""}
                {alert.changeRate.toFixed(2)}%
              </span>
            </div>
            {alert.reason && (
              <p className="text-xs text-muted mt-2">{alert.reason}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
