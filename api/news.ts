import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * 시장/종목 뉴스 (네이버 검색 API) — 화면 형식(NewsItem)으로 매핑해 반환.
 * env: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET   쿼리: /api/news?q=코스피
 */
const strip = (s: string) => String(s || "").replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, " ").trim();
function rel(pub: string) { const t = new Date(pub).getTime(); if (isNaN(t)) return ""; const m = Math.floor((Date.now() - t) / 60000); if (m < 60) return `${m}분 전`; const h = Math.floor(m / 60); if (h < 24) return `${h}시간 전`; return `${Math.floor(h / 24)}일 전`; }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!process.env.NAVER_CLIENT_ID) { res.status(200).json({ news: [], ok: false, note: "NAVER 키 미설정" }); return; }
  const q = String(req.query.q || "코스피 증시");
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 6000);
  try {
    const r = await fetch(`https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(q)}&display=8&sort=date`, {
      headers: { "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID!, "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET! },
      signal: ac.signal,
    });
    const j: any = await r.json();
    const items = Array.isArray(j.items) ? j.items.slice(0, 5) : [];
    const news = items.map((it: any, i: number) => ({
      id: "n" + i, title: strip(it.title), source: "네이버뉴스", ago: rel(it.pubDate),
      tag: "nu", tagText: "뉴스", tickers: [], url: it.originallink || it.link, summary: strip(it.description),
    }));
    res.status(200).json({ news, ok: news.length > 0 });
  } catch (e: any) {
    res.status(200).json({ news: [], ok: false, error: e?.message });
  } finally { clearTimeout(t); }
}
