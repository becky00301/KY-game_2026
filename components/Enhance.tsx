"use client";

import { useEffect, useState } from "react";
import { formatNumber, TeamId, TeamTheme } from "@/lib/game";
import { ENHANCE_MAX_LEVEL, enhanceCost, enhanceSuccessRate, enhanceTable } from "@/lib/enhance";
import {
  EnhanceRankEntry,
  checkEnhanceNicknameAvailable,
  fetchEnhanceRankings,
  fetchMyEnhance,
  isEnhanceNicknameFormatValid,
  registerEnhance,
  reportEnhanceLevel,
} from "@/lib/enhanceRanking";

const RANKING_SLOTS = 10;
const NICKNAME_KEY = "kyg.enhanceNickname";
const LEVEL_KEY = "kyg.enhanceLevel";

type Step = "loading" | "nickname" | "main" | "probability" | "ranking";

function loadCache(team: TeamId): { nickname: string; level: number } | null {
  if (typeof window === "undefined") return null;
  const nickname = window.localStorage.getItem(`${NICKNAME_KEY}.${team}`);
  if (!nickname) return null;
  const level = Number(window.localStorage.getItem(`${LEVEL_KEY}.${team}`) ?? 0);
  return { nickname, level };
}

function saveCache(team: TeamId, nickname: string, level: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${NICKNAME_KEY}.${team}`, nickname);
    window.localStorage.setItem(`${LEVEL_KEY}.${team}`, String(level));
  } catch {
    /* 저장 실패해도 진행에는 지장 없다 */
  }
}

/**
 * "강화" — 기기별 개인 재화로 여의보주를 0~30단계까지 강화하는 미니게임.
 * 닉네임은 기기당 하나, 전역에서 유일하다(랭킹 식별자 겸용). 재화 차감·확률
 * 굴림은 contrib(개인 재화)와 같은 신뢰 모델로 전부 클라이언트에서 계산하고,
 * 서버에는 랭킹(닉네임·현재 단계)만 올라간다.
 */
export default function Enhance({
  team,
  theme,
  balance,
  onSpend,
  onClose,
}: {
  team: TeamId;
  theme: TeamTheme;
  balance: number;
  onSpend: (amount: number) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("loading");
  const [nickname, setNickname] = useState("");
  const [level, setLevel] = useState(0);
  const [nicknameInput, setNicknameInput] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<"success" | "fail" | null>(null);
  const [rankTop, setRankTop] = useState<EnhanceRankEntry[] | null>(null);
  const [rankMine, setRankMine] = useState<EnhanceRankEntry | null>(null);
  const [rankFailed, setRankFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const cached = loadCache(team);
    if (cached) {
      setNickname(cached.nickname);
      setLevel(cached.level);
      setStep("main");
    }
    fetchMyEnhance()
      .then((me) => {
        if (!alive) return;
        if (me.registered) {
          setNickname(me.nickname);
          setLevel((prev) => Math.max(prev, me.level));
          saveCache(team, me.nickname, Math.max(cached?.level ?? 0, me.level));
          setStep("main");
        } else if (!cached) {
          setStep("nickname");
        }
      })
      .catch(() => {
        if (!cached && alive) setStep("nickname");
      });
    return () => {
      alive = false;
    };
  }, [team]);

  const submitNickname = async () => {
    if (checking) return;
    const trimmed = nicknameInput.trim();
    if (!isEnhanceNicknameFormatValid(trimmed)) {
      setNicknameError("닉네임은 1~14자까지 입력 가능합니다.");
      return;
    }
    setChecking(true);
    setNicknameError("");
    try {
      const available = await checkEnhanceNicknameAvailable(trimmed);
      if (!available) {
        setNicknameError("이미 누군가가 사용중인 닉네임입니다.");
        return;
      }
      const registered = await registerEnhance(trimmed, team);
      if (!registered.ok) {
        setNicknameError(
          registered.reason === "taken" ? "이미 누군가가 사용중인 닉네임입니다." : "닉네임은 1~14자까지 입력 가능합니다."
        );
        return;
      }
      const finalNickname = registered.nickname ?? trimmed;
      const finalLevel = registered.level ?? 0;
      setNickname(finalNickname);
      setLevel(finalLevel);
      saveCache(team, finalNickname, finalLevel);
      setStep("main");
    } catch {
      setNicknameError("확인 중 문제가 발생했어요. 다시 시도해주세요.");
    } finally {
      setChecking(false);
    }
  };

  const cost = enhanceCost(level);
  const rate = enhanceSuccessRate(level);
  const maxed = level >= ENHANCE_MAX_LEVEL;
  const insufficient = !maxed && cost !== null && balance < cost;

  const attempt = () => {
    if (maxed || cost === null || rate === null || balance < cost) return;
    onSpend(cost);
    if (Math.random() < rate) {
      const next = level + 1;
      setLevel(next);
      saveCache(team, nickname, next);
      void reportEnhanceLevel(next).catch(() => {});
      setResult("success");
    } else {
      setResult("fail");
    }
  };

  const openRanking = () => {
    setStep("ranking");
    setRankTop(null);
    setRankMine(null);
    setRankFailed(false);
    fetchEnhanceRankings(nickname)
      .then(({ top, mine }) => {
        setRankTop(top);
        setRankMine(mine);
      })
      .catch(() => setRankFailed(true));
  };

  return (
    <div className="enhance-backdrop" onClick={onClose}>
      <section className="enhance-modal" role="dialog" aria-modal="true" aria-label="강화" onClick={(e) => e.stopPropagation()}>
        {step === "loading" && <p className="enhance-loading">불러오는 중..</p>}

        {step === "nickname" && (
          <>
            <header className="enhance-head">
              <p className="enhance-title">강화 — 닉네임 설정</p>
              <button className="icon-btn" onClick={onClose} aria-label="닫기">
                ✕
              </button>
            </header>
            <p className="enhance-note">
              강화 랭킹에 쓰일 닉네임을 입력하세요. 닉네임은 중복될 수 없고, 한 기기당 하나만 설정할 수 있습니다.
            </p>
            <input
              className="shout-input"
              value={nicknameInput}
              onChange={(e) => {
                setNicknameInput(e.target.value);
                setNicknameError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitNickname();
              }}
              maxLength={14}
              placeholder="닉네임"
              aria-label="닉네임"
              autoFocus
            />
            {nicknameError && <p className="shout-error">{nicknameError}</p>}
            <button className="reveal-close" onClick={() => void submitNickname()} disabled={checking}>
              {checking ? "확인 중.." : "확인"}
            </button>
          </>
        )}

        {step === "main" && (
          <>
            <header className="enhance-head">
              <p className="enhance-title">{nickname}님의 여의보주</p>
              <button className="icon-btn" onClick={onClose} aria-label="닫기">
                ✕
              </button>
            </header>

            <div className="enhance-image-wrap">
              <img src="/images/enhance/yeouiboju.webp" alt="여의보주" className="enhance-image" />
              <span className="enhance-level-badge">+{level}</span>
            </div>

            <p className="enhance-level-text">{maxed ? "최대 단계에 도달했습니다!" : `${level} → ${level + 1}단계`}</p>

            <div className="enhance-currency">
              <span className="enhance-currency-name">{theme.personalCurrency}</span>
              <span className="enhance-currency-value">{formatNumber(balance)}</span>
            </div>

            {!maxed && cost !== null && rate !== null && (
              <p className="enhance-odds">
                비용 {formatNumber(cost)} · 성공확률 {Math.round(rate * 100)}%
              </p>
            )}

            {result === "success" && <p className="enhance-result enhance-result--success">강화 성공!</p>}
            {result === "fail" && <p className="enhance-result enhance-result--fail">강화 실패..</p>}
            {result === null && insufficient && (
              <p className="enhance-result enhance-result--fail">{theme.personalCurrency}이(가) 부족합니다.</p>
            )}

            <button className="enhance-main-btn" onClick={attempt} disabled={maxed || insufficient}>
              {maxed ? "강화 완료" : "강화하기"}
            </button>

            <div className="enhance-sub-actions">
              <button className="enhance-sub-btn" onClick={() => setStep("probability")}>
                확률표
              </button>
              <button className="enhance-sub-btn" onClick={openRanking}>
                강화 랭킹
              </button>
            </div>
          </>
        )}

        {step === "probability" && (
          <>
            <header className="enhance-head">
              <button className="icon-btn" onClick={() => setStep("main")} aria-label="뒤로">
                ‹
              </button>
              <p className="enhance-title">확률표</p>
              <button className="icon-btn" onClick={onClose} aria-label="닫기">
                ✕
              </button>
            </header>
            <ol className="enhance-table">
              {enhanceTable().map((row) => (
                <li key={row.level} className="enhance-table-row">
                  <span className="enhance-table-step">
                    {row.level} → {row.level + 1}
                  </span>
                  <span className="enhance-table-rate">{Math.round(row.rate * 100)}%</span>
                  <span className="enhance-table-cost">{formatNumber(row.cost)}</span>
                </li>
              ))}
            </ol>
          </>
        )}

        {step === "ranking" && (
          <>
            <header className="enhance-head">
              <button className="icon-btn" onClick={() => setStep("main")} aria-label="뒤로">
                ‹
              </button>
              <p className="enhance-title">강화 랭킹</p>
              <button className="icon-btn" onClick={onClose} aria-label="닫기">
                ✕
              </button>
            </header>
            {rankFailed && <p className="boss-ranking-error">순위를 불러오지 못했어요.</p>}
            {!rankFailed && !rankTop && <p className="boss-ranking-loading">불러오는 중..</p>}
            {rankTop && (
              <ol className="boss-ranking-list">
                {Array.from({ length: RANKING_SLOTS }, (_, i) => rankTop[i] ?? null).map((entry, i) =>
                  entry ? (
                    <li
                      key={entry.rank}
                      className={`boss-ranking-row ${entry.rank <= 3 ? `boss-ranking-row--top boss-ranking-row--top${entry.rank}` : ""}`}
                    >
                      <span className="boss-ranking-rank">{entry.rank}</span>
                      <span className="boss-ranking-name">{entry.nickname}</span>
                      <span className="enhance-rank-level">{entry.level}단계</span>
                    </li>
                  ) : (
                    <li key={`vacant-${i}`} className="boss-ranking-row boss-ranking-row--vacant">
                      <span className="boss-ranking-rank">{i + 1}</span>
                      <span className="boss-ranking-name">비어 있음</span>
                    </li>
                  )
                )}
              </ol>
            )}
            <div className="boss-ranking-mine">
              <p className="boss-ranking-mine-label">내 순위</p>
              {rankMine ? (
                <div
                  className={`boss-ranking-row boss-ranking-row--mine ${rankMine.rank <= 3 ? `boss-ranking-row--top boss-ranking-row--top${rankMine.rank}` : ""}`}
                >
                  <span className="boss-ranking-rank">{rankMine.rank}</span>
                  <span className="boss-ranking-name">{rankMine.nickname}</span>
                  <span className="enhance-rank-level">{rankMine.level}단계</span>
                </div>
              ) : (
                <p className="boss-ranking-mine-empty">아직 순위 정보가 없습니다.</p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
