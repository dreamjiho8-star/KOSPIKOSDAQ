"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";

interface PricePoint {
  date: string;
  close: number;
}

export default function StockSparkline({ stockCode }: { stockCode: string }) {
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${stockCode}&timeframe=day&count=30&requestType=0`;
    fetch(url)
      .then((res) => res.text())
      .then((xml) => {
        const items = xml.match(/<item data="([^"]+)"/g) || [];
        const points: PricePoint[] = [];
        for (const item of items) {
          const m = item.match(/data="([^"]+)"/);
          if (!m) continue;
          const parts = m[1].split("|");
          if (parts.length >= 5) {
            points.push({
              date: parts[0],
              close: parseFloat(parts[4]),
            });
          }
        }
        setData(points);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [stockCode]);

  if (loading) {
    return (
      <div className="h-16 flex items-center justify-center">
        <div className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded h-12 w-full" />
      </div>
    );
  }

  if (data.length < 2) return null;

  const first = data[0].close;
  const last = data[data.length - 1].close;
  const isUp = last >= first;
  const color = isUp ? "#ef4444" : "#3b82f6";
  const changeRate = ((last - first) / first) * 100;

  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted">30일 추이</span>
        <span className={`text-[10px] font-bold ${isUp ? "text-red-500" : "text-blue-500"}`}>
          {changeRate >= 0 ? "+" : ""}{changeRate.toFixed(1)}%
        </span>
      </div>
      <ResponsiveContainer width="100%" height={60}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`grad-${stockCode}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Area
            type="monotone"
            dataKey="close"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#grad-${stockCode})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
