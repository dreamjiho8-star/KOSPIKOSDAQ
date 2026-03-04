import { NextRequest, NextResponse } from "next/server";
import { fetchSectorDetail } from "@/lib/krx";

export const revalidate = 3600;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const data = await fetchSectorDetail(code);
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
