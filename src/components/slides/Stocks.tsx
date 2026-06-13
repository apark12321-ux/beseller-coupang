import { useRef } from "react";
import { Briefing, Stock } from "../../lib/types";
import { useActive } from "../Deck";
import { CountUp, LockIcon, Empty } from "../ui";

export function Stocks({ b, trialActive, openPrice, openStock }: {
  b: Briefing; trialActive: boolean; openPrice: () => void; openStock: (s: Stock) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useActive(ref);
  const lead = b.stocks[0];

  return (
    <div ref={ref}>
      <div className="shead"><span className="ix">05</span><h2>오늘의 주목주</h2><span className="of">AI 선별 · 관찰용</span></div>
      <div className="scontent">
        {b.stocks.length === 0 ? <Empty label="주목주 데이터 연동 중 (키움 순위정보)" /> : (
          <>
            <div className="pk-note rise d1">수급·거래량·뉴스로 선별한 관찰 종목입니다 · 투자 권유 아님</div>
            <div className="rank rise d1">
              {b.stocks.map((s, i) => {
                const locked = s.pro && !trialActive;
                if (locked) return (
                  <div className="pk lock" key={s.rank} onClick={openPrice}>
                    <span className="pk-no">{i + 1}</span>
                    <div className="pk-body"><div className="pk-name-sk" style={{ width: 46 + (i % 3) * 8 + "%" }} /><div className="pk-rsn-sk" style={{ width: 70 - (i % 3) * 6 + "%" }} /></div>
                    <LockIcon cls="lk2" />
                  </div>
                );
                return (
                  <div className="pk" key={s.rank} onClick={() => openStock(s)}>
                    <span className="pk-no">{i + 1}</span>
                    <div className="pk-body">
                      <div className="pk-name"><span className="t">{s.name}</span>{!s.pro ? <span className="pk-tag free">무료</span> : <span className="pk-tag">PRO</span>}</div>
                      <div className="pk-rsn">{s.reason}</div>
                    </div>
                    <div className="pk-chg" style={{ color: s.chg >= 0 ? "var(--up)" : "var(--down)" }}>
                      <CountUp value={Math.abs(s.chg)} dec={1} pre={s.chg >= 0 ? "▲" : "▼"} suf="%" run={active} />
                    </div>
                  </div>
                );
              })}
            </div>
            {lead && lead.profile.length > 0 && (
              <div className="vp rise d2">
                <div className="vh"><span className="vt">{lead.name} · 거래량 프로파일</span><span className="vs">매물대</span></div>
                {lead.profile.map((p) => (
                  <div className={"vpr" + (p.poc ? " poc" : "")} key={p.price}>
                    <span className="pr">{p.price.toLocaleString("en-US")}</span>
                    <div className="trk"><i style={{ width: active ? p.vol + "%" : 0 }} /></div>
                    <span className="pt">{p.poc ? "POC" : ""}</span>
                  </div>
                ))}
              </div>
            )}
            {!trialActive && (
              <div className="vault rise d3">
                <div className="vz">{[34, 48, 58, 72, 86, 96, 100, 92, 80, 68, 76, 60, 50, 42, 36, 30].map((h, i) => <div className="col" key={i} style={{ height: h + "%", animationDelay: (i * 0.08) + "s" }} />)}</div>
                <div className="frost" />
                <div className="vface">
                  <div className="vlock"><LockIcon /></div>
                  <div><div className="vk">PRO ACCESS</div><div className="vt">전체 주목주 · 종목별 매물대</div></div>
                  <button className="vbtn" onClick={openPrice}>열어보기 <span>→</span></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
