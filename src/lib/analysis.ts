import type { SectorData, IndexPrice, IndexInfo } from "./krx";

export type SectorStatus =
  | "normal"
  | "crash"
  | "underperform"
  | "contrarian_drop";

export interface SectorAnalysis {
  code: string;
  name: string;
  changeRate: number; // 오늘 등락률 (%)
  status: SectorStatus;
  statusLabel: string;
  reason: string;
}

export interface IndexAnalysis {
  code: string;
  name: string;
  market: string;
  closePrice: number;
  changeRate: number; // 전일 대비 등락률 (%)
  weekReturn: number | null;
  monthReturn: number | null;
}

export interface AnalysisResult {
  sectors: SectorAnalysis[];
  alerts: SectorAnalysis[];
  indices: IndexAnalysis[];
  avgSectorReturn: number;
  medianSectorReturn: number;
  lastUpdated: string;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(
    arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1)
  );
}

function zScore(value: number, arr: number[]): number {
  const s = stddev(arr);
  if (s === 0) return 0;
  return (value - mean(arr)) / s;
}

const STATUS_LABELS: Record<SectorStatus, string> = {
  normal: "정상",
  crash: "급락",
  underperform: "부진",
  contrarian_drop: "역행 하락",
};

export function analyzeSectors(
  sectors: SectorData[],
  majorIndices: {
    info: IndexInfo;
    latest: IndexPrice;
    prev: IndexPrice | null;
    weekAgo: IndexPrice | null;
    monthAgo: IndexPrice | null;
  }[]
): AnalysisResult {
  const rates = sectors.map((s) => s.changeRate);
  const avgReturn = mean(rates);
  const medReturn = median(rates);
  const sd = stddev(rates);

  const analyzed: SectorAnalysis[] = sectors.map((s) => {
    let status: SectorStatus = "normal";
    let reason = "";

    const z = sd > 0 ? (s.changeRate - avgReturn) / sd : 0;

    // 1. 급락: 평균 대비 2%p 이상 추가 하락, 또는 Z-score < -2
    if (s.changeRate < avgReturn - 2 || z < -2) {
      status = "crash";
      reason = `등락률 ${s.changeRate.toFixed(2)}% (평균 ${avgReturn.toFixed(2)}%, z=${z.toFixed(1)})`;
    }

    // 2. 역행 하락: 평균이 양수인데 혼자 크게 하락
    if (
      status === "normal" &&
      avgReturn > 0 &&
      s.changeRate < -0.5 &&
      Math.abs(s.changeRate - avgReturn) > 1.5
    ) {
      status = "contrarian_drop";
      reason = `시장 평균 +${avgReturn.toFixed(2)}%인데 ${s.changeRate.toFixed(2)}%`;
    }

    // 3. 부진: Z-score < -1.5
    if (status === "normal" && z < -1.5) {
      status = "underperform";
      reason = `등락률 ${s.changeRate.toFixed(2)}% (평균 ${avgReturn.toFixed(2)}%, z=${z.toFixed(1)})`;
    }

    return {
      code: s.code,
      name: s.name,
      changeRate: s.changeRate,
      status,
      statusLabel: STATUS_LABELS[status],
      reason,
    };
  });

  // 등락률 오름차순 정렬
  analyzed.sort((a, b) => a.changeRate - b.changeRate);

  const alerts = analyzed
    .filter((s) => s.status !== "normal")
    .sort((a, b) => {
      const priority: Record<SectorStatus, number> = {
        crash: 0,
        contrarian_drop: 1,
        underperform: 2,
        normal: 3,
      };
      const p = priority[a.status] - priority[b.status];
      if (p !== 0) return p;
      return a.changeRate - b.changeRate; // 같은 상태면 등락률 낮은 순
    })
    .slice(0, 10); // 상위 10개만

  // 주요 지수 분석
  const indices: IndexAnalysis[] = majorIndices.map(
    ({ info, latest, prev, weekAgo, monthAgo }) => {
      const changeRate =
        prev && prev.close > 0
          ? ((latest.close - prev.close) / prev.close) * 100
          : 0;
      const weekReturn =
        weekAgo && weekAgo.close > 0
          ? ((latest.close - weekAgo.close) / weekAgo.close) * 100
          : null;
      const monthReturn =
        monthAgo && monthAgo.close > 0
          ? ((latest.close - monthAgo.close) / monthAgo.close) * 100
          : null;

      return {
        code: info.code,
        name: info.name,
        market: info.market,
        closePrice: latest.close,
        changeRate,
        weekReturn,
        monthReturn,
      };
    }
  );

  return {
    sectors: analyzed,
    alerts,
    indices,
    avgSectorReturn: avgReturn,
    medianSectorReturn: medReturn,
    lastUpdated: new Date().toISOString(),
  };
}
