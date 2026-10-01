import { NextRequest, NextResponse } from "next/server";
import { register } from "../store";
import { blockedInProduction } from "@/app/api/sword/guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = blockedInProduction();
  if (blocked) return blocked;

  const body = (await req.json().catch(() => null)) as
    | { nickname?: string; deviceId?: string; team?: string }
    | null;
  const nickname = typeof body?.nickname === "string" ? body.nickname : "";
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";
  const team = typeof body?.team === "string" ? body.team : "ku";
  return NextResponse.json(register(nickname, deviceId, team));
}
