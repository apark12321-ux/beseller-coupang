/**
 * 4-Arrow 지표엔진 (React 분석기 로직 이식).
 * DMI·MACD·스토캐스틱·CCI 수렴(n/4) + 수급 에너지 5조건 + 한줄 판정.
 * 종목 상세에서 일봉으로 계산. 매수/매도 신호 아님 — 정렬 상태 관찰.
 */
import { OHLCV } from "./signals";

const ema = (a: number[], n: number) => { const k = 2 / (n + 1); let e = a[0]; const out = [e]; for (let i = 1; i < a.length; i++) { e = a[i] * k + e * (1 - k); out.push(e); } return out; };
const crossedUpRecently = (fast: number[], slow: number[], bars = 5) => {
  const n = fast.length; for (let i = Math.max(1, n - bars); i < n; i++) if (fast[i - 1] <= slow[i - 1] && fast[i] > slow[i]) return { cross: true, day: i }; return { cross: false, day: -1 };
};
const crossedZeroUp = (v: number[], bars = 5) => { const n = v.length; for (let i = Math.max(1, n - bars); i < n; i++) if (v[i - 1] <= 0 && v[i] > 0) return { cross: true, day: i }; return { cross: false, day: -1 }; };

function macd(c: number[]) { const e12 = ema(c, 12), e26 = ema(c, 26); const line = e12.map((v, i) => v - e26[i]); const sig = ema(line, 9); const x = crossedUpRecently(line, sig); return { value: line[line.length - 1], signal: sig[sig.length - 1], hist: line[line.length - 1] - sig[sig.length - 1], ...x }; }
function stochastic(c: OHLCV[], n = 14, d = 3) {
  const k: number[] = []; for (let i = 0; i < c.length; i++) { const s = c.slice(Math.max(0, i - n + 1), i + 1); const hi = Math.max(...s.map(x => x.high)), lo = Math.min(...s.map(x => x.low)); k.push(hi === lo ? 50 : (c[i].close - lo) / (hi - lo) * 100); }
  const dline = ema(k, d); const x = crossedUpRecently(k, dline); return { k: k[k.length - 1], d: dline[dline.length - 1], ...x };
}
function dmi(c: OHLCV[], n = 14) {
  const plus: number[] = [], minus: number[] = [], tr: number[] = [];
  for (let i = 1; i < c.length; i++) {
    const up = c[i].high - c[i - 1].high, dn = c[i - 1].low - c[i].low;
    plus.push(up > dn && up > 0 ? up : 0); minus.push(dn > up && dn > 0 ? dn : 0);
    tr.push(Math.max(c[i].high - c[i].low, Math.abs(c[i].high - c[i - 1].close), Math.abs(c[i].low - c[i - 1].close)));
  }
  const sm = (a: number[]) => ema(a, n);
  const atr = sm(tr), pDI = sm(plus).map((v, i) => atr[i] ? 100 * v / atr[i] : 0), mDI = sm(minus).map((v, i) => atr[i] ? 100 * v / atr[i] : 0);
  const dx = pDI.map((v, i) => (v + mDI[i]) ? 100 * Math.abs(v - mDI[i]) / (v + mDI[i]) : 0); const adx = ema(dx, n);
  const x = crossedUpRecently(pDI, mDI);
  return { pDI: pDI[pDI.length - 1], mDI: mDI[mDI.length - 1], adx: adx[adx.length - 1], ...x };
}
function cci(c: OHLCV[], n = 20) {
  const tp = c.map(x => (x.high + x.low + x.close) / 3); const out: number[] = [];
  for (let i = 0; i < tp.length; i++) { const s = tp.slice(Math.max(0, i - n + 1), i + 1); const m = s.reduce((a, b) => a + b, 0) / s.length; const md = s.reduce((a, b) => a + Math.abs(b - m), 0) / s.length; out.push(md ? (tp[i] - m) / (0.015 * md) : 0); }
  const x = crossedZeroUp(out); return { value: out[out.length - 1], ...x };
}

export interface FourArrow {
  dmi: ReturnType<typeof dmi>; macd: ReturnType<typeof macd>; stoch: ReturnType<typeof stochastic>; cci: ReturnType<typeof cci>;
  count: number; verdict: string;
}
export function fourArrow(c: OHLCV[]): FourArrow | null {
  if (!c || c.length < 30) return null;
  const closes = c.map(x => x.close);
  const D = dmi(c), M = macd(closes), S = stochastic(c), C = cci(c);
  const count = [D.cross, M.cross, S.cross, C.cross].filter(Boolean).length;
  return { dmi: D, macd: M, stoch: S, cci: C, count, verdict: "" };
}

/** 수급 에너지 5조건 점수 (0~5). 시총·거래량밀도·프로그램수급·캔들건전성·52주근접. */
export function energyScore(p: { marketCap?: number; ohlcv: OHLCV[]; programNetBuy?: number }) {
  const c = p.ohlcv; if (!c || c.length < 6) return { score: 0, conds: {} as any };
  const last = c[c.length - 1], prev = c[c.length - 2];
  const vols = c.map(x => x.volume);
  const cap = (p.marketCap ?? 0) >= 3e11 && (p.marketCap ?? 0) <= 1e13;             // 중대형 구간
  const vol = last.volume > (vols.slice(-6, -1).reduce((a, b) => a + b, 0) / 5) * 1.5; // 거래량 밀도
  const prog = (p.programNetBuy ?? 0) > 0;                                            // 프로그램 순매수
  const range = last.high - last.low; const wick = range > 0 && (last.close - last.low) / range >= 0.6; // 캔들 건전성
  const yearHigh = Math.max(...c.map(x => x.high)); const near = last.close >= yearHigh * 0.95;          // 52주 근접
  const conds = { cap, vol, prog, wick, near };
  const score = [cap, vol, prog, wick, near].filter(Boolean).length;
  return { score, conds };
}

export function verdict(count: number, energy: number): string {
  if (count >= 3 && energy >= 4) return "신호 수렴이 선명하다. 관찰 우선순위 상단.";
  if (count >= 3) return "지표는 정렬됐으나 수급이 약하다. 추격 자제.";
  if (count === 2) return "신호가 정렬되는 중. 다음 거래일 확인 필요.";
  if (energy >= 4) return "수급은 강하나 지표가 늦다. 관망 유리.";
  return "아직 자리가 아니다. 신호 대기.";
}
