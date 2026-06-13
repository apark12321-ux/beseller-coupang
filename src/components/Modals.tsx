import { NewsItem, Stock } from "../lib/types";
import { useState } from "react";

function KakaoIcon() {
  return <svg viewBox="0 0 24 24" fill="#191600"><path d="M12 3C6.9 3 3 6.3 3 10.3c0 2.6 1.7 4.9 4.3 6.2-.2.7-.7 2.5-.8 2.9 0 .2.1.4.3.2.3-.2 2.6-1.8 3.6-2.5.5.1 1 .1 1.6.1 5.1 0 9-3.3 9-7.3S17.1 3 12 3z" /></svg>;
}
function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet"><div className="grab" />{children}</div>
    </div>
  );
}

export function PriceModal({ onClose }: { onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <h3>여명 PRO</h3>
      <div className="ph">못 베끼는 깊이 — 실시간 거래량 프로파일과 개인화 브리핑.</div>
      <div className="pp free"><div className="pn">무료<small>매일 06:30 · 거시→수급→5위 1종목</small></div><div className="pv">₩0</div></div>
      <div className="pp pro"><div className="pn">프로<small>전 순위 · 프로파일 · 관심종목 · 장중 알림</small></div><div className="pv">₩9,900<small style={{ display: "inline" }}>/월</small></div></div>
      <button className="close" onClick={onClose}>닫기</button>
    </Sheet>
  );
}

export function KakaoModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [phone, setPhone] = useState("");
  return (
    <Sheet onClose={onClose}>
      <h3><span style={{ background: "#191600", borderRadius: 6, padding: 3, display: "inline-flex" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="#FEE500"><path d="M12 3C6.9 3 3 6.3 3 10.3c0 2.6 1.7 4.9 4.3 6.2-.2.7-.7 2.5-.8 2.9 0 .2.1.4.3.2.3-.2 2.6-1.8 3.6-2.5.5.1 1 .1 1.6.1 5.1 0 9-3.3 9-7.3S17.1 3 12 3z" /></svg></span> 카카오톡으로 받기</h3>
      <div className="ph">매일 아침 <b>06:30</b>, 그날의 브리핑 링크를 카카오톡으로 보내드립니다. 알림 한 번이면 침대에서 바로 열어볼 수 있어요.</div>
      <input className="kinput" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="휴대폰 번호 (예: 010-1234-5678)" inputMode="numeric" />
      <button className="kakao-btn" style={{ marginTop: 0 }} onClick={onDone}><KakaoIcon />카카오톡으로 받기</button>
      <button className="close" onClick={onClose}>나중에</button>
    </Sheet>
  );
}

export function StockModal({ stock, onClose }: { stock: Stock; onClose: () => void }) {
  const sign = stock.chg >= 0 ? "▲" : "▼";
  return (
    <Sheet onClose={onClose}>
      <div className="s-head">
        <div><div className="s-name">{stock.name}</div><div className="s-sub">{stock.market} · {stock.code}</div></div>
        <div><div className="s-price">{stock.price.toLocaleString("en-US")}원</div><div className="s-chg" style={{ color: stock.chg >= 0 ? "var(--up)" : "var(--down)" }}>{sign}{Math.abs(stock.chg).toFixed(1)}%</div></div>
      </div>
      <div className="s-stats">
        <div className="s-stat"><div className="sk">거래대금</div><div className="sv">{stock.turnover}</div></div>
        <div className="s-stat"><div className="sk">거래량</div><div className="sv">{stock.volume}</div></div>
        <div className="s-stat"><div className="sk">52주 위치</div><div className="sv">{stock.pos52}</div></div>
      </div>
      <svg className="s-chart" viewBox="0 0 300 120" preserveAspectRatio="none">
        <polygon className="s-cone" points="210,52 300,30 300,74" />
        <polyline className="s-line" points="6,92 30,86 54,88 78,74 102,70 126,78 150,60 174,54 198,48 210,52" />
        <polyline className="s-proj" points="210,52 255,46 300,40" />
      </svg>
      <div className="s-cap">실선 = 최근 추이 · 점선 = 향후 시나리오 밴드(상방~하방)</div>
      <div className="s-fore">
        <div className="fh">향후 전망 · 시나리오</div>
        <div className="fl"><span className="fb ob">추세</span><div dangerouslySetInnerHTML={{ __html: bold(stock.forecast.trend) }} /></div>
        <div className="fl"><span className="fb up">상방</span><div dangerouslySetInnerHTML={{ __html: bold(stock.forecast.up) }} /></div>
        <div className="fl"><span className="fb dn">하방</span><div dangerouslySetInnerHTML={{ __html: bold(stock.forecast.down) }} /></div>
      </div>
      <div className="s-disc">본 정보는 관찰·참고용이며 투자 권유가 아닙니다. 투자 판단과 책임은 본인에게 있습니다.</div>
      <button className="close" onClick={onClose}>닫기</button>
    </Sheet>
  );
}

export function NewsModal({ news, onClose }: { news: NewsItem; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <div className="nd-head"><span className={"ntag " + news.tag}>{news.tagText}</span><span className="nd-meta">{news.source} · {news.ago}</span></div>
      <div className="nd-title">{news.title}</div>
      <div className="nd-body">{news.summary}</div>
      {news.tickers.length > 0 && (
        <div className="nd-tickers">{news.tickers.map((t) => <span key={t} className="ndt">{t}</span>)}</div>
      )}
      <a className="nd-link" href={news.url} target="_blank" rel="noreferrer">원문 보기 →</a>
      <button className="close" onClick={onClose}>닫기</button>
    </Sheet>
  );
}

function bold(s: string) {
  return s.replace(/(\d{1,3}(?:,\d{3})+|상승|보통)/g, "<b>$1</b>");
}
