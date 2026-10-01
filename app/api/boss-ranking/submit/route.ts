import { NextRequest, NextResponse } from "next/server";
import { submitClear } from "../store";
import { blockedInProduction } from "@/app/api/sword/guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = blockedInProduction();
  if (blocked) return blocked;

  const body = (await req.json().catch(() => null)) as { deviceId?: string; token?: string } | null;
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : undefined;
  const token = typeof body?.token === "string" ? body.token : "";
  return NextResponse.json(submitClear(deviceId, token));
}
