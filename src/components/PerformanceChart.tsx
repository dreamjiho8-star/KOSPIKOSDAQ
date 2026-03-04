"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import type { SectorAnalysis } from "@/lib/analysis";

export default function PerformanceChart({
  sectors,
}: {
  sectors: SectorAnalysis[];
}) {
  // 하위 15 + 상위 5 = 20개
  const bottom = sectors.slice(0, 15);
  const top = sectors.slice(-5).reverse();
  const data = [...bottom, ...top].map((s) => ({
    name: s.name.length > 8 ? s.name.slice(0, 8) + ".." : s.name,
    value: s.changeRate,
    status: s.status,
    fullName: s.name,
  }));

  if (data.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold mb-3">등락률 상하위</h2>
      <div className="bg-white rounded-xl border p-4">
        <ResponsiveContainer width="100%" height={data.length * 28 + 40}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 0, right: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v) => `${v.toFixed(1)}%`}
              fontSize={11}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              fontSize={11}
              tick={{ fill: "#555" }}
            />
            <Tooltip
              formatter={(value: number | undefined) => {
                const v = value ?? 0;
                return [`${v.toFixed(2)}%`, "등락률"];
              }}
              labelFormatter={(_label, payload) => {
                const item = payload?.[0]?.payload as
                  | { fullName?: string }
                  | undefined;
                return item?.fullName || String(_label);
              }}
            />
            <ReferenceLine x={0} stroke="#666" strokeWidth={1} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.status === "crash"
                      ? "#dc2626"
                      : entry.status === "contrarian_drop"
                      ? "#ea580c"
                      : entry.status === "underperform"
                      ? "#ca8a04"
                      : entry.value >= 0
                      ? "#ef4444"
                      : "#3b82f6"
                  }
                  fillOpacity={entry.status !== "normal" ? 1 : 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
