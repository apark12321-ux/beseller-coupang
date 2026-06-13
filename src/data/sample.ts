import { Briefing } from "../lib/types";

/**
 * 샘플 브리핑. 실서비스에서는 lib/api.ts 의 fetchBriefing() 이
 * /api/briefing (서버리스)에서 KIS·뉴스·환율 API를 모아 반환한 값으로 대체됩니다.
 * 이 파일은 API 응답 스키마의 레퍼런스이자 오프라인 폴백입니다.
 */
function won(n: number) { return n.toLocaleString("en-US"); }

function mkStock(rank: number, name: string, code: string, market: string, price: number, chg: number, turnover: string, volume: string, pos52: string, reason: string, pro: boolean) {
  const unit = price >= 100000 ? 1000 : price >= 10000 ? 500 : 100;
  const poc = Math.round(price / unit) * unit;
  const hi = Math.round((poc * 1.024) / unit) * unit;
  const lo = Math.round((poc * 0.976) / unit) * unit;
  const won = (n: number) => n.toLocaleString("en-US");
  return {
    rank, name, market, code, price, chg, turnover, volume, pos52, pro, reason,
    note: rank === 5 ? "거래대금 1.8조 · 외국인 순매수 전환" : `거래대금 ${turnover}`,
    spark: [20, 17, 18, 12, 13, 7, 5].map((y) => y + (rank % 3)),
    profile: [
      { price: hi, vol: 34 }, { price: poc, vol: 96, poc: true }, { price: lo, vol: 40 },
    ],
    forecast: {
      trend: "단기 상승 · 변동성 보통 — 외국인 순매수 전환이 동력",
      up: `POC ${won(poc)} 위 안착 시 매물대 가벼워져 강세 지속 여지`,
      down: `POC 이탈 시 ${won(lo)}까지 단기 조정 가능`,
    },
  };
}

