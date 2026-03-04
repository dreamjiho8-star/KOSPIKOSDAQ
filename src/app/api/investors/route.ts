import { NextResponse } from "next/server";
import { fetchInvestorBySector } from "@/lib/krx";

export const revalidate = 3600;

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
