import { NextResponse } from "next/server";
import { fetchInvestorBySector } from "@/lib/krx";

export const revalidate = 3600;
export const maxDuration = 60; // Hobby 플랜 최대 60초 (기본 10초 → 확장)
export const preferredRegion = "icn1"; // 서울 리전 (네이버 API 지연 최소화)

export async function GET() {
  try {
    const result = await fetchInvestorBySector();
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
