import { NextResponse } from "next/server";
import { fetchSectorData, fetchMajorIndices } from "@/lib/krx";
import { analyzeSectors } from "@/lib/analysis";

// 1시간 캐시
export const revalidate = 3600;
export const preferredRegion = "icn1"; // 서울 리전 (네이버 API 지연 최소화)

export async function GET() {
  try {
    const [sectors, majorIndices] = await Promise.all([
      fetchSectorData(),
      fetchMajorIndices(),
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

    const result = analyzeSectors(sectors, majorIndices);

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
