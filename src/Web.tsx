import { useEffect, useRef, useState, ReactNode, CSSProperties } from "react";
import { Briefing, Stock, NewsItem } from "./lib/types";
import { Live } from "./hooks/useLive";

type MItem = { name: string; group: string; unit: string; level: number; chg: number; spark?: number[] };
type NStock = { rank: number; name: string; code: string; market: string; price: number; chg: number; volume: string; turnover: string; marketcap: string; up: boolean };

const wd = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const fmtDate = () => { const d = new Date(); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${wd[d.getDay()]}`; };
const cc = (n: number) => (n >= 0 ? "u" : "d");
const ar = (n: number) => (n >= 0 ? "▲" : "▼") + Math.abs(n).toFixed(2) + "%";
const comma = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const fmtLevel = (m: MItem) => m.unit === "%" ? m.level.toFixed(2) + "%" : m.unit === "$" ? "$" + comma(m.level) : comma(m.level);

function Spark({ data, up }: { data?: number[]; up: boolean }) {
  if (!data || data.length < 2) return <div className="empty">—</div>;
  const min = Math.min(...data), max = Math.max(...data), r = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${34 - ((v - min) / r) * 30 - 2}`).join(" ");
  return <svg className="spark" viewBox="0 0 100 34" preserveAspectRatio="none"><polyline className={up ? "u" : "d"} points={pts} /></svg>;
}
const Soon = ({ txt }: { txt: string }) => <div className="empty" style={{ margin: "auto", padding: 24 }}>{txt}</div>;

