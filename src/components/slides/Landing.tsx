import { quoteOfToday } from "../../lib/quotes";

const WK = ["일", "월", "화", "수", "목", "금", "토"];

export function Landing({ onEnter }: { onEnter: () => void }) {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  const q = quoteOfToday();
  return (
    <div className="lwrap">
      <div className="sun" />
      <div className="lc">
        <div className="l-brand">DAWN · 여명</div>
        <div className="l-date"><div className="dnum">{mm}.{dd}</div><div className="dsub">{d.getFullYear()} · {WK[d.getDay()]}요일</div></div>
        <div className="quote">
          <div className="qk">“{q.k}”</div>
          <div className="qe">{q.e}</div>
          <div className="qb">{q.b}</div>
        </div>
        <div className="rule" />
        <div className="slogan">장이 열리기 전, 시장을 읽다.</div>
        <div className="by-wrap">
          <div className="by-label">Crafted by</div>
          <div className="by-name">Park Yejun</div>
          <div className="by-line" />
        </div>
        <button className="enter" onClick={onEnter}>시작하기 <span>→</span></button>
      </div>
    </div>
  );
}
