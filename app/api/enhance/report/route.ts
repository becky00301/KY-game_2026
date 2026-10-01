import { NextRequest, NextResponse } from "next/server";
import { reportLevel } from "../store";
import { blockedInProduction } from "@/app/api/sword/guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = blockedInProduction();
  if (blocked) return blocked;

  const body = (await req.json().catch(() => null)) as { deviceId?: string; level?: number } | null;
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";
  const level = typeof body?.level === "number" ? body.level : 0;
  return NextResponse.json(reportLevel(deviceId, level));
}
