import type { VercelRequest, VercelResponse } from "@vercel/node";

/** 탐색기 — 매매기법 검증 로그(백테스트 기록). 정직성 레이어: 성공·실패 그대로 공개. */
const LOGS = [
  { id: "log-1", date: "2026-05-29 (금)", stockName: "알테오젠", ticker: "052260", market: "KOSDAQ", buyPrice: 198000, maxPriceToday: 202500, closePrice: 201000, result: "성공", profitPct: 2.27, reason: "피하주사 원천제형 마일스톤 계약 확정 공시로 장전 매집 급증. 장 개시 직후 목표가 도달." },
  { id: "log-2", date: "2026-05-28 (목)", stockName: "HD현대일렉트릭", ticker: "043260", market: "KOSPI", buyPrice: 290000, maxPriceToday: 294000, closePrice: 288500, result: "성공", profitPct: 1.38, reason: "북미향 고압 변압기 추가 수주 뉴스, 변전소 테마 반등. 8시 10분경 체결 후 시가 갭 실현." },
  { id: "log-3", date: "2026-05-27 (수)", stockName: "삼양식품", ticker: "003230", market: "KOSPI", buyPrice: 512000, maxPriceToday: 519000, closePrice: 505000, result: "성공", profitPct: 1.36, reason: "해외 유통망 입점·글로벌 판매 지표 개선 소식에 기관 동시호가 수급 유입." },
  { id: "log-4", date: "2026-05-26 (화)", stockName: "테일러테크", ticker: "392010", market: "KOSDAQ", buyPrice: 12500, maxPriceToday: 12550, closePrice: 12100, result: "실패", profitPct: -1.20, reason: "전일 거래량 급증했으나 장 시작 전 미 경쟁사 부정 임상 소식에 장초반 변동성으로 지지선 이탈." },
  { id: "log-5", date: "2026-05-25 (월)", stockName: "리가켐바이오", ticker: "141080", market: "KOSDAQ", buyPrice: 72000, maxPriceToday: 73800, closePrice: 71500, result: "성공", profitPct: 2.50, reason: "ADC 글로벌 제약사 연계 개발 논의 기사 부상. 전일 마감 직전 대규모 거래량이 8시 NXT로 연속." },
];

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ logs: LOGS });
}
