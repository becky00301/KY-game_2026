import { NextRequest, NextResponse } from "next/server";
import { getByDeviceAnyTeam } from "../store";
import { blockedInProduction } from "@/app/api/sword/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = blockedInProduction();
  if (blocked) return blocked;

  const deviceId = req.nextUrl.searchParams.get("deviceId") ?? "";
  const row = getByDeviceAnyTeam(deviceId);
  return NextResponse.json(row ? { team: row.team, nickname: row.nickname, level: row.level } : null);
}
