import { NextRequest, NextResponse } from "next/server";
import { startSession } from "../store";
import { blockedInProduction } from "@/app/api/sword/guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = blockedInProduction();
  if (blocked) return blocked;

  const body = (await req.json().catch(() => null)) as { nickname?: string; deviceId?: string } | null;
  const nickname = typeof body?.nickname === "string" ? body.nickname : "";
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : undefined;
  return NextResponse.json(startSession(nickname, deviceId));
}
