import { useEffect, useRef, useState } from "react";

export interface Live {
  clock: string; ago: number; ok: boolean;
  krw: string; jpy: string; eur: string; cny: string; fxLive: boolean;
  btc: string; btcChg: number | null; eth: string; ethChg: number | null; cryptoLive: boolean;
  risk: number;
}

const init: Live = {
  clock: "--:--:--", ago: 0, ok: false,
  krw: "1,530원", jpy: "—", eur: "—", cny: "—", fxLive: false,
  btc: "···", btcChg: null, eth: "···", ethChg: null, cryptoLive: false, risk: 72,
};

async function fxRates(): Promise<Record<string, number> | null> {
  try { const r = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" }); const j = await r.json(); return j?.rates || null; } catch { return null; }
}
async function crypto(sym: string): Promise<{ p: number; c: number } | null> {
  try { const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`, { cache: "no-store" }); const j = await r.json(); const p = parseFloat(j.lastPrice), c = parseFloat(j.priceChangePercent); if (isNaN(p)) return null; return { p, c }; } catch { return null; }
}

export function useLive(): Live {
  const [s, setS] = useState<Live>(init);
  const last = useRef(Date.now());
  useEffect(() => {
    const tick = setInterval(() => setS((p) => ({ ...p, clock: new Date().toTimeString().slice(0, 8), ago: Math.floor((Date.now() - last.current) / 1000) })), 1000);
    async function poll() {
      const [rates, btc, eth] = await Promise.all([fxRates(), crypto("BTCUSDT"), crypto("ETHUSDT")]);
      setS((p) => {
        const n = { ...p };
        if (rates && rates.KRW) {
          n.krw = Math.round(rates.KRW).toLocaleString("en-US") + "원";
          if (rates.JPY) n.jpy = (rates.KRW / rates.JPY * 100).toFixed(1) + "원"; // 100엔당
          if (rates.EUR) n.eur = (1 / rates.EUR).toFixed(4);                      // EUR/USD
          if (rates.CNY) n.cny = (rates.KRW / rates.CNY).toFixed(1) + "원";        // 위안/원
          n.fxLive = true; n.ok = true; last.current = Date.now();
        }
        if (btc) { n.btc = "$" + Math.round(btc.p).toLocaleString("en-US"); n.btcChg = btc.c; n.cryptoLive = true; n.ok = true; last.current = Date.now(); n.risk = Math.max(8, Math.min(95, Math.round(60 + btc.c * 2.6))); }
        if (eth) { n.eth = "$" + Math.round(eth.p).toLocaleString("en-US"); n.ethChg = eth.c; }
        return n;
      });
    }
    poll();
    const iv = setInterval(poll, 15000);
    return () => { clearInterval(tick); clearInterval(iv); };
  }, []);
  return s;
}
