"use client";

import { useState } from "react";
import {
  SwordState,
  UPGRADE_NUMBERS,
  autoPerSecond,
  levelOf,
  stageMultiplier,
  stageOf,
  tapPower,
  upgradeCost,
} from "@/lib/engine";
import { TeamTheme, formatNumber, formatRate } from "@/lib/game";
import { AUTO_LABELS, TAP_LABELS, UpgradeLabel } from "@/lib/upgrades";

interface Props {
  sword: SwordState;
  theme: TeamTheme;
  contrib: number;
  onBuy: (id: string) => void;
  onClose: () => void;
}

const NUMBERS = new Map(UPGRADE_NUMBERS.map((u) => [u.id, u]));

export default function UpgradeSheet({ sword, theme, contrib, onBuy, onClose }: Props) {
  const [tab, setTab] = useState<"tap" | "auto">("tap");
  const labels: UpgradeLabel[] = (tab === "tap" ? TAP_LABELS : AUTO_LABELS)[theme.id];
  const mult = stageMultiplier(stageOf(sword.lifetime));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />

        <header className="sheet-head">
          <div>
            <p className="sheet-energy">{formatNumber(sword.energy)}</p>
            <p className="sheet-energy-label">
              {theme.copy.upgradeSheetLabel ?? `${theme.short} 공동 ${theme.spirit}`}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <p className="sheet-note">
          {theme.copy.upgradeSheetNote ?? "누구나 공동 기운으로 강화할 수 있어요. 강화는 모두에게 적용됩니다."}
        </p>

        <div className="tabs">
          <button className={tab === "tap" ? "tab on" : "tab"} onClick={() => setTab("tap")}>
            {theme.copy.tapTabLabel ?? "터치 강화"}
            <em>{formatRate(tapPower(sword))}/회</em>
          </button>
          <button className={tab === "auto" ? "tab on" : "tab"} onClick={() => setTab("auto")}>
            {theme.copy.autoTabLabel ?? "자동 응원"}
            <em>{formatRate(autoPerSecond(sword))}/초</em>
          </button>
        </div>

        <ul className="upgrade-list">
          {labels.map((label) => {
            const numbers = NUMBERS.get(label.id);
            if (!numbers) return null;
            const level = levelOf(sword, label.id);
            const cost = upgradeCost(label.id, level);
            const affordable = sword.energy >= cost;
            const delta = numbers.power * mult;
            return (
              <li key={label.id}>
                <button
                  className={`upgrade-row ${affordable ? "can" : ""}`}
                  onClick={() => onBuy(label.id)}
                  disabled={!affordable}
                >
                  <span className="up-icon">
                    {label.iconImg ? <img src={label.iconImg} width={30} height={30} alt="" /> : label.icon}
                  </span>
                  <span className="up-body">
                    <span className="up-name">
                      {label.name}
                      {level > 0 && <em className="up-level">Lv.{level}</em>}
                    </span>
                    <span className="up-desc">
                      {tab === "tap" ? "터치당" : "초당"} +{formatRate(delta)}
                    </span>
                  </span>
                  <span className="up-cost">{formatNumber(cost)}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {!theme.copy.hideSheetStats && (
          <footer className="sheet-foot">
            <p className="sheet-stats">
              {theme.short} 전체 {formatNumber(sword.taps)}번 · 내가 보탠 {formatNumber(contrib)}번
            </p>
          </footer>
        )}
      </section>
    </div>
  );
}
