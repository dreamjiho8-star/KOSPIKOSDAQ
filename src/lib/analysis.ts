import type { SectorData, IndexPrice, IndexInfo, TopStock, VkospiData } from "./krx";

export type Period = "1d" | "1w" | "1m" | "3m" | "ytd" | "1y";

// 기간별 섹터 수익률 계산 (종목 히스토리 기반)
export function computeSectorReturns(
  period: Period,
  topStocks: TopStock[],
  stockSectorMap: Map<string, string>,
  priceHistories: Map<string, IndexPrice[]>
): Map<string, number> {
  const sectorReturns = new Map<string, number>();

  // 섹터별로 종목 그룹화
  const sectorStocks = new Map<
    string,
    { code: string; marketCap: number }[]
  >();
  for (const stock of topStocks) {
    const sectorCode = stockSectorMap.get(stock.code);
    if (!sectorCode) continue;
    if (!sectorStocks.has(sectorCode)) sectorStocks.set(sectorCode, []);
    sectorStocks.get(sectorCode)!.push({
      code: stock.code,
      marketCap: stock.marketCap,
    });
  }

  // 각 섹터의 시총 가중 수익률 계산
  for (const [sectorCode, stocks] of sectorStocks) {
    let weightedReturn = 0;
    let totalWeight = 0;

    for (const stock of stocks) {
      const history = priceHistories.get(stock.code);
      if (!history || history.length < 2) continue;

      const latest = history[history.length - 1];
      const targetIdx = getTargetIndex(history, period);
      if (targetIdx < 0) continue;

      const target = history[targetIdx];
      if (target.close <= 0) continue;

      const ret = ((latest.close - target.close) / target.close) * 100;
      weightedReturn += ret * stock.marketCap;
      totalWeight += stock.marketCap;
    }

    if (totalWeight > 0) {
      sectorReturns.set(
        sectorCode,
        Math.round((weightedReturn / totalWeight) * 100) / 100
      );
    }
  }

  return sectorReturns;
}

export function getTargetIndex(history: IndexPrice[], period: Period): number {
  const len = history.length;
  if (len < 2) return -1;

  switch (period) {
    case "1w":
      return Math.max(0, len - 6); // ~5 영업일 전
    case "1m":
      return Math.max(0, len - 22); // ~21 영업일 전
    case "3m":
      return Math.max(0, len - 64); // ~63 영업일 전
    case "ytd": {
      // 올해 첫 영업일 찾기
      const currentYear = new Date().getFullYear().toString();
      for (let i = 0; i < len; i++) {
        if (history[i].date.startsWith(currentYear)) return i;
      }
      return 0;
    }
    case "1y":
      return 0; // 가장 오래된 데이터 (count=260 ≈ 1년)
    default:
      return -1;
  }
}

export type SectorStatus =
  | "normal"
  | "crash"
  | "underperform"
  | "contrarian_drop"
  | "surge"
  | "outperform"
  | "contrarian_rise";

export interface SectorAnalysis {
  code: string;
  name: string;
  changeRate: number; // 오늘 등락률 (%)
  marketCap: number; // 섹터 내 상위 종목 시총 합계 (억원, 0이면 데이터 없음)
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
  topStocks: TopStock[];
  vkospi: VkospiData | null;
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
  surge: "급등",
  outperform: "강세",
  contrarian_rise: "역행 상승",
};

export function analyzeSectors(
  sectors: SectorData[],
  majorIndices: {
    info: IndexInfo;
    latest: IndexPrice;
    prev: IndexPrice | null;
    weekAgo: IndexPrice | null;
    monthAgo: IndexPrice | null;
  }[],
  topStocks: TopStock[] = [],
  stockSectorMap?: Map<string, string>,
  vkospi?: VkospiData | null
): AnalysisResult {
  // 섹터별 시총 계산 (topStocks + stockSectorMap 이용)
  const sectorMarketCapMap = new Map<string, number>();
  if (stockSectorMap) {
    for (const stock of topStocks) {
      const sectorCode = stockSectorMap.get(stock.code);
      if (sectorCode) {
        sectorMarketCapMap.set(
          sectorCode,
          (sectorMarketCapMap.get(sectorCode) || 0) + stock.marketCap
        );
      }
    }
  }

  const rates = sectors.map((s) => s.changeRate);
  const avgReturn = mean(rates);
  const medReturn = median(rates);
  const sd = stddev(rates);

  const analyzed: SectorAnalysis[] = sectors.map((s) => {
    let status: SectorStatus = "normal";
    let reason = "";

    const z = sd > 0 ? (s.changeRate - avgReturn) / sd : 0;

    // 1. 급락: 실제 하락 + (평균 대비 2%p 이상 추가 하락 또는 Z-score < -2)
    if (s.changeRate < 0 && (s.changeRate < avgReturn - 2 || z < -2)) {
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

    // 3. 부진: 실제 하락 + Z-score < -1.5
    if (status === "normal" && s.changeRate < 0 && z < -1.5) {
      status = "underperform";
      reason = `등락률 ${s.changeRate.toFixed(2)}% (평균 ${avgReturn.toFixed(2)}%, z=${z.toFixed(1)})`;
    }

    // 4. 급등: 실제 상승 + 평균 대비 2%p 이상 추가 상승, 또는 Z-score > 2
    if (
      status === "normal" &&
      s.changeRate > 0 &&
      (s.changeRate > avgReturn + 2 || z > 2)
    ) {
      status = "surge";
      reason = `등락률 +${s.changeRate.toFixed(2)}% (평균 ${avgReturn.toFixed(2)}%, z=${z.toFixed(1)})`;
    }

    // 5. 역행 상승: 평균이 음수인데 혼자 상승
    if (
      status === "normal" &&
      avgReturn < 0 &&
      s.changeRate > 0.5 &&
      Math.abs(s.changeRate - avgReturn) > 1.5
    ) {
      status = "contrarian_rise";
      reason = `시장 평균 ${avgReturn.toFixed(2)}%인데 +${s.changeRate.toFixed(2)}%`;
    }

    // 6. 강세: 실제 상승 + Z-score > 1.5
    if (status === "normal" && s.changeRate > 0 && z > 1.5) {
      status = "outperform";
      reason = `등락률 ${s.changeRate.toFixed(2)}% (평균 ${avgReturn.toFixed(2)}%, z=${z.toFixed(1)})`;
    }

    return {
      code: s.code,
      name: s.name,
      changeRate: s.changeRate,
      marketCap: sectorMarketCapMap.get(s.code) || 0,
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
        surge: 1,
        contrarian_drop: 2,
        contrarian_rise: 3,
        underperform: 4,
        outperform: 5,
        normal: 6,
      };
      const p = priority[a.status] - priority[b.status];
      if (p !== 0) return p;
      return Math.abs(b.changeRate) - Math.abs(a.changeRate); // 같은 상태면 변동률 큰 순
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
    topStocks,
    vkospi: vkospi ?? null,
    avgSectorReturn: avgReturn,
    medianSectorReturn: medReturn,
    lastUpdated: new Date().toISOString(),
  };
}
