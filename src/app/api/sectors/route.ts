import { NextResponse } from "next/server";
import { fetchSectorData, fetchMajorIndices, fetchTopStocks, fetchStockSectorMap } from "@/lib/krx";
import { analyzeSectors } from "@/lib/analysis";

// 1시간 캐시
export const revalidate = 3600;
export const preferredRegion = "icn1"; // 서울 리전 (네이버 API 지연 최소화)

export async function GET() {
  try {
    const [sectors, majorIndices, topStocks] = await Promise.all([
      fetchSectorData(),
      fetchMajorIndices(),
      fetchTopStocks(),
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

    // 섹터별 시총 계산을 위해 종목→섹터 매핑 가져오기 (캐시됨, 6시간)
    const sectorCodes = sectors.map((s) => s.code);
    let stockSectorMap: Map<string, string> | undefined;
    try {
      stockSectorMap = await fetchStockSectorMap(sectorCodes);
    } catch {
      // 매핑 실패 시 기존 regex 기반 가중치 사용
    }

    const result = analyzeSectors(sectors, majorIndices, topStocks, stockSectorMap);

    return NextResponse.json({
      success: true,
      data: result,
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
