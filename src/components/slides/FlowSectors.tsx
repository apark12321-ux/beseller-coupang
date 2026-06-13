import { useRef } from "react";
import { Briefing } from "../../lib/types";
import { useActive } from "../Deck";
import { Bar, Empty } from "../ui";

function heatStyle(chg: number): React.CSSProperties {
  if (chg >= 2) return { background: "var(--up-soft)", borderColor: "rgba(240,69,75,.3)" };
  if (chg > 0) return { background: `rgba(240,69,75,${Math.min(0.1, chg * 0.04).toFixed(3)})` };
  if (chg <= -1.2) return { background: "var(--down-soft)", borderColor: "rgba(37,99,235,.3)" };
  return { background: `rgba(37,99,235,${Math.min(0.08, Math.abs(chg) * 0.05).toFixed(3)})` };
}

export function FlowSectors({ b }: { b: Briefing }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useActive(ref);
  const empty = b.flow.length === 0 && b.sectors.length === 0;

  return (
    <div ref={ref}>
      <div className="shead"><span className="ix">04</span><h2>수급 · 섹터</h2><span className="of">자금 흐름</span></div>
      <div className="scontent">
        {empty ? <Empty label="수급·섹터 데이터 연동 중 (키움 투자자별·업종)" /> : (
          <>
            {b.flow.length > 0 && (
              <div className="flow rise d1">
                {b.flow.map((f) => (
                  <div className="fr" key={f.who}>
                    <span className="who">{f.who}</span>
                    <Bar w={f.w} color={f.dir === "up" ? "var(--up)" : "var(--down)"} run={active} />
                    <span className="amt" style={{ color: f.dir === "up" ? "var(--up)" : "var(--down)" }}>{f.label}</span>
                  </div>
                ))}
              </div>
            )}
            {b.sectors.length > 0 && (<>
              <div className="seclab rise d1">섹터 히트맵 · 어제 강·약</div>
              <div className="heat">
                {b.sectors.map((s, i) => (
                  <div className="tile" key={s.name} style={{ ...heatStyle(s.chg), animationDelay: (i * 0.05) + "s" }}>
                    <div className="sn">{s.name}</div>
                    <div className="sp" style={{ color: s.chg > 0 ? "var(--up)" : s.chg < 0 ? "var(--down)" : "var(--text-2)" }}>{s.chg > 0 ? "+" : s.chg < 0 ? "−" : ""}{Math.abs(s.chg).toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </>)}
            {b.flowNote && <div className="points rise d3"><div className="pt-h">자금 흐름</div><div className="pl"><span className="mk">▸</span><div>{b.flowNote}</div></div></div>}
          </>
        )}
      </div>
    </div>
  );
}
