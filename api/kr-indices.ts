import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * 국내 지수 — 야후 파이낸스(키움 불필요). ^KS11 코스피, ^KQ11 코스닥.
 * User-Agent 헤더 필수. meta.regularMarketPrice + chartPreviousClose 로 등락률 계산.
 * marketState: REGULAR(장중)·PRE·CLOSED. 새벽 브리핑 시점엔 전일 종가 기준.
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function yq(sym: string, ms = 5000): Promise<{ price: number; chg: number; state: string } | null> {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`, { headers: { "User-Agent": UA }, signal: ac.signal });
    const j: any = await r.json();
    const m = j?.chart?.result?.[0]?.meta;
    if (!m || typeof m.regularMarketPrice !== "number") return null;
    const prev = m.chartPreviousClose ?? m.previousClose;
    const chg = prev ? (m.regularMarketPrice - prev) / prev * 100 : 0;
    return { price: m.regularMarketPrice, chg, state: m.marketState || "" };
  } catch { return null; } finally { clearTimeout(t); }
}

export async function krIndices() {
  const [kospi, kosdaq] = await Promise.all([yq("^KS11"), yq("^KQ11")]);
  const data: { name: string; level: number; chg: number; state: string }[] = [];
  if (kospi) data.push({ name: "코스피", level: kospi.price, chg: kospi.chg, state: kospi.state });
  if (kosdaq) data.push({ name: "코스닥", level: kosdaq.price, chg: kosdaq.chg, state: kosdaq.state });
  return { data, ok: data.length > 0 };
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try { res.status(200).json(await krIndices()); }
  catch (e: any) { res.status(500).json({ ok: false, error: e?.message }); }
}
