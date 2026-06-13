import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * 국내 종목 실시간 시세 — 네이버 증권 siseListJson (키·인증 불필요).
 * 코스피(sosok=0)+코스닥(sosok=1) 시총상위 100씩 받아 거래대금(aa) 순 정렬.
 * 반환 필드: 종목명·현재가·등락률·거래량·거래대금·시총 = 실제값.
 * 약 15~20분 지연(장전/장중 참고용). asof로 기준시각 표기.
 */
export const config = { maxDuration: 15 };

interface Item { cd: string; nm: string; nv: number; cv: number; cr: number; rf: string; pcv: number; mks: number; aq: number; aa: number; ms: string; }

async function fetchMarket(sosok: 0 | 1): Promise<Item[]> {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 7000);
  try {
    const url = `https://m.stock.naver.com/api/json/sise/siseListJson.nhn?menu=market_sum&sosok=${sosok}&pageSize=100&page=1`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15", "Referer": "https://m.stock.naver.com/", "Accept": "application/json" },
      signal: ac.signal,
    });
    if (!r.ok) return [];
    const j: any = await r.json();
    const list = j?.result?.itemList || j?.result?.list || j?.itemList || [];
    return Array.isArray(list) ? list : [];
  } catch { return []; } finally { clearTimeout(t); }
}

// 거래대금(aa, 백만원) → 보기 좋은 한글 단위
function turnover(aaMillion: number): string {
  const eok = aaMillion / 100; // 백만원 → 억원
  if (eok >= 10000) return (eok / 10000).toFixed(2) + "조";
  if (eok >= 1) return Math.round(eok).toLocaleString("en-US") + "억";
  return Math.round(aaMillion).toLocaleString("en-US") + "백만";
}
function volFmt(q: number): string {
  if (q >= 1e8) return (q / 1e8).toFixed(1) + "억";
  if (q >= 1e4) return (q / 1e4).toFixed(0) + "만";
  return q.toLocaleString("en-US");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const debug = "debug" in req.query;
  const limit = Math.min(40, parseInt(String(req.query.limit || "20"), 10) || 20);
  const [kp, kq] = await Promise.all([fetchMarket(0), fetchMarket(1)]);
  const tag = (arr: Item[], mk: string) => arr.map(i => ({ ...i, _mk: mk }));
  const all = [...tag(kp, "KOSPI"), ...tag(kq, "KOSDAQ")].filter((i: any) => typeof i.nv === "number" && i.aa);

  // 거래대금 상위 정렬
  all.sort((a: any, b: any) => (b.aa || 0) - (a.aa || 0));
  const stocks = all.slice(0, limit).map((i: any, idx) => ({
    rank: idx + 1,
    name: i.nm,
    code: i.cd,
    market: i._mk === "KOSPI" ? "KP" : "KQ",
    price: i.nv,
    chg: typeof i.cr === "number" ? i.cr : 0,            // 등락률(%)
    change: i.cv,                                         // 등락(원)
    volume: volFmt(i.aq || 0),                            // 거래량
    turnover: turnover(i.aa || 0),                        // 거래대금
    marketcap: i.mks ? (i.mks / 10000).toFixed(1) + "조" : "",
    up: i.cr >= 0,
  }));

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=180");
  res.status(200).json({
    stocks, asof: new Date().toISOString(),
    ok: stocks.length > 0,
    counts: { kospi: kp.length, kosdaq: kq.length },
    ...(debug ? { sample: all[0] || null } : {}),
  });
}
