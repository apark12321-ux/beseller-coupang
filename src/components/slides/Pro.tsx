function KakaoIcon() {
  return <svg viewBox="0 0 24 24" fill="#191600"><path d="M12 3C6.9 3 3 6.3 3 10.3c0 2.6 1.7 4.9 4.3 6.2-.2.7-.7 2.5-.8 2.9 0 .2.1.4.3.2.3-.2 2.6-1.8 3.6-2.5.5.1 1 .1 1.6.1 5.1 0 9-3.3 9-7.3S17.1 3 12 3z" /></svg>;
}
export function Pro({ openPrice, openKakao }: { openPrice: () => void; openKakao: () => void }) {
  const rows: [string, string, string][] = [
    ["아침 브리핑 · 뉴스", "✓", "✓"], ["오늘의 주목주", "2종목", "전체"],
    ["거래량 프로파일", "—", "✓"], ["관심종목 맞춤·뉴스", "—", "✓"], ["장중 급변 알림", "—", "✓"],
  ];
  return (
    <div className="swrap">
      <div className="shead"><span className="ix">06</span><h2>여명 PRO</h2><span className="of">무료 vs 프로</span></div>
      <div className="scontent">
        <div className="pro-head rise d1">무료는 여기까지.<br /><span className="accent">PRO는 여기서 시작</span>합니다.</div>
        <div className="cmp rise d2">
          <div className="cmp-h"><span /><span className="ch-free">무료</span><span className="ch-pro">프로</span></div>
          {rows.map(([f, a, p]) => (
            <div className="cmp-r" key={f}><span className="cf">{f}</span><span className={"cv " + (a === "✓" ? "ok" : a === "—" ? "no" : "lim")}>{a}</span><span className="cv pok">{p}</span></div>
          ))}
        </div>
        <button className="pro-cta rise d3" onClick={openPrice}>₩9,900 / 월 · PRO 시작 <span>→</span></button>
        <button className="kakao-btn rise d3" onClick={openKakao}><KakaoIcon />카카오톡으로 매일 받기</button>
        <div className="pro-fine rise d3">매일 06:30 발송 · 첫 7일 무료 · 언제든 해지</div>
      </div>
    </div>
  );
}
