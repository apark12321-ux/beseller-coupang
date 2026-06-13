import { useRef } from "react";
import { Briefing } from "../../lib/types";
import { Live } from "../../hooks/useLive";
import { useActive } from "../Deck";
import { CountUp, Spark, Gate, LockIcon, Empty } from "../ui";

function cryptoSub(chg: number | null) {
  if (chg == null) return { t: "불러오는 중", c: "var(--muted)" };
  return { t: (chg >= 0 ? "▲" : "▼") + Math.abs(chg).toFixed(2) + "% (24h)", c: chg >= 0 ? "var(--up)" : "var(--down)" };
}

export function GlobalSlide({ b, live, trialActive, openPrice }: { b: Briefing; live: Live; trialActive: boolean; openPrice: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useActive(ref);
  const bt = cryptoSub(live.btcChg), et = cryptoSub(live.ethChg);

  return (
    <div ref={ref}>
      <div className="shead"><span className="ix">02</span><h2>실시간 · 글로벌</h2><span className="of">美 종가</span></div>
      <div className="scontent">
        {b.usIndices.length > 0 ? (
          <div className="idx">
            {b.usIndices.map((x, i) => (
              <div className={"card rise d" + (i + 1) + (i === 0 ? " lead" : "")} key={x.name}>
                <div className="name">{x.name}</div>
                <div className="chg" style={{ color: x.chg >= 0 ? "var(--up)" : "var(--down)" }}><CountUp value={Math.abs(x.chg)} dec={2} pre={x.chg >= 0 ? "▲" : "▼"} suf="%" run={active} /></div>
                <div className="lv">{x.note}</div>
                <Spark pts={x.spark} />
              </div>
            ))}
          </div>
        ) : <Empty label="美 지수 데이터 연동 중" />}

        {b.krIndices.length > 0 && (
          <div className="kridx rise d2">
            {b.krIndices.map((k) => (
              <div className="krcard" key={k.name}>
                <div className="krn">{k.name}{k.state === "REGULAR" ? <span className="krlive">LIVE</span> : <span className="krprev">전일</span>}</div>
                <div className="krlv">{k.level.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="krc" style={{ color: k.chg >= 0 ? "var(--up)" : "var(--down)" }}>{k.chg >= 0 ? "▲" : "▼"}{Math.abs(k.chg).toFixed(2)}%</div>
              </div>
            ))}
          </div>
        )}

        <div className="live-h rise d3"><span>24시간 실시간</span><span className="lmini"><i />{live.ok ? "LIVE" : "샘플"} · 갱신 {live.ago}초 전</span></div>
        <div className="live4 rise d3">
          <div className="livecard"><div className="lk"><i />원/달러</div><div className="lv">{live.krw}</div><div className="ld" style={{ color: live.fxLive ? "var(--cyan)" : "var(--muted)" }}>{live.fxLive ? "실시간" : "연결 중"}</div></div>
          <div className="livecard"><div className="lk"><i />엔/원 (100)</div><div className="lv">{live.jpy}</div><div className="ld" style={{ color: live.fxLive ? "var(--cyan)" : "var(--muted)" }}>{live.fxLive ? "실시간" : "연결 중"}</div></div>
          <div className="livecard"><div className="lk"><i />BTC</div><div className="lv">{live.btc}</div><div className="ld" style={{ color: bt.c }}>{bt.t}</div></div>
          <div className="livecard"><div className="lk"><i />ETH</div><div className="lv">{live.eth}</div><div className="ld" style={{ color: et.c }}>{et.t}</div></div>
        </div>

        {b.futures.length > 0 && (
          <div className="refline rise d4">
            <span className="rk2">참고 · 전일</span>
            {b.futures.map((f, i) => (<span key={f.k}>{i > 0 ? " · " : ""}<b>{f.k}</b> {f.v}</span>))}
          </div>
        )}

        {(!trialActive || b.holdingsImpact.length > 0) && (
          <Gate active={trialActive} onUnlock={openPrice}
            teaser={<div className="plock"><LockIcon cls="pi" /><span className="pl-t">보유 종목 영향도</span><span className="pl-v">관심종목 등록 시 표시</span><span className="pl-go">PRO →</span></div>}>
            {b.holdingsImpact.length > 0 ? (
              <div className="impact rise d5">
                <div className="pt-h">보유 종목 밤사이 영향도</div>
                <div className="imp-row">
                  {b.holdingsImpact.map((h) => (
                    <div className="imp" key={h.name}><span className="in">{h.name}</span><span className="iv" style={{ color: h.chg >= 0 ? "var(--up)" : "var(--down)" }}>{h.chg >= 0 ? "▲" : "▼"}{Math.abs(h.chg).toFixed(1)}%</span></div>
                  ))}
                </div>
              </div>
            ) : <Empty label="관심종목 등록 시 표시" />}
          </Gate>
        )}
      </div>
    </div>
  );
}
