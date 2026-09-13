/**
 * 브라우저 탭 아이콘을 고른 팀의 심볼로 바꿔 끼운다.
 *
 * 기본 아이콘(app/favicon.ico, app/icon.png, app/apple-icon.png)은 고대·연대 반반 심볼이라,
 * 링크 미리보기나 홈 화면 아이콘에서는 어느 편도 들지 않는다. 팀을 고른 뒤 열려 있는
 * 탭의 아이콘만 그 팀 것으로 바뀌고, 편을 다시 고르러 나가면 반반 심볼로 돌아온다.
 *
 * Next.js는 메타데이터 아이콘 링크를 하이드레이션 뒤에 다시 넣기도 한다. 한 번만 바꿔 끼우면
 * 뒤늦게 들어온 기본 링크가 마지막에 붙어 반반 심볼이 이겨버리므로, <head>를 지켜보다가
 * 새 아이콘 링크가 생기면 그것도 바꿔 끼운다.
 */

import { TeamId } from "./game";

const ORIGINAL_HREF = "data-original-href";
const ORIGINAL_TYPE = "data-original-type";
const ICON_SELECTOR = 'link[rel="icon"], link[rel="shortcut icon"]';

let currentTeam: TeamId | null = null;
let observer: MutationObserver | null = null;

function rememberOriginal(link: HTMLLinkElement) {
  if (link.hasAttribute(ORIGINAL_HREF)) return;
  link.setAttribute(ORIGINAL_HREF, link.getAttribute("href") ?? "");
  link.setAttribute(ORIGINAL_TYPE, link.getAttribute("type") ?? "");
}

function sync() {
  // apple-touch-icon은 홈 화면에 추가하는 순간 쓰이는 값이라 건드리지 않는다.
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>(ICON_SELECTOR));

  for (const link of links) {
    rememberOriginal(link);
    const href = currentTeam ? `/icons/favicon-${currentTeam}.png` : link.getAttribute(ORIGINAL_HREF) ?? "";
    const type = currentTeam ? "image/png" : link.getAttribute(ORIGINAL_TYPE) ?? "";

    // 값이 같으면 건드리지 않는다 — 감시 중인 속성을 다시 써서 무한 반복되는 걸 막는다.
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);
    if ((link.getAttribute("type") ?? "") !== type) {
      if (type) link.setAttribute("type", type);
      else link.removeAttribute("type");
    }
  }
}

export function applyTeamFavicon(team: TeamId | null) {
  if (typeof document === "undefined") return;
  currentTeam = team;
  sync();

  if (!observer) {
    observer = new MutationObserver((mutations) => {
      const touchedIcon = mutations.some((m) =>
        m.type === "attributes"
          ? (m.target as Element).matches?.(ICON_SELECTOR) && m.attributeName === "href"
          : Array.from(m.addedNodes).some(
              (n) => n instanceof Element && (n.matches(ICON_SELECTOR) || !!n.querySelector?.(ICON_SELECTOR))
            )
      );
      if (touchedIcon) sync();
    });
    observer.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
  }
}
