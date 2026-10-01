import { NextRequest, NextResponse } from "next/server";
import { isNicknameAvailable } from "../store";
import { blockedInProduction } from "@/app/api/sword/guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = blockedInProduction();
  if (blocked) return blocked;

  const body = (await req.json().catch(() => null)) as { nickname?: string } | null;
  const nickname = typeof body?.nickname === "string" ? body.nickname : "";
  return NextResponse.json({ available: isNicknameAvailable(nickname) });
}
