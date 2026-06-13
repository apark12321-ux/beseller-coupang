import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * 마켓 배치 — Yahoo v8 chart 심볼별 병렬 수집 (키·인증 불필요).
 * v7 quote 배치는 crumb 인증 필요 → v8 chart 사용(코스피/코스닥에서 검증된 방식).
 * 페이지: 마켓오버뷰·매크로·글로벌야간 데이터 백본.
 * 반환: { data:[{name,group,unit,level,chg,prev}], asof, ok }
 * 약 15~20분 지연 데이터(장전 브리핑 용도).
 */
export const config = { maxDuration: 15 };

const SYMS: [string, string, string, string][] = [
  // symbol, name, group, unit
  ["^KS11", "코스피", "국내", "pt"], ["^KQ11", "코스닥", "국내", "pt"],
  ["^IXIC", "나스닥", "미국", "pt"], ["^GSPC", "S&P 500", "미국", "pt"], ["^DJI", "다우", "미국", "pt"], ["^SOX", "필라델피아반도체", "미국", "pt"],
  ["^N225", "니케이225", "아시아", "pt"], ["^HSI", "항셍", "아시아", "pt"], ["000001.SS", "상하이종합", "아시아", "pt"], ["^TWII", "대만 가권", "아시아", "pt"],
  ["^STOXX50E", "유로스톡스50", "유럽", "pt"], ["^GDAXI", "독일 DAX", "유럽", "pt"], ["^FTSE", "영국 FTSE100", "유럽", "pt"], ["^FCHI", "프랑스 CAC40", "유럽", "pt"],
  ["^TNX", "美 10년물", "금리", "%"], ["^FVX", "美 5년물", "금리", "%"], ["^TYX", "美 30년물", "금리", "%"], ["^IRX", "美 13주", "금리", "%"],
  ["CL=F", "WTI 원유", "원자재", "$"], ["BZ=F", "브렌트유", "원자재", "$"], ["GC=F", "금", "원자재", "$"], ["SI=F", "은", "원자재", "$"], ["HG=F", "구리", "원자재", "$"], ["NG=F", "천연가스", "원자재", "$"],
  ["^VIX", "VIX 변동성", "지표", "pt"], ["DX-Y.NYB", "달러인덱스", "지표", "pt"],
];

async function one(symbol: string): Promise<{ price: number; prev: number; spark: number[] } | null> {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 6000);
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, signal: ac.signal,
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    const res = j?.chart?.result?.[0]; if (!res) return null;
    const meta = res.meta || {};
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const closes: number[] = (res.indicators?.quote?.[0]?.close || []).filter((x: any) => typeof x === "number");
    if (typeof price !== "number") return null;
    return { price, prev, spark: closes.slice(-8) };
  } catch { return null; } finally { clearTimeout(t); }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const debug = "debug" in req.query;
  const results = await Promise.all(SYMS.map(async ([sym, name, group, unit]) => {
    const d = await one(sym);
    if (!d) return debug ? { name, group, unit, ok: false } : null;
    const chg = d.prev ? ((d.price - d.prev) / d.prev) * 100 : 0;
    return { name, group, unit, level: Math.round(d.price * 100) / 100, chg: Math.round(chg * 100) / 100, prev: d.prev, spark: d.spark, ok: true };
  }));
  const data = results.filter((x: any) => x && x.ok !== false);
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
  res.status(200).json({ data, asof: new Date().toISOString(), ok: data.length > 0, ...(debug ? { raw: results } : {}) });
}
