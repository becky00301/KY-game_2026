"use client";

/** 첫 화면 BGM 버튼과 게임 내 사운드 버튼이 공통으로 쓰는 음소거 토글 버튼. */
const VOLUME_ICON_SRC = "/images/icons-misc/volume-icon-unified.webp";

export default function VolumeButton({
  on,
  onClick,
  className = "",
}: {
  /** 소리가 켜져 있는지 — false면 아이콘이 회색으로 바뀐다 */
  on: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      className={`icon-btn ${on ? "" : "muted"} ${className}`.trim()}
      onClick={onClick}
      aria-label="소리 켜기/끄기"
    >
      <img className="volume-icon" src={VOLUME_ICON_SRC} alt="" />
    </button>
  );
}
