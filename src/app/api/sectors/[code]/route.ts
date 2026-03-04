import { NextRequest, NextResponse } from "next/server";
import { fetchSectorDetail, fetchStockPriceHistories, type IndexPrice } from "@/lib/krx";
import type { Period } from "@/lib/analysis";

export const revalidate = 3600;
export const preferredRegion = "icn1"; // 서울 리전

const VALID_PERIODS = new Set(["1d", "1w", "1m", "3m", "ytd", "1y"]);

function getTargetIndex(history: IndexPrice[], period: Period): number {
  const len = history.length;
  if (len < 2) return -1;
  switch (period) {
    case "1w": return Math.max(0, len - 6);
    case "1m": return Math.max(0, len - 22);
    case "3m": return Math.max(0, len - 64);
    case "ytd": {
      const yr = new Date().getFullYear().toString();
      for (let i = 0; i < len; i++) {
        if (history[i].date.startsWith(yr)) return i;
      }
      return 0;
    }
    case "1y": return 0;
    default: return -1;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const period = (request.nextUrl.searchParams.get("period") || "1d") as Period;
    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json({ success: false, error: "Invalid period" }, { status: 400 });
    }

    const data = await fetchSectorDetail(code);

    // 기간별 수익률 적용
    if (period !== "1d") {
      const stockCodes = [
        ...data.topByMarketCap.map((s) => s.code),
        ...data.topByVolatility.map((s) => s.code),
      ];
      const uniqueCodes = [...new Set(stockCodes)];

      try {
        const histories = await fetchStockPriceHistories(uniqueCodes);

        const applyReturn = (stocks: typeof data.topByMarketCap) =>
          stocks.map((s) => {
            const history = histories.get(s.code);
            if (!history || history.length < 2) return s;
            const latest = history[history.length - 1];
            const idx = getTargetIndex(history, period);
            if (idx < 0 || history[idx].close <= 0) return s;
            const ret = ((latest.close - history[idx].close) / history[idx].close) * 100;
            return { ...s, changeRate: Math.round(ret * 100) / 100 };
          });

        data.topByMarketCap = applyReturn(data.topByMarketCap);
        data.topByVolatility = applyReturn(data.topByVolatility);
      } catch {
        // 히스토리 실패 시 당일 데이터 유지
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Sector detail error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "섹터 상세 정보를 가져올 수 없습니다.",
      },
      { status: 500 }
    );
  }
}
