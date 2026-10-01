import { NextRequest, NextResponse } from "next/server";
import { getByDevice } from "../store";
import { blockedInProduction } from "@/app/api/sword/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = blockedInProduction();
  if (blocked) return blocked;

  const deviceId = req.nextUrl.searchParams.get("deviceId") ?? "";
  const row = getByDevice(deviceId);
  return NextResponse.json(
    row ? { registered: true, nickname: row.nickname, level: row.level } : { registered: false }
  );
}