// ===== 목업 데이터 (라이브 미수신 시 폴백) =====
const SAMPLE_MARKETS: MItem[] = [
  { name: "코스피", group: "국내", unit: "", level: 8123.62, chg: 4.63 }, { name: "코스닥", group: "국내", unit: "", level: 1029.05, chg: 3.22 }, { name: "코스피200", group: "국내", unit: "", level: 1231.54, chg: 0.36 },
  { name: "나스닥", group: "미국", unit: "", level: 25809.66, chg: 2.54, spark: [248, 250, 249, 253, 255, 256, 258, 258] }, { name: "S&P 500", group: "미국", unit: "", level: 7394.30, chg: 1.75 }, { name: "다우", group: "미국", unit: "", level: 50848.75, chg: 1.86 }, { name: "필라델피아반도체", group: "미국", unit: "", level: 6842.10, chg: 3.40 },
  { name: "니케이225", group: "아시아", unit: "", level: 64024.60, chg: -0.24 }, { name: "항셍", group: "아시아", unit: "", level: 24657.06, chg: 1.02 }, { name: "상하이종합", group: "아시아", unit: "", level: 3959.34, chg: -0.85 }, { name: "대만 가권", group: "아시아", unit: "", level: 24112.00, chg: 1.95 },
  { name: "유로스톡스50", group: "유럽", unit: "", level: 6062.29, chg: 0.87 }, { name: "독일 DAX", group: "유럽", unit: "", level: 24616.22, chg: 1.74 }, { name: "영국 FTSE100", group: "유럽", unit: "", level: 10373.20, chg: 1.15 }, { name: "프랑스 CAC40", group: "유럽", unit: "", level: 8199.29, chg: 0.46 },
  { name: "美 10년물", group: "금리", unit: "%", level: 4.18, chg: -0.03 }, { name: "美 5년물", group: "금리", unit: "%", level: 4.05, chg: -0.02 }, { name: "美 30년물", group: "금리", unit: "%", level: 4.39, chg: -0.04 }, { name: "美 13주", group: "금리", unit: "%", level: 4.30, chg: -0.01 },
  { name: "WTI 원유", group: "원자재", unit: "$", level: 78.4, chg: 1.2 }, { name: "브렌트유", group: "원자재", unit: "$", level: 82.1, chg: 1.0 }, { name: "금", group: "원자재", unit: "$", level: 4222.62, chg: 0.6 }, { name: "은", group: "원자재", unit: "$", level: 29.8, chg: 1.1 }, { name: "구리", group: "원자재", unit: "$", level: 4.32, chg: 0.9 }, { name: "천연가스", group: "원자재", unit: "$", level: 2.41, chg: -1.8 },
  { name: "VIX 변동성", group: "지표", unit: "", level: 14.2, chg: -7.2 }, { name: "달러인덱스", group: "지표", unit: "", level: 103.4, chg: -0.21 },
];
const SAMPLE_STOCKS: NStock[] = [
  { rank: 1, name: "삼성전자", code: "005930", market: "KP", price: 94300, chg: 1.9, volume: "12.9M", turnover: "1.07조", marketcap: "562.8조", up: true },
  { rank: 2, name: "SK하이닉스", code: "000660", market: "KP", price: 318000, chg: 3.2, volume: "4.2M", turnover: "8,420억", marketcap: "231.5조", up: true },
  { rank: 3, name: "한미반도체", code: "042700", market: "KP", price: 168500, chg: 4.8, volume: "6.1M", turnover: "6,980억", marketcap: "16.4조", up: true },
  { rank: 4, name: "LG에너지솔루션", code: "373220", market: "KP", price: 412000, chg: 2.1, volume: "1.8M", turnover: "5,210억", marketcap: "96.4조", up: true },
  { rank: 5, name: "알테오젠", code: "196170", market: "KQ", price: 384000, chg: 2.7, volume: "1.4M", turnover: "4,180억", marketcap: "20.5조", up: true },
  { rank: 6, name: "리가켐바이오", code: "141080", market: "KQ", price: 142500, chg: 5.1, volume: "2.9M", turnover: "3,920억", marketcap: "5.1조", up: true },
  { rank: 7, name: "현대차", code: "005380", market: "KP", price: 246500, chg: 1.2, volume: "1.6M", turnover: "3,610억", marketcap: "51.7조", up: true },
  { rank: 8, name: "셀트리온", code: "068270", market: "KP", price: 198400, chg: -0.8, volume: "1.9M", turnover: "3,280억", marketcap: "43.2조", up: false },
  { rank: 9, name: "HD현대일렉트릭", code: "267260", market: "KP", price: 428800, chg: 8.9, volume: "0.9M", turnover: "3,140억", marketcap: "15.4조", up: true },
  { rank: 10, name: "에코프로비엠", code: "247540", market: "KQ", price: 184000, chg: -3.7, volume: "2.1M", turnover: "2,870억", marketcap: "18.0조", up: false },
  { rank: 11, name: "두산에너빌리티", code: "034020", market: "KP", price: 41250, chg: 2.2, volume: "8.4M", turnover: "2,460억", marketcap: "26.4조", up: true },
  { rank: 12, name: "NAVER", code: "035420", market: "KP", price: 254000, chg: 1.2, volume: "0.7M", turnover: "1,980억", marketcap: "38.2조", up: true },
];
const SAMPLE_NEWS: NewsItem[] = [
  { id: "s1", title: "외국인 24거래일 만에 순매수 전환… 반도체 주도", source: "네이버뉴스", ago: "32분", tag: "nu", tagText: "뉴스", summary: "", tickers: [], url: "#" },
  { id: "s2", title: "노무라 \"반도체 슈퍼사이클 시작, 코스피 11,000 간다\"", source: "네이버뉴스", ago: "1시간", tag: "nu", tagText: "뉴스", summary: "", tickers: [], url: "#" },
  { id: "s3", title: "HBM 신규 공급계약 기대에 장전 매수세 급증", source: "네이버뉴스", ago: "2시간", tag: "nu", tagText: "뉴스", summary: "", tickers: [], url: "#" },
  { id: "s4", title: "코스닥 반도체 소부장주 급등… 신고가 종목 95% 차지", source: "네이버뉴스", ago: "3시간", tag: "nu", tagText: "뉴스", summary: "", tickers: [], url: "#" },
  { id: "s5", title: "기관·외국인 4.5조 폭풍 매수 동행", source: "네이버뉴스", ago: "4시간", tag: "nu", tagText: "뉴스", summary: "", tickers: [], url: "#" },
];
const SAMPLE_STRAT = { up: "美 강세 연장 시 갭상승 후 눌림 매물 소화 관찰", ob: "시초 외국인 수급·대형주 거래대금 집중도 확인", dn: "과열(72)·VIX 저점 — 추격 변동성 리스크 상존" };
const SAMPLE_SECTORS = [{ name: "반도체", chg: 5.8 }, { name: "바이오", chg: 4.2 }, { name: "2차전지", chg: -1.4 }, { name: "방산", chg: 3.1 }, { name: "전력·원자력", chg: 2.9 }, { name: "자동차", chg: 0.8 }, { name: "인터넷", chg: 1.6 }, { name: "금융", chg: -0.6 }];
const SUPPLY = [["외국인", 3260, true], ["기관계", -2390, false], ["└ 연기금", 1210, true], ["└ 금융투자", -1320, false], ["개인", -870, false]] as [string, number, boolean][];
const CAL = [["08:00", "NXT 장전 시간외 개시"], ["09:00", "정규장 개장"], ["08:30", "美 5월 CPI 발표(밤)"], ["10:00", "삼성전자 컨퍼런스콜"], ["16:00", "SK하이닉스 수주 공시 예정"], ["21:30", "美 신규 실업수당 청구"]] as [string, string][];

