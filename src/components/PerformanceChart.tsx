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

interface ChartItem {
  name: string;
  value: number;
  status: string;
  fullName: string;
  code: string;
}

function fillColor(entry: { status: string; value: number }) {
  switch (entry.status) {
    case "crash": return "#dc2626";
    case "contrarian_drop": return "#ea580c";
    case "underperform": return "#ca8a04";
    case "surge": return "#16a34a";
    case "contrarian_rise": return "#10b981";
    case "outperform": return "#14b8a6";
    default: return entry.value >= 0 ? "#ef4444" : "#3b82f6";
  }
}

function ChartBox({
  title,
  items,
  onSectorClick,
}: {
  title: string;
  items: ChartItem[];
  onSectorClick?: (code: string, name: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="text-sm font-bold text-gray-600 mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height={items.length * 28 + 20}>
        <BarChart
          data={items}
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
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={(_data, _index, e) => {
              const payload = (_data as unknown as Record<string, string>);
              if (payload?.code && onSectorClick) {
                onSectorClick(payload.code, payload.fullName);
              }
              void e;
            }}
          >
            {items.map((entry, index) => (
              <Cell
                key={index}
                fill={fillColor(entry)}
                fillOpacity={entry.status !== "normal" ? 1 : 0.7}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PerformanceChart({
  sectors,
  onSectorClick,
}: {
  sectors: SectorAnalysis[];
  onSectorClick?: (code: string, name: string) => void;
}) {
  if (sectors.length === 0) return null;

  const toItem = (s: SectorAnalysis): ChartItem => ({
    name: s.name.length > 8 ? s.name.slice(0, 8) + ".." : s.name,
    value: s.changeRate,
    status: s.status,
    fullName: s.name,
    code: s.code,
  });

  // sectors는 등락률 오름차순 정렬되어 있음
  const bottom10 = sectors.slice(0, 10).map(toItem);
  const top10 = sectors.slice(-10).reverse().map(toItem);

  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold mb-3">등락률 상하위</h2>
      <div className="space-y-3">
        <ChartBox
          title="하위 10개"
          items={bottom10}
          onSectorClick={onSectorClick}
        />
        <ChartBox
          title="상위 10개"
          items={top10}
          onSectorClick={onSectorClick}
        />
      </div>
    </div>
  );
}