export const SAMPLE: Briefing = {
  date: new Date().toISOString(),
  temp: 72,
  tldr: "밤사이 미국 증시가 크게 올랐습니다. 이란 공습 철회로 지정학 리스크가 풀린 게 동력. 우리 시장도 우호적 출발이 예상되나, 1,530원대 고환율은 부담입니다.",
  points: ["나스닥 +2.54% · 반도체 강세 — 대형주 시초가 우호", "VIX −12% 공포 진정, 위험선호 회복"],
  usIndices: [
    { name: "나스닥", chg: 2.54, note: "기술주 주도", spark: [20, 18, 19, 13, 15, 8, 10, 3] },
    { name: "S&P 500", chg: 1.75, note: "광범위 강세", spark: [19, 18, 16, 17, 12, 13, 8, 5] },
    { name: "다우", chg: 1.86, note: "50,848", spark: [20, 16, 18, 13, 14, 9, 10, 6] },
  ],
  krIndices: [
    { name: "코스피", level: 2734.56, chg: 0.82, state: "CLOSED" },
    { name: "코스닥", level: 891.23, chg: 1.14, state: "CLOSED" },
  ],
  futures: [
    { k: "코스피200 야간선물", v: "▲0.6%", cls: "up" },
    { k: "美 10년물", v: "4.21%", cls: "" },
    { k: "달러인덱스", v: "104.8", cls: "" },
    { k: "VIX", v: "14.2 ▼", cls: "down" },
  ],
  strategy: {
    up: "외국인 순매수 + 반도체 강세 지속 시 갭상승분 유지 가능",
    dn: "원/달러 1,540 돌파 시 외국인 이탈 — 갭 메우기 주의",
    ob: "시초가 외국인 수급 · 반도체 대형주 거래량 집중도",
  },
  news: [
    { id: "n1", title: "美 증시 급반등 — 트럼프, 이란 공습 철회", source: "연합인포맥스", ago: "6시간 전", tag: "up", tagText: "증시 ▲", tickers: ["삼성전자", "SK하이닉스"], url: "https://finance.yahoo.com/markets/", summary: "트럼프 대통령이 예정됐던 이란 공습을 철회하고 협상 타결이 임박했다고 밝히면서 위험자산 전반이 강하게 반등했습니다. 지정학 리스크가 완화되며 나스닥이 2.5% 넘게 올랐습니다." },
    { id: "n2", title: "스페이스X, 오늘 밤 역대 최대 IPO 데뷔", source: "로이터", ago: "2시간 전", tag: "nu", tagText: "관심", tickers: [], url: "https://www.reuters.com/markets/", summary: "스페이스X가 약 750억 달러 규모로 증시에 데뷔합니다. 역대 최대 IPO로 수급이 집중되며 밤사이 미국 시장 분위기에 영향을 줄 수 있습니다." },
    { id: "n3", title: "SK하이닉스, 외국인 24거래일 만 순매수 전환", source: "한국경제", ago: "1시간 전", tag: "up", tagText: "반도체 ▲", tickers: ["SK하이닉스"], url: "https://markets.hankyung.com/", summary: "SK하이닉스에 외국인 매수세가 24거래일 만에 순매수로 돌아섰습니다. 간밤 미국 반도체 강세와 맞물려 대형주로의 자금 이동이 관찰됩니다." },
  ],
  holdingsImpact: [{ name: "삼성전자", chg: 2.1 }, { name: "SK하이닉스", chg: 3.0 }, { name: "한미반도체", chg: 4.2 }],
  watchNews: [
    { id: "w1", title: "삼성전자, HBM 신규 공급계약 체결", source: "전자신문", ago: "3시간 전", tag: "up", tagText: "삼성전자 ▲", tickers: ["삼성전자"], url: "https://www.etnews.com/", summary: "삼성전자가 주요 고객사와 HBM 신규 공급계약을 체결했다는 소식입니다. 메모리 업황 회복 신호로 해석됩니다." },
    { id: "w2", title: "에코프로, 양극재 증설 계획 발표", source: "머니투데이", ago: "5시간 전", tag: "nu", tagText: "2차전지", tickers: ["에코프로"], url: "https://news.mt.co.kr/", summary: "에코프로가 양극재 생산능력 증설 계획을 공개했습니다. 중장기 수주 가시성에 대한 시장의 평가가 엇갈리고 있습니다." },
  ],
  flow: [
    { who: "외국인", w: 72, label: "유입 기대", dir: "up" },
    { who: "기관", w: 44, label: "중립+", dir: "up" },
    { who: "개인", w: 30, label: "차익실현", dir: "down" },
  ],
  sectors: [
    { name: "반도체", chg: 2.8 }, { name: "IT·전자", chg: 1.9 }, { name: "2차전지", chg: 1.2 },
    { name: "자동차", chg: 0.8 }, { name: "화학", chg: 0.5 }, { name: "바이오", chg: 0.2 },
    { name: "조선", chg: -0.3 }, { name: "금융", chg: -0.7 }, { name: "방산", chg: -1.6 },
  ],
  flowNote: "자금은 반도체로 집중, 방산에서 이탈 — 주도주 쏠림 장세",
  stocks: [
    mkStock(1, "삼성전자", "005930", "KOSPI", 78600, 1.9, "3.4조", "1,240만주", "상단 71%", "외국인 순매수 전환 · HBM 신규 공급계약", false),
    mkStock(2, "SK하이닉스", "000660", "KOSPI", 209500, 3.2, "1.8조", "868만주", "상단 82%", "외국인 24거래일 만 순매수 · 반도체 강세", false),
    mkStock(3, "한미반도체", "042700", "KOSPI", 131500, 4.8, "1.1조", "210만주", "상단 95%", "거래대금 급증 · HBM 장비 수혜 부각", true),
    mkStock(4, "에코프로", "086520", "KOSDAQ", 92400, 3.1, "9,800억", "180만주", "상단 64%", "2차전지 반등 · 양극재 증설 발표", true),
    mkStock(5, "포스코퓨처엠", "003670", "KOSPI", 248000, 2.4, "7,200억", "150만주", "상단 58%", "양극재 신규 수주 기대 · 기관 순매수", true),
  ],
};
