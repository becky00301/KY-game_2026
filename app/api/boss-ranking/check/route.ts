import { NextRequest, NextResponse } from "next/server";
import { isDeviceRegistered, isNicknameAvailable } from "../store";
import { blockedInProduction } from "@/app/api/sword/guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = blockedInProduction();
  if (blocked) return blocked;

  const body = (await req.json().catch(() => null)) as { nickname?: string; deviceId?: string } | null;
  const nickname = typeof body?.nickname === "string" ? body.nickname : "";
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : undefined;
  // Supabase의 boss_ranking_can_enter와 같은 응답 형태 — 기기 중복까지 함께 본다.
  if (isDeviceRegistered(deviceId)) {
    return NextResponse.json({ ok: false, reason: "device_taken", available: false });
  }
  const available = isNicknameAvailable(nickname);
  return NextResponse.json({
    ok: available,
    reason: available ? undefined : nickname.trim() ? "taken" : "invalid",
    available,
  });
}
