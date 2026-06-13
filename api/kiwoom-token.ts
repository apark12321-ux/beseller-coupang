import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * 키움증권 REST API 접근토큰 (서버 전용).
 * 실전: KIWOOM_BASE=https://api.kiwoom.com / 모의: https://mockapi.kiwoom.com
 * POST /oauth2/token { grant_type:"client_credentials", appkey, secretkey } → { token, ... }
 * env: KIWOOM_APP_KEY, KIWOOM_SECRET_KEY, KIWOOM_BASE
 */
let cache: { token: string; exp: number } | null = null;

const env = (k: string) => (process.env[k] || "").trim(); // 공백/줄바꿈 제거

export async function getKiwoomToken(): Promise<string> {
  if (cache && cache.exp > Date.now()) return cache.token;
  const base = env("KIWOOM_BASE") || "https://api.kiwoom.com";
  const ac = new AbortController();
  const tm = setTimeout(() => ac.abort(), 5000);
  let j: any;
  try {
    const r = await fetch(`${base}/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/json;charset=UTF-8" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: env("KIWOOM_APP_KEY"),
        secretkey: env("KIWOOM_SECRET_KEY"),
      }),
      signal: ac.signal,
    });
    j = await r.json();
  } finally { clearTimeout(tm); }
  if (!j.token) throw new Error("Kiwoom token failed: " + JSON.stringify(j));
  cache = { token: j.token, exp: Date.now() + 6 * 3600 * 1000 };
  return j.token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.query.debug) {
    const rawA = process.env.KIWOOM_APP_KEY || "", rawS = process.env.KIWOOM_SECRET_KEY || "";
    res.status(200).json({
      base: env("KIWOOM_BASE") || "(기본값 https://api.kiwoom.com)",
      appkey_len: rawA.length,
      appkey_trimmed_len: rawA.trim().length,
      appkey_has_space_or_newline: rawA !== rawA.trim(),
      secretkey_len: rawS.length,
      secretkey_trimmed_len: rawS.trim().length,
      secretkey_has_space_or_newline: rawS !== rawS.trim(),
      hint: "len이 0이면 미적용(재배포). has_space_or_newline:true면 값 끝 공백/줄바꿈 → 다시 깔끔히 입력. appkey/secretkey 자리 바뀜·앱 승인상태도 확인.",
    });
    return;
  }
  try {
    const token = await getKiwoomToken();
    res.status(200).json({ ok: true, token: token.slice(0, 8) + "…" });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
