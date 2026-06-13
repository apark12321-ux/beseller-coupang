import { Briefing } from "./types";
import { SAMPLE } from "../data/sample";
import { EMPTY } from "./empty";

/**
 * 브리핑 로드 — 작동하는 데이터 소스를 briefing 집계와 분리.
 *  - /api/briefing 이 죽어도(키움 타임아웃 등) 코스피·코스닥·美지수는 각자 직접 받아 표시.
 *  - ?demo=1: SAMPLE.
 * 환율·BTC·ETH 는 useLive 가 실시간 직접 수신.
 */
async function jget(url: string): Promise<any> { const r = await fetch(url, { cache: "no-store" }); return r.json(); }

function composeTldr(us: any[], kr: any[]): string {
  const avg = us.length ? us.reduce((a, b) => a + b.chg, 0) / us.length : 0;
  const dir = avg > 0.5 ? "상승" : avg < -0.5 ? "하락" : "혼조";
  const open = avg > 0.5 ? "우호적인" : avg < -0.5 ? "조심스러운" : "제한적인";
  const usT = us.length ? `밤사이 미국 증시는 ${dir} 마감했습니다. ${us.map(u => `${u.name} ${u.chg >= 0 ? "+" : ""}${u.chg.toFixed(2)}%`).join(", ")}.` : "";
  const krT = kr.length ? ` ${kr.map((k: any) => `${k.name} ${k.chg >= 0 ? "+" : ""}${k.chg.toFixed(2)}%`).join(", ")}.` : "";
  if (!usT && !krT) return "";
  return `${usT}${krT} 우리 시장도 ${open} 출발이 예상됩니다.`.trim();
}

export async function fetchBriefing(): Promise<Briefing> {
  if (new URLSearchParams(location.search).has("demo")) return SAMPLE;

  // 1) briefing 집계(실패해도 무방)
  let base: Briefing = { ...EMPTY };
  try { const j = await jget("/api/briefing"); if (j && !j.error) base = { ...EMPTY, ...j }; } catch { /* ignore */ }

  // 2) 작동 소스 직접 수신 — briefing 생사와 무관하게 항상 채움
  const [kr, us, news] = await Promise.all([
    jget("/api/kr-indices").then(d => d?.data || []).catch(() => []),
    jget("/api/us-indices").then(d => Array.isArray(d) ? d : []).catch(() => []),
    jget("/api/news?q=" + encodeURIComponent("코스피 증시")).then(d => d?.news || []).catch(() => []),
  ]);
  if (kr.length) base.krIndices = kr;
  if (us.length) base.usIndices = us;
  if (news.length) base.news = news;
  if (!base.tldr) base.tldr = composeTldr(base.usIndices || [], base.krIndices || []);

  return base;
}

export async function fetchFX(): Promise<number | null> {
  try { const r = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" }); const j = await r.json(); return j?.rates?.KRW ?? null; } catch { return null; }
}
export async function fetchBTC(): Promise<{ price: number; chg: number } | null> {
  try { const r = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", { cache: "no-store" }); const j = await r.json(); const price = parseFloat(j.lastPrice), chg = parseFloat(j.priceChangePercent); if (isNaN(price)) return null; return { price, chg }; } catch { return null; }
}
