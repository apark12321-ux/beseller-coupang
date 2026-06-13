/**
 * 종목 스크리너 점수엔진 (KIS 스크리너 로직 이식).
 * 일봉 OHLCV 배열을 받아 신호·점수·과열여부를 산출. 매수/매도 신호 아님 — '선별' 근거.
 * /api/briefing 의 주목주 선별, 종목 상세의 "왜 주목?" 근거에 사용.
 */
export interface OHLCV { date: string; open: number; high: number; low: number; close: number; volume: number; }

export interface Signal {
  windowReturn: number;   // 5일 수익률 %
  volAccel: number;       // 거래량 가속 (최근/이전 평균) 배
  upDays: number;         // 최근 5일 양봉 수
  closeStrength: number;  // 당일 종가 강도 (고저 중 위치) 0~1
  avgTurnover: number;    // 평균 거래대금(원)
  atrPct: number;         // ATR / 종가 %
  overheated: boolean;    // 과열 제외 대상
  overheatReason: string;
  score: number;          // 종합 점수
  reason: string;         // 사람이 읽는 근거 한 줄
}

const MAX_RET = 15;       // 5일 +15% 초과 과열 제외
const MAX_MA_DEV = 12;    // 10일 이평 이격 +12% 초과 과열 제외

function sma(arr: number[], n: number) { if (arr.length < n) return NaN; const s = arr.slice(-n); return s.reduce((a, b) => a + b, 0) / n; }

export function analyzeSignal(c: OHLCV[]): Signal | null {
  if (!c || c.length < 6) return null;
  const closes = c.map(d => d.close), highs = c.map(d => d.high), lows = c.map(d => d.low), vols = c.map(d => d.volume);
  const last = c[c.length - 1];
  const w = 5;
  const windowReturn = ((last.close - closes[closes.length - 1 - w]) / closes[closes.length - 1 - w]) * 100;
  const recentVol = sma(vols, 3), prevVol = sma(vols.slice(0, -3), 3);
  const volAccel = prevVol > 0 ? recentVol / prevVol : 1;
  let upDays = 0; for (let i = closes.length - w; i < closes.length; i++) if (i > 0 && closes[i] > closes[i - 1]) upDays++;
  const range = last.high - last.low;
  const closeStrength = range > 0 ? (last.close - last.low) / range : 0.5;
  const avgTurnover = sma(c.map(d => d.close * d.volume), w);
  // ATR(간이): 최근 w일 (고-저) 평균 / 종가
  const trs: number[] = []; for (let i = c.length - w; i < c.length; i++) trs.push(c[i].high - c[i].low);
  const atrPct = (trs.reduce((a, b) => a + b, 0) / trs.length) / last.close * 100;
  // 과열 제외
  const ma10 = sma(closes, 10);
  const maDev = isNaN(ma10) ? 0 : (last.close - ma10) / ma10 * 100;
  let overheated = false, overheatReason = "";
  if (windowReturn > MAX_RET) { overheated = true; overheatReason = `5일 +${windowReturn.toFixed(0)}% 과열`; }
  else if (maDev > MAX_MA_DEV) { overheated = true; overheatReason = `10일 이평 +${maDev.toFixed(0)}% 이격`; }
  // 점수 (과열 아닌 것 중 모멘텀+수급 조합)
  const score = overheated ? 0 :
    Math.round((Math.max(0, windowReturn) * 1.0) + (volAccel * 8) + (upDays * 4) + (closeStrength * 10) + Math.min(20, avgTurnover / 1e11));
  const bits: string[] = [];
  if (volAccel >= 1.3) bits.push(`거래량 ${volAccel.toFixed(1)}배 급증`);
  if (upDays >= 3) bits.push(`최근 5일 ${upDays}일 상승`);
  if (closeStrength >= 0.7) bits.push("종가 고가권 마감");
  const reason = bits.length ? bits.join(" · ") : `5일 ${windowReturn >= 0 ? "+" : ""}${windowReturn.toFixed(1)}%`;
  return { windowReturn, volAccel, upDays, closeStrength, avgTurnover, atrPct, overheated, overheatReason, score, reason };
}

/** 비용모델: 순+targetPct% 내려면 필요한 총 상승률 % (왕복비용 반영). 정직 레이어. */
export function grossNeededFor(targetNetPct = 1, roundTripCostPct = 0.44) { return +(targetNetPct + roundTripCostPct).toFixed(2); }

/** 후보 리스트 점수 랭킹 + 과열 분리 */
export function rankCandidates(items: { code: string; name: string; ohlcv: OHLCV[] }[]) {
  const scored = items.map(it => ({ ...it, sig: analyzeSignal(it.ohlcv) })).filter(x => x.sig);
  const ranked = scored.filter(x => !x.sig!.overheated).sort((a, b) => b.sig!.score - a.sig!.score);
  const excluded = scored.filter(x => x.sig!.overheated);
  return { ranked, excluded };
}
