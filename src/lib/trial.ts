/**
 * 체험 게이팅:
 *  - 1일차(첫날): 모든 유료 콘텐츠 오픈 (trialActive = true)
 *  - 2일차 이후: 유료 콘텐츠 잠금 (trialActive = false)
 * 테스트: ?day=2 강제, ?reset 초기화.
 */
const KEY = "dawn_signup";
const today = () => new Date().toISOString().slice(0, 10);
const diff = (a: string, b: string) => Math.round((+new Date(b) - +new Date(a)) / 864e5);

export function getTrial() {
  const p = new URLSearchParams(location.search);
  if (p.has("reset")) localStorage.removeItem(KEY);
  let signup = localStorage.getItem(KEY);
  if (!signup) { signup = today(); localStorage.setItem(KEY, signup); }
  let day = diff(signup, today()) + 1;
  const forced = p.get("day");
  if (forced) day = parseInt(forced, 10) || day;
  return { day, trialActive: day <= 1 };
}