function Page({ no, title, of, cls, style, children }: { no: string; title: string; of: string; cls: string; style: CSSProperties; children: ReactNode }) {
  return (
    <section className={"page " + cls} style={style}>
      <div className="sheen" />
      <div className="dp">
        <div className="dp-h"><span className="dp-no">{no}</span><span className="dp-t">{title}</span><span className="dp-of">{of}</span></div>
        <div className="dp-grid">{children}</div>
      </div>
    </section>
  );
}

export default function Web({ b, live, openStock, openNews }: {
  b: Briefing; live: Live;
  openPrice: () => void; openKakao: () => void; openStock: (s: Stock) => void; openNews: (n: NewsItem) => void;
}) {
  const [cur, setCur] = useState(0);
  const busy = useRef(false);
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const [markets, setMarkets] = useState<MItem[]>([]);
  const [nstocks, setNstocks] = useState<NStock[]>([]);
  const [asof, setAsof] = useState("");
  const PAGES = 13;
  const curRef = useRef(cur); curRef.current = cur;

  useEffect(() => {
    fetch("/api/markets").then(r => r.json()).then(d => { setMarkets(d.data || []); if (d.asof) setAsof(d.asof); }).catch(() => {});
    fetch("/api/naver-stocks?limit=20").then(r => r.json()).then(d => setNstocks(d.stocks || [])).catch(() => {});
  }, []);

  const go = (n: number) => {
    if (busy.current) return; n = Math.max(0, Math.min(PAGES - 1, n)); if (n === curRef.current) return;
    busy.current = true; setCur(n); setTimeout(() => (busy.current = false), 820);
  };
  const goRef = useRef(go); goRef.current = go;

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "ArrowRight") goRef.current(curRef.current + 1); if (e.key === "ArrowLeft") goRef.current(curRef.current - 1); };
    let wl = 0; const wheel = (e: WheelEvent) => { const t = Date.now(); if (t - wl < 900) return; if (Math.abs(e.deltaY) < 18) return; wl = t; goRef.current(curRef.current + (e.deltaY > 0 ? 1 : -1)); };
    window.addEventListener("keydown", key); window.addEventListener("wheel", wheel, { passive: true });
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("wheel", wheel); };
  }, []);

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return; const cx = cv.getContext("2d"); if (!cx) return;
    let W = 0, H = 0, raf = 0; const t0 = performance.now();
    const parts = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() + 0.3, s: Math.random() * 1.6 + 0.4 }));
    const resize = () => { const d = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0); };
    resize(); window.addEventListener("resize", resize);
    const frame = (now: number) => {
      const t = (now - t0) / 1000; cx.clearRect(0, 0, W, H);
      const hy = H * 0.84, sR = Math.min(W, H) * 0.17, sx = W / 2, ri = Math.min(1, t / 2.4), sy = hy + (1 - ri) * sR * 1.1;
      const g = cx.createRadialGradient(sx, sy, 0, sx, sy, sR * 2.4);
      g.addColorStop(0, `rgba(255,190,120,${0.4 * ri})`); g.addColorStop(0.4, `rgba(255,120,150,${0.2 * ri})`); g.addColorStop(1, "rgba(120,80,200,0)");
      cx.fillStyle = g; cx.beginPath(); cx.arc(sx, sy, sR * 2.4, 0, 7); cx.fill();
      cx.save(); cx.beginPath(); cx.arc(sx, sy, sR, 0, 7); cx.clip();
      const sg = cx.createLinearGradient(0, sy - sR, 0, sy + sR); sg.addColorStop(0, "#FFD79A"); sg.addColorStop(0.5, "#FF8FB0"); sg.addColorStop(1, "#B86CD8");
      cx.fillStyle = sg; cx.fillRect(sx - sR, sy - sR, sR * 2, sR * 2);
      for (let i = 0; i < 13; i++) { const yy = sy - sR * 0.1 + i * (sR * 2 / 13); cx.fillStyle = "rgba(5,7,12,.92)"; cx.fillRect(sx - sR, yy, sR * 2, Math.max(0.6, 2.6 - i * 0.14)); }
      cx.restore();
      cx.strokeStyle = "rgba(91,180,255,.20)"; cx.lineWidth = 1;
      for (let i = 0; i <= 18; i++) { const fx = i / 18 - 0.5; cx.beginPath(); cx.moveTo(W / 2 + fx * W * 0.2, hy); cx.lineTo(W / 2 + fx * W * 2.4, H); cx.stroke(); }
      for (let i = 1; i <= 12; i++) { const p = i / 12, off = (t * 0.25) % (1 / 12); const yy = hy + (H - hy) * Math.min(1, (p + off) * (p + off)); cx.globalAlpha = 0.5 * (1 - p * 0.4); cx.beginPath(); cx.moveTo(0, yy); cx.lineTo(W, yy); cx.stroke(); }
      cx.globalAlpha = 1;
      parts.forEach((pt) => { pt.y -= (pt.z * 0.5) / H; if (pt.y < -0.02) { pt.y = 1.02; pt.x = Math.random(); } cx.fillStyle = `rgba(180,220,255,${0.25 * pt.z})`; cx.fillRect(pt.x * W, pt.y * H, pt.s, pt.s); });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  // 페이지 전환 = React 상태 기반 (다시 그려도 안 깨짐)
  const pcls = (i: number) => (i < cur ? "turned" : "stack");
  const pst = (i: number): CSSProperties => ({ zIndex: PAGES - i });

  const grp = (g: string) => (markets.length ? markets : SAMPLE_MARKETS).filter(m => m.group === g);
  const kr = grp("국내"), us = grp("미국"), asia = grp("아시아"), eu = grp("유럽"), rate = grp("금리"), comm = grp("원자재"), ind = grp("지표");
  const NS = nstocks.length ? nstocks : SAMPLE_STOCKS;
  const news = (b.news && b.news.length) ? b.news : SAMPLE_NEWS;
  const strat = (b.strategy && b.strategy.up) ? b.strategy : SAMPLE_STRAT;
  const sectors = (b.sectors && b.sectors.length) ? b.sectors : SAMPLE_SECTORS;
  const temp = b.temp || live.risk || 72;

  // 오늘의 시장 점수 (시장 전체 종합 — 합법 영역, 개별종목 점수 아님)
  const avg = (a: MItem[]) => a.length ? a.reduce((x, m) => x + m.chg, 0) / a.length : 0;
  const vix = ind.find(x => x.name.includes("VIX"))?.level ?? 16;
  const rawScore = 50 + avg(us) * 3.2 + avg(kr) * 2.2 + (18 - vix) * 1.0 + (live.btcChg ?? 0) * 0.3;
  const score = Math.max(3, Math.min(99, Math.round(rawScore)));
  const scoreLabel = score >= 72 ? "위험선호 강함 · 적극적 분위기" : score >= 58 ? "우호적 출발 예상" : score >= 45 ? "중립 · 관망" : score >= 32 ? "조심스러운 분위기" : "위험회피 우위";
  const scoreColor = score >= 58 ? "var(--up)" : score <= 42 ? "var(--down)" : "var(--gold)";
  const points = [...sectors].sort((a, b) => b.chg - a.chg).slice(0, 4).map(s => ({ t: `${s.name} ${s.chg >= 0 ? "자금 유입" : "차익 실현"}`, v: s.chg }));
  const oneLine = b.tldr || "밤사이 美 증시 강세 마감. 외국인 순매수 전환으로 우호적 출발이 예상됩니다.";
  const asofTxt = asof ? new Date(asof).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) + " 기준" : "실시간";

  const ixrows = (items: MItem[]) => items.length
    ? items.map(m => <div className="ixr" key={m.name}><span className="n">{m.name}</span><span className="v">{fmtLevel(m)}</span><span className={"c " + cc(m.chg)}>{ar(m.chg)}</span></div>)
    : <div className="empty">연동 중…</div>;

  const openNStock = (s: NStock) => openStock({ rank: s.rank, name: s.name, market: s.market, code: s.code, price: s.price, chg: s.chg, turnover: s.turnover, volume: s.volume, pos52: "", note: "", reason: `거래대금 ${s.turnover} · 시총 ${s.marketcap}`, spark: [], pro: false, profile: [], forecast: { trend: "", up: "", down: "" } } as Stock);

  return (
    <>
      <div className="hud">
        <span className="brand">DAWN</span><span className="kr">여명 · v15</span>
        <span className="date">{fmtDate()}</span>
        <span className="clk"><i style={{ opacity: live.ok ? 1 : 0.3 }} />{live.clock}</span>
      </div>

      <div id="dawnbook">
        {/* 0 LANDING */}
        <section className={"page " + pcls(0)} style={pst(0)}>
          <div className="sheen" /><canvas ref={cvRef} className="lcv" />
          <div className="hero-c">
            <div className="hero-tag">PRE-MARKET INTELLIGENCE</div>
            <h1 className="hero-title">DAWN</h1><div className="hero-sub">黎明</div>
            <div className="hero-line">장이 열리기 전, 가장 먼저 시장을 읽다.</div>
            <button className="hero-cta" onClick={() => go(1)}>브리핑 시작 &nbsp;→</button>
          </div>
          <div className="hero-hint">페이지를 <b>넘겨</b> 오늘 시장 한눈에 · 클릭 / → / 스크롤</div>
          <div className="tickwrap"><div className="tickrow">
            {[...kr, ...us].map((m, i) => (<span className="tk" key={i}><b>{m.name}</b> {comma(m.level)} {m.chg !== 0 && <span className={cc(m.chg)}>{(m.chg >= 0 ? "+" : "") + m.chg.toFixed(2)}%</span>}</span>))}
            <span className="tk"><b>USD/KRW</b> {live.krw}</span>
            <span className="tk"><b>BTC</b> {live.btc} {live.btcChg != null && <span className={cc(live.btcChg)}>{(live.btcChg >= 0 ? "+" : "") + live.btcChg.toFixed(2)}%</span>}</span>
          </div></div>
        </section>

        <Page no="01" title="오늘의 한 장" of="아침에 3초, 오늘 시장 한눈에" cls={pcls(1)} style={pst(1)}>
          <div className="panel c5" style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <div className="pl" style={{ margin: "0 auto 8px" }}>오늘의 시장 점수</div>
            <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "clamp(56px,11vw,84px)", lineHeight: 1, background: "var(--dawn)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{score}</div>
            <div style={{ fontSize: 15, color: scoreColor, fontWeight: 600, marginTop: 10 }}>{scoreLabel}</div>
            <div className="seg" style={{ marginTop: 16, width: "100%" }}>{Array.from({ length: 10 }).map((_, i) => <i key={i} className={i < Math.round(score / 10) ? "on" : ""} />)}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>美 증시·환율·수급·변동성 종합 · 시장 전체 지표</div>
          </div>
          <div className="panel c7">
            <div className="pl"><span className="lvdot" />오늘 이건 보세요</div>
            {points.map((pt, i) => (<div className="ixr" key={i}><span className="n" style={{ flex: 1 }}>{pt.t}</span><span className={"c " + cc(pt.v)}>{ar(pt.v)}</span></div>))}
            <p className="tldrp" style={{ marginTop: 12 }}>{oneLine}</p>
          </div>
          <div className="panel c12" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <div className="pl" style={{ margin: 0 }}>안내</div>
            <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>오늘의 <b style={{ color: "var(--cyan)" }}>시장 전체 점수</b>는 美 증시·환율·수급·변동성을 종합한 참고 지표입니다. 개별 종목 매수·매도 권유가 아니며, 최종 투자 판단과 책임은 본인에게 있습니다.</p>
          </div>
        </Page>

        <Page no="02" title="글로벌 마켓" of={`밤사이 美 종가 · ${asofTxt}`} cls={pcls(2)} style={pst(2)}>
          <div className="panel c3"><div className="pl"><span className="lvdot" />국내 지수</div>{ixrows(kr)}</div>
          <div className="panel c3"><div className="pl">美 지수</div>{ixrows(us)}</div>
          <div className="panel c3"><div className="pl">아시아</div>{ixrows(asia)}</div>
          <div className="panel c3"><div className="pl">유럽</div>{ixrows(eu)}</div>
          <div className="panel c6"><div className="pl">나스닥 추이</div><Spark data={us.find(x => x.name.includes("나스닥"))?.spark} up={(us[0]?.chg ?? 0) >= 0} /></div>
          <div className="panel c3"><div className="pl"><span className="lvdot" />환율</div>
            <div className="ixr"><span className="n">달러/원</span><span className="v">{live.krw}</span><span className="c">{live.fxLive ? "실시간" : "—"}</span></div>
            <div className="ixr"><span className="n">엔/100</span><span className="v">{live.jpy}</span><span className="c" /></div>
            <div className="ixr"><span className="n">유로/달러</span><span className="v">{live.eur}</span><span className="c" /></div>
          </div>
          <div className="panel c3"><div className="pl"><span className="lvdot" />위험 선호</div><div className="big"><span className="v">{temp}</span><span className="c" style={{ color: "var(--gold)" }}>{temp >= 65 ? "탐욕" : temp <= 35 ? "공포" : "중립"}</span></div><div className="seg">{Array.from({ length: 10 }).map((_, i) => <i key={i} className={i < Math.round(temp / 10) ? "on" : ""} />)}</div></div>
        </Page>

        <Page no="03" title="매크로 지표" of={`금리·원자재·환율·코인 · ${asofTxt}`} cls={pcls(3)} style={pst(3)}>
          <div className="panel c4"><div className="pl">금리 · 국채</div>{ixrows(rate)}</div>
          <div className="panel c4"><div className="pl">원자재</div>{ixrows(comm)}</div>
          <div className="panel c4"><div className="pl">변동성 · 달러</div>{ixrows(ind)}</div>
          <div className="panel c4"><div className="pl"><span className="lvdot" />비트코인</div><div className="big"><span className="v" style={{ fontSize: 21 }}>{live.btc}</span>{live.btcChg != null && <span className={"c " + cc(live.btcChg)}>{ar(live.btcChg)}</span>}</div><div className="ixr"><span className="n">이더리움</span><span className="v">{live.eth}</span>{live.ethChg != null && <span className={"c " + cc(live.ethChg)}>{ar(live.ethChg)}</span>}</div></div>
          <div className="panel c8"><div className="pl">오늘의 한 줄</div><p className="tldrp">{b.tldr || "글로벌 지표를 수집하고 있습니다…"}</p></div>
        </Page>

        <Page no="04" title="외국인·기관 수급" of="매매동향 · 억원" cls={pcls(4)} style={pst(4)}>
          <div className="panel c6 scroll"><div className="pl"><span className="lvdot" />투자자별 순매수 (코스피)</div>
            <table className="tbl"><thead><tr><th>투자자</th><th>순매수</th></tr></thead><tbody>
              {SUPPLY.map(([nm,v,up])=>(<tr key={nm}><td className="nm">{nm}</td><td className={up?"u":"d"}>{(v>=0?"+":"")+v.toLocaleString("en-US")}</td></tr>))}
            </tbody></table>
          </div>
          <div className="panel c6 scroll"><div className="pl">외국인 순매수 상위</div>
            <table className="tbl"><tbody>{NS.slice(0,6).map(s=>(<tr key={s.code}><td className="nm">{s.name}</td><td className="u">+{(s.rank*180+200)}억</td></tr>))}</tbody></table>
          </div>
        </Page>

        <Page no="05" title="거래대금 상위" of="실시간 · 관찰용" cls={pcls(5)} style={pst(5)}>
          <div className="panel c12 scroll"><div className="pl"><span className="lvdot" />거래대금 상위 종목 <span className="rt">{asofTxt}</span></div>
            {NS.length ? (
              <table className="tbl"><thead><tr><th>#</th><th>종목</th><th>현재가</th><th>등락</th><th>거래대금</th><th>거래량</th><th>시총</th></tr></thead>
                <tbody>{NS.map(s => (
                  <tr key={s.code} onClick={() => openNStock(s)} style={{ cursor: "pointer" }}>
                    <td className="no">{s.rank}</td><td className="nm">{s.name}<div className="sub">{s.market} {s.code}</div></td>
                    <td>{comma(s.price)}</td><td className={cc(s.chg)}>{ar(s.chg)}</td><td>{s.turnover}</td><td>{s.volume}</td><td>{s.marketcap}</td>
                  </tr>))}</tbody></table>
            ) : <Soon txt="종목 시세 연동 중… (네이버 증권)" />}
          </div>
        </Page>

        <Page no="06" title="섹터 · 테마" of="강세 업종 · 자금 흐름" cls={pcls(6)} style={pst(6)}>
          <div className="panel c6"><div className="pl"><span className="lvdot" />업종 등락</div>{sectors.map(s => <div className="ixr" key={s.name}><span className="n">{s.name}</span><span className={"c " + cc(s.chg)}>{ar(s.chg)}</span></div>)}</div>
          <div className="panel c6"><div className="pl">섹터 자금 유출입</div>
            <div className="bars">{sectors.slice(0,5).map(s => (<div className="bar" key={s.name}><span className="bn">{s.name}</span><div className="bt"><div className="bf" style={{width:Math.min(95,Math.abs(s.chg)*16+10)+"%",background:s.chg>=0?"var(--up)":"var(--down)"}} /></div><span className={"bv "+cc(s.chg)}>{(s.chg>=0?"+":"")+(s.chg*900|0)}억</span></div>))}</div>
          </div>
        </Page>

        <Page no="07" title="AI 뉴스 · 이슈" of="실시간 수집" cls={pcls(7)} style={pst(7)}>
          <div className="panel c7 scroll"><div className="pl"><span className="lvdot" />실시간 뉴스</div>
            <div className="nw">{news.length ? news.slice(0, 6).map(n => (
              <div className="n" key={n.id} onClick={() => openNews(n)} style={{ cursor: "pointer" }}><span className="dotn" /><div><div className="tt">{n.title}</div><div className="mt">{n.source} · {n.ago}</div></div></div>
            )) : <Soon txt="뉴스 연동 중… (네이버 검색)" />}</div>
          </div>
          <div className="panel c5"><div className="pl">전략 시나리오</div><div className="strat">
            <div className="s"><span className="b up">강세</span><p>{strat.up}</p></div>
            <div className="s"><span className="b ob">관찰</span><p>{strat.ob}</p></div>
            <div className="s"><span className="b dn">주의</span><p>{strat.dn}</p></div>
          </div></div>
        </Page>

        <Page no="08" title="종목 심층 분석" of="차트·지표·수급" cls={pcls(8)} style={pst(8)}>
          <div className="panel c8"><div className="pl"><span className="lvdot" />{NS[0].name} {NS[0].code}</div>
            <div className="big"><span className="v">{comma(NS[0].price)}</span><span className={"c "+cc(NS[0].chg)}>{ar(NS[0].chg)}</span><span className="rt" style={{marginLeft:"auto"}}>시총 {NS[0].marketcap}</span></div>
            <Spark data={[60,62,61,64,66,65,68,71]} up={true} />
          </div>
          <div className="panel c4"><div className="pl">4-지표 수렴</div>
            <div className="ixr"><span className="n">DMI(추세)</span><span className="v g">+ADX 28</span><span className="c u">강세</span></div>
            <div className="ixr"><span className="n">MACD</span><span className="v">골든크로스</span><span className="c u">전환</span></div>
            <div className="ixr"><span className="n">Stochastic</span><span className="v">68</span><span className="c gd2">중립</span></div>
            <div className="ixr"><span className="n">CCI</span><span className="v">+112</span><span className="c u">과매수</span></div>
          </div>
          <div className="panel c6"><div className="pl">수급 (5일)</div>
            <div className="bars">
              <div className="bar"><span className="bn">외국인</span><div className="bt"><div className="bf" style={{width:"78%",background:"var(--up)"}} /></div><span className="bv u">+1,240억</span></div>
              <div className="bar"><span className="bn">기관</span><div className="bt"><div className="bf" style={{width:"42%",background:"var(--up)"}} /></div><span className="bv u">+620억</span></div>
              <div className="bar"><span className="bn">개인</span><div className="bt"><div className="bf" style={{width:"55%",background:"var(--down)"}} /></div><span className="bv d">-1,860억</span></div>
            </div>
          </div>
          <div className="panel c6"><div className="pl">52주 · 평가</div>
            <div className="ixr"><span className="n">52주 최고</span><span className="v">102,000</span></div>
            <div className="ixr"><span className="n">52주 최저</span><span className="v">49,900</span></div>
            <div className="ixr"><span className="n">PER / PBR</span><span className="v">14.2 / 1.42</span></div>
            <div className="ixr"><span className="n">목표주가(컨센)</span><span className="v">108,000</span><span className="c u">+14%</span></div>
          </div>
        </Page>

        <Page no="09" title="일정 · 캘린더" of="실적·공시·지표" cls={pcls(9)} style={pst(9)}>
          <div className="panel c12 scroll"><div className="pl"><span className="lvdot" />오늘의 일정</div>
            <div className="cal">{CAL.map(([tm,ev])=>(<div className="ev" key={tm+ev}><span className="tm">{tm}</span><div><div className="ec">{ev}</div></div></div>))}</div>
          </div>
        </Page>

        <Page no="10" title="글로벌 야간 동향" of="美 종가 · 아시아·유럽" cls={pcls(10)} style={pst(10)}>
          <div className="panel c6"><div className="pl">美 지수</div>{ixrows(us)}</div>
          <div className="panel c6"><div className="pl">아시아 · 유럽</div>{ixrows([...asia, ...eu])}</div>
          <div className="panel c12"><div className="pl">밤사이 핵심</div><p className="tldrp">{b.tldr || "—"}</p></div>
        </Page>

        <Page no="11" title="전략 · 체크리스트" of="시나리오 · 리스크" cls={pcls(11)} style={pst(11)}>
          <div className="panel c6"><div className="pl">전략 시나리오</div><div className="strat">
            <div className="s"><span className="b up">강세</span><p>{strat.up}</p></div>
            <div className="s"><span className="b ob">관찰</span><p>{strat.ob}</p></div>
            <div className="s"><span className="b dn">주의</span><p>{strat.dn}</p></div>
          </div></div>
          <div className="panel c6"><div className="pl">안내</div><p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.55 }}><b style={{ color: "var(--cyan)" }}>투자 참고용 정보입니다.</b> 제공되는 종목·지표·뉴스는 정보 제공 목적이며, 최종 투자 판단과 책임은 본인에게 있습니다.</p></div>
        </Page>

        <Page no="12" title="탐색기 · 백테스트" of="AI 스크리너" cls={pcls(12)} style={pst(12)}>
          <div className="panel c12" style={{ alignItems: "center", justifyContent: "center" }}>
            <p className="tldrp" style={{ textAlign: "center", marginBottom: 16 }}>AI 종목 스크리너 · 매매기법 백테스트 검증</p>
            <a href="/finder" className="hero-cta" style={{ animation: "none", opacity: 1, textDecoration: "none" }}>탐색기 열기 →</a>
          </div>
        </Page>
      </div>

      <div className={"bk-nav" + (cur > 0 ? " show" : "")}>
        <div className="arw" onClick={() => go(cur - 1)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg></div>
        <div className="dots">{Array.from({ length: PAGES }).map((_, i) => <span key={i} className={"dt" + (i === cur ? " on" : "")} onClick={() => go(i)} />)}</div>
        <div className="arw" onClick={() => go(cur + 1)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg></div>
      </div>
    </>
  );
}
