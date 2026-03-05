import { NextRequest, NextResponse } from "next/server";
import { fetchSectorData, fetchMajorIndices, fetchTopStocks, fetchStockSectorMap, fetchStockPriceHistories, fetchIndexHistory, MAJOR_INDICES, fetchVkospi } from "@/lib/krx";
import { analyzeSectors, computeSectorReturns, getTargetIndex, type Period } from "@/lib/analysis";

// 1시간 캐시
export const revalidate = 3600;
export const preferredRegion = "icn1"; // 서울 리전 (네이버 API 지연 최소화)

const VALID_PERIODS = new Set(["1d", "1w", "1m", "3m", "ytd", "1y"]);

export async function GET(request: NextRequest) {
  try {
    const period = (request.nextUrl.searchParams.get("period") || "1d") as Period;
    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json(
        { success: false, error: "Invalid period" },
        { status: 400 }
      );
    }

    const [sectors, majorIndices, topStocks, vkospi] = await Promise.all([
      fetchSectorData(),
      fetchMajorIndices(),
      fetchTopStocks(),
      fetchVkospi(),
    ]);

    if (sectors.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "섹터 데이터를 가져올 수 없습니다. 장 마감 후 다시 시도해주세요.",
        },
        { status: 503 }
      );
    }

    // 종목→섹터 매핑 (캐시됨, 6시간)
    const sectorCodes = sectors.map((s) => s.code);
    let stockSectorMap: Map<string, string> | undefined;
    try {
      stockSectorMap = await fetchStockSectorMap(sectorCodes);
    } catch {
      // 매핑 실패 시 기존 regex 기반 가중치 사용
    }

    // 기간별 수익률 계산 (1d가 아닌 경우)
    let sectorData = sectors;
    if (period !== "1d" && stockSectorMap) {
      try {
        const stockCodes = topStocks.map((s) => s.code);
        const priceHistories = await fetchStockPriceHistories(stockCodes);
        const returns = computeSectorReturns(
          period,
          topStocks,
          stockSectorMap,
          priceHistories
        );

        // 섹터 changeRate를 기간별 수익률로 교체
        sectorData = sectors.map((s) => ({
          ...s,
          changeRate: returns.get(s.code) ?? s.changeRate,
        }));
      } catch {
        // 히스토리 실패 시 당일 데이터로 폴백
      }
    }

    const result = analyzeSectors(sectorData, majorIndices, topStocks, stockSectorMap, vkospi);

    // 기간별 지수 수익률 적용
    if (period !== "1d") {
      try {
        const indexHistories = await Promise.all(
          MAJOR_INDICES.map(async (info) => {
            const history = await fetchIndexHistory(info.code, 260);
            return { code: info.code, history };
          })
        );

        result.indices = result.indices.map((idx) => {
          const found = indexHistories.find((h) => h.code === idx.code);
          if (!found || found.history.length < 2) return idx;
          const history = found.history;
          const latest = history[history.length - 1];
          const targetIdx = getTargetIndex(history, period);
          if (targetIdx < 0 || history[targetIdx].close <= 0) return idx;
          const ret = ((latest.close - history[targetIdx].close) / history[targetIdx].close) * 100;
          return {
            ...idx,
            changeRate: Math.round(ret * 100) / 100,
          };
        });
      } catch {
        // 지수 히스토리 실패 시 당일 데이터 유지
      }
    }

    return NextResponse.json({
      success: true,
      data: { ...result, period },
    });
  } catch (error) {
    console.error("Data fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "데이터를 가져오는 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
