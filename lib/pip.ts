"use client";

/**
 * Document Picture-in-Picture — 데스크톱 브라우저에서 게임 화면을 작은 떠있는 창으로 띄운다.
 * 일반적인 video PiP와 달리 임의의 HTML을 담을 수 있는 비교적 최근 API라 지원 범위가 좁다.
 *
 * 지원: 데스크톱 Chrome/Edge 116+, Firefox 151+
 * 미지원: Safari 전부, 모바일 브라우저 전부 — 이 경우 기능 자체를 숨기고 안내 문구만 보여준다.
 */

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
      window: Window | null;
    };
  }
}

export const PIP_SUPPORTED = typeof window !== "undefined" && "documentPictureInPicture" in window;

/**
 * PIP 창(빈 문서로 시작)에 메인 문서의 스타일시트를 그대로 복사한다.
 * `<link rel="stylesheet">`와 `<style>` 둘 다 복사해야 Next.js가 어느 쪽으로 CSS를 내보내든 안전하다.
 */
export function copyStylesInto(pip: Window) {
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    pip.document.head.appendChild(node.cloneNode(true));
  });
}
