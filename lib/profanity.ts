/**
 * 아주 기본적인 금칙어 필터 — "함성" 닉네임·문구가 비속어·성적인 표현을 담지 못하게
 * 막는 용도. 완벽한 필터는 아니다(띄어쓰기·특수문자로 피해가는 것까지는 못 잡는다),
 * 흔한 표현만 걸러낸다.
 */
const BANNED_WORDS = [
  "씨발", "시발", "ㅆㅂ", "ㅅㅂ", "병신", "ㅂㅅ", "개새끼", "개새", "좆", "존나", "느금",
  "니미", "애미", "창녀", "걸레년", "보지", "자지", "섹스", "야동", "변태", "강간", "꼴리",
  "fuck", "shit", "bitch", "nigger", "nigga", "cunt", "porn", "rape",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s\-_.,!?~^*'"()[\]{}]/g, "");
}

export function containsBannedWord(text: string): boolean {
  const normalized = normalize(text);
  return BANNED_WORDS.some((word) => normalized.includes(word));
}
