import { useEffect, useState, FormEvent } from "react";

interface KrIndex { name: string; level: number; chg: number; state?: string; }
interface Log { id: string; date: string; stockName: string; ticker: string; market: string; buyPrice: number; maxPriceToday: number; closePrice: number; result: string; profitPct: number; reason: string; }
interface Watch { rank: number; name: string; code: string; market: string; price: number; chg: number; reason: string; }

const won = (n: number) => n.toLocaleString("ko-KR");

export default function Finder() {
  const [kr, setKr] = useState<KrIndex[]>([]);
  const [watch, setWatch] = useState<Watch[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [kw, setKw] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [aerr, setAerr] = useState("");

  useEffect(() => {
    document.documentElement.style.overflow = "auto"; document.body.style.overflow = "auto";
    fetch("/api/kr-indices").then(r => r.json()).then(d => setKr(d.data || [])).catch(() => {});
    fetch("/api/briefing").then(r => r.json()).then(d => setWatch((d.stocks || []).slice(0, 4))).catch(() => {});
    fetch("/api/finder-logs").then(r => r.json()).then(d => setLogs(d.logs || [])).catch(() => {});
  }, []);

  const analyze = async (e: FormEvent) => {
    e.preventDefault();
    if (!kw.trim()) return;
    setAnalyzing(true); setAerr(""); setAnalysis("");
    try {
      const r = await fetch("/api/finder-analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyword: kw.trim() }) });
      const d = await r.json();
      if (d.success) setAnalysis(d.analysis); else setAerr(d.error || "분석 중 오류가 발생했습니다.");
    } catch { setAerr("분석 서버 연결에 실패했습니다."); }
    finally { setAnalyzing(false); }
  };

  const wins = logs.filter(l => l.result === "성공").length;
  const rate = logs.length ? Math.round((wins / logs.length) * 100) : 0;

  return (
    <div className="fp">
      <header className="fp-top">
        <a href="/" className="fp-brand"><span className="fp-logo">DAWN</span><span className="fp-sub">탐색기</span></a>
        <div className="fp-idx">
          {kr.map(k => (
            <div className="fp-ix" key={k.name}>
              <span className="fp-ixn">{k.name}</span>
              <span className="fp-ixv">{k.level.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="fp-ixc" style={{ color: k.chg >= 0 ? "var(--up)" : "var(--down)" }}>{k.chg >= 0 ? "▲" : "▼"}{Math.abs(k.chg).toFixed(2)}%</span>
            </div>
          ))}
          {kr.length === 0 && <span className="fp-muted">지수 연동 중…</span>}
        </div>
        <a href="/" className="fp-back">← 브리핑</a>
      </header>

      <main className="fp-main">
        <div className="fp-banner">
          <strong>관찰·시뮬레이션 도구</strong> · 본 페이지는 매매 기법을 검증·관찰하기 위한 자료입니다. 매수·매도 권유가 아니며,
          단타는 왕복 비용 약 0.44%를 빼고도 순수익이 남는지 항상 확인이 필요합니다.
        </div>

        <section className="fp-sec">
          <h2 className="fp-h"><span className="fp-dot" />오늘의 관찰 종목</h2>
          {watch.length > 0 ? (
            <div className="fp-grid">
              {watch.map(s => (
                <div className="fp-card" key={s.rank}>
                  <div className="fp-cardtop"><span className="fp-name">{s.name}</span><span className="fp-tk">{s.market} · {s.code}</span></div>
                  <div className="fp-chg" style={{ color: s.chg >= 0 ? "var(--up)" : "var(--down)" }}>{s.chg >= 0 ? "▲" : "▼"}{Math.abs(s.chg).toFixed(1)}%</div>
                  <div className="fp-reason">{s.reason}</div>
                </div>
              ))}
            </div>
          ) : <div className="fp-empty">키움/데이터 연동 시 관찰 종목이 표시됩니다.</div>}
        </section>

        <section className="fp-sec fp-ai">
          <span className="fp-badge">실시간 AI 스크리너</span>
          <h2 className="fp-aih">구글 검색 연동 종목 분석</h2>
          <p className="fp-aip">종목명을 입력하면 최신 뉴스·전일 수급·거래량·변동성을 실시간 검색해 <b>관찰 포인트</b>와 <b>주의 요인</b>을 정리합니다. 매수·매도 권유는 하지 않습니다.</p>
          <form className="fp-form" onSubmit={analyze}>
            <input className="fp-input" placeholder="예: 현대차, 셀트리온, SK하이닉스" value={kw} onChange={e => setKw(e.target.value)} />
            <button className="fp-btn" disabled={analyzing || !kw.trim()}>{analyzing ? "검색 중…" : "분석"}</button>
          </form>
          {aerr && <div className="fp-aerr">{aerr}</div>}
          {analysis && (
            <div className="fp-aout">
              <div className="fp-aouth"><span className="fp-ping" />Google Search Grounding 분석</div>
              <div className="fp-atext">{
                analysis.split(/\n+/).map(l => l.replace(/\*\*/g, "").trim()).filter(Boolean).map((l, i) => {
                  const isLi = /^[-*•]\s/.test(l);
                  return <p className={isLi ? "li" : ""} key={i}>{isLi ? l.replace(/^[-*•]\s/, "") : l}</p>;
                })
              }</div>
              <div className="fp-fine">* 실시간 웹 정보 기반 관찰 자료입니다. 투자 판단의 보증이 아니며 참고용입니다.</div>
            </div>
          )}
        </section>

        <section className="fp-sec">
          <h2 className="fp-h"><span className="fp-dot dk" />매매기법 검증 로그
            {logs.length > 0 && <span className="fp-rate">{logs.length}건 중 성공 {wins} · {rate}%</span>}
          </h2>
          <div className="fp-logs">
            {logs.map(l => (
              <div className="fp-log" key={l.id}>
                <div className="fp-logl">
                  <div className="fp-logname">{l.stockName} <span className="fp-logtk">{l.market} {l.ticker}</span></div>
                  <div className="fp-logreason">{l.reason}</div>
                  <div className="fp-logdate">{l.date}</div>
                </div>
                <div className="fp-logr">
                  <span className={"fp-res " + (l.result === "성공" ? "ok" : "no")}>{l.result}</span>
                  <span className="fp-pct" style={{ color: l.profitPct >= 0 ? "var(--up)" : "var(--down)" }}>{l.profitPct >= 0 ? "+" : ""}{l.profitPct.toFixed(2)}%</span>
                  <span className="fp-logp">매수 {won(l.buyPrice)} · 고가 {won(l.maxPriceToday)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="fp-sec fp-faq">
          <h2 className="fp-h"><span className="fp-dot" />하루 1% · NXT 가이드</h2>
          <div className="fp-faqgrid">
            <div><h4>8시 NXT 장전 시간외란?</h4><p>오전 8시~8시 40분, 전일 종가 기준 호가 매칭으로 거래하는 제도. 장전 잔량이 급증한 종목은 당일 수급의 단서가 되지만 체결 물량이 제한적이라 변동성이 큽니다.</p></div>
            <div><h4>왜 '1%'인가?</h4><p>수수료·거래세를 빼면 1%는 비교적 실현 가능한 목표입니다. 5~10% 욕심보다, 초반 변동 구간에서 짧게 보고 원금을 지키는 관점입니다. 단, 비용 0.44%를 빼고도 남는지 확인이 전제입니다.</p></div>
            <div><h4>관찰 종목은 어떻게 뽑나?</h4><p>전일 거래대금 상위에서 과열·악재를 거르고, 일정·뉴스가 받쳐주는 종목을 관찰 대상으로 추립니다. 매수 지시가 아니라 '왜 주목하는가'의 근거 제공입니다.</p></div>
            <div><h4>손절 기준</h4><p>장전 진입 종목은 변동성이 큽니다. 시초 흐름이 약하면 기계적으로 끊어내는 규율이 핵심입니다. 검증 로그처럼 실패도 그대로 기록해 기대값을 직시하세요.</p></div>
          </div>
        </section>

        <footer className="fp-foot">© 2026 DAWN · 탐색기 — 관찰·시뮬레이션용. 투자 권유 아님.</footer>
      </main>
    </div>
  );
}
