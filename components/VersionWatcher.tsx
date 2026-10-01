"use client";

import { useEffect, useRef, useState } from "react";
import { isBusy } from "@/lib/busy";

/** 새 배포가 올라왔는지 확인하는 주기 */
const CHECK_INTERVAL_MS = 60_000;
/** 새 배포를 발견하고 실제로 새로고침하기까지 주는 여유 — 안내를 읽을 시간 */
const RELOAD_DELAY_MS = 6_000;

/**
 * 배포가 바뀌면 접속 중인 모든 화면을 자동으로 새로고침한다.
 *
 * 수치를 고쳐 배포해도 이미 열어 둔 화면은 옛 코드를 계속 쓰기 때문에, 서버와 다른 가격·단계를
 * 보여주는 문제가 생긴다. 그래서 화면이 주기적으로 /api/version을 확인하고, 자기 빌드와 다르면
 * 안내를 띄운 뒤 스스로 새로고침한다. 보스전처럼 끊기면 곤란한 중에는 끝날 때까지 기다린다.
 */
export default function VersionWatcher() {
  const [outdated, setOutdated] = useState(false);
  const reloading = useRef(false);

  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_BUILD_ID;
    // 로컬 개발(dev)에서는 의미가 없으므로 끈다.
    if (!mine || mine === "dev") return;

    let alive = true;
    const check = async () => {
      if (!alive || reloading.current || document.hidden) return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { build?: string };
        if (alive && data.build && data.build !== mine) setOutdated(true);
      } catch {
        /* 네트워크 문제면 다음 주기에 다시 확인한다 */
      }
    };

    void check();
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    // 다른 앱 보다가 돌아왔을 때도 한 번 확인한다.
    const onVisible = () => { if (!document.hidden) void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!outdated) return;
    // 보스전 중이면 끝날 때까지 미룬다.
    const timer = window.setInterval(() => {
      if (isBusy() || reloading.current) return;
      reloading.current = true;
      window.location.reload();
    }, RELOAD_DELAY_MS);
    return () => window.clearInterval(timer);
  }, [outdated]);

  if (!outdated) return null;

  return (
    <div className="version-toast" role="status">
      새 버전이 적용됩니다. 잠시 후 화면이 새로고침돼요.
    </div>
  );
}
