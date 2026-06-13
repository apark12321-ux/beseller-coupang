import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * 미국 지수(나스닥/S&P/다우) — Twelve Data.
 * 무료(Basic) 플랜은 '지수' 미지원 → 지수를 추종하는 'ETF' 로 대체(무료 포함).
 *   SPY=S&P500, QQQ=나스닥100, DIA=다우.  등락률(%)은 지수와 사실상 동일.
 *   ※ ETF 가격은 지수 '레벨'과 다르므로(예: DIA≈DJI/100) note에는 레벨 대신 설명만 표기.
 * 가입: https://twelvedata.com → API Key
 * env: TWELVEDATA_API_KEY  (무료 800req/day)
 * 디버그: /api/us-indices?debug=1  → Twelve Data 원본 응답 확인
 * 지수 '정확 레벨/나스닥 종합'이 필요하면 Twelve Data 유료(₩) 또는 Stooq 연동으로 교체.
 */
const MAP = [
  { sym: "QQQ", name: "나스닥", note: "기술주 주도" },
  { sym: "SPY", name: "S&P 500", note: "광범위" },
  { sym: "DIA", name: "다우", note: "우량주" },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const key = process.env.TWELVEDATA_API_KEY;
    if (!key) { res.status(501).json({ ok: false, note: "TWELVEDATA_API_KEY 미설정" }); return; }
    const symbols = MAP.map((m) => m.sym).join(",");
    const r = await fetch(`https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${key}`);
    const j: any = await r.json();
    if (req.query.debug) { res.status(200).json(j); return; } // 원본 응답 확인용

    const out = MAP.map((m) => {
      const q = j && j[m.sym] ? j[m.sym] : j;
      const chg = parseFloat(q?.percent_change);
      return { name: m.name, chg: isNaN(chg) ? 0 : chg, note: m.note, spark: [20, 18, 16, 14, 12, 9, 6, 4] };
    });
    res.status(200).json(out);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
