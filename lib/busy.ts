"use client";

/**
 * "지금 끊기면 곤란한 화면"인지 표시한다. 새 배포가 떠도 보스전처럼 진행 중인 연출이
 * 있으면 끝날 때까지 새로고침을 미룬다(components/VersionWatcher).
 */
let busy = false;

export function setBusy(value: boolean) {
  busy = value;
}

export function isBusy(): boolean {
  return busy;
}
