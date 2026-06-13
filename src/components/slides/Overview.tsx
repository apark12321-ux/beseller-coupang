import { useRef } from "react";
import { Briefing } from "../../lib/types";
import { Live } from "../../hooks/useLive";
import { useActive } from "../Deck";
import { CountUp } from "../ui";

const SEG = 24;
function segColor(r: number) { return r < 0.4 ? "#2563EB" : r < 0.68 ? "#0EA5E9" : "#C98A2B"; }

export function Overview({ b, live, day, trialActive }: { b: Briefing; live: Live; day: number; trialActive: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useActive(ref);
  const risk = live.risk;
  const lit = Math.round((risk / 100) * SEG);
  const status = risk >= 70 ? "온화 · 위험선호" : risk >= 45 ? "중립" : "흐림";

  return (
    <div className="ovwrap" ref={ref}>
      <div className="scontent">
        <div className="center">
          <div className="livebar rise d1">
            <span className={"live-dot" + (live.ok ? "" : " off")} />
            <span className={"live-tag" + (live.ok ? "" : " off")}>{live.ok ? "LIVE" : "샘플"}</span>
            <span>{live.clock}</span><span className="live-sep">·</span><span>갱신 {live.ago}초 전</span>
          </div>
        </div>
        <div className="center">
          <span className={"trial " + (trialActive ? "on" : "off")} style={{ marginTop: 10 }}>
            {trialActive ? `무료 체험 ${day}일차 · 전체 기능 열림` : "체험 종료 · PRO 미리보기"}
          </span>
        </div>
        <h1 className="rise d1">오늘의 <span className="accent">시장</span></h1>
        <div className="temp rise d2">
          <div className="temp-head"><span className="lab">시장 체온 · 위험선호 지수</span><span className="val">{status}</span></div>
          <div className="dtemp">
            <div className="dtemp-read"><span className="dtemp-num"><CountUp value={risk} run={active} /></span><span className="dtemp-max">/ 100</span></div>
            <div className="dtemp-seg">
              {Array.from({ length: SEG }).map((_, i) => (
                <span key={i} className="sg" style={{ background: active && i < lit ? segColor(i / SEG) : "var(--surface-2)", transitionDelay: (i * 28) + "ms" }} />
              ))}
            </div>
            <div className="dtemp-scale"><span>한파</span><span>흐림</span><span>온화</span><span>맑음</span></div>
          </div>
        </div>
        <div className="tldr rise d3"><div className="eb">오늘의 한 줄</div><p>{b.tldr || "데이터 연동 시 오늘의 시장 요약이 표시됩니다."}</p></div>
        {b.points.length > 0 && (
          <div className="points rise d4">
            <div className="pt-h">핵심 포인트</div>
            {b.points.map((p, i) => <div className="pl" key={i}><span className="mk">▸</span><div>{p}</div></div>)}
          </div>
        )}
      </div>
    </div>
  );
}
