import { Briefing, NewsItem } from "../../lib/types";
import { Gate, LockIcon, Empty } from "../ui";

export function NewsSlide({ b, trialActive, openPrice, openNews }: {
  b: Briefing; trialActive: boolean; openPrice: () => void; openNews: (n: NewsItem) => void;
}) {
  const hasStrategy = b.strategy && (b.strategy.up || b.strategy.dn || b.strategy.ob);
  return (
    <div className="swrap">
      <div className="shead"><span className="ix">03</span><h2>AI 뉴스 · 전략</h2><span className="of">실시간 수집</span></div>
      <div className="scontent">
        {b.news.length > 0 ? (
          <div className="news rise d1">
            {b.news.map((n) => (
              <div className="nr" key={n.id} onClick={() => openNews(n)}>
                <div><div className="nt">{n.title}</div><div className="nm"><span>{n.source}</span><span>·</span><span>{n.ago}</span></div></div>
                <span className={"ntag " + n.tag}>{n.tagText}</span>
              </div>
            ))}
          </div>
        ) : <Empty label="뉴스 데이터 연동 중 (네이버 검색 API)" />}

        {hasStrategy && (
          <div className="strat rise d2">
            <div className="pt-h">오늘의 전략 · 시나리오</div>
            {b.strategy.up && <div className="sl"><span className="sb up">강세</span><div>{b.strategy.up}</div></div>}
            {b.strategy.dn && <div className="sl"><span className="sb dn">약세</span><div>{b.strategy.dn}</div></div>}
            {b.strategy.ob && <div className="sl"><span className="sb ob">관찰</span><div>{b.strategy.ob}</div></div>}
          </div>
        )}

        {(!trialActive || b.watchNews.length > 0) && (
          <Gate active={trialActive} onUnlock={openPrice}
            teaser={<div className="plock"><LockIcon cls="pi" /><span className="pl-t">내 관심종목 뉴스</span><span className="pl-v">관심종목 등록 시 표시</span><span className="pl-go">PRO →</span></div>}>
            {b.watchNews.length > 0 ? (
              <div className="news rise d3" style={{ marginTop: 11 }}>
                {b.watchNews.map((n) => (
                  <div className="nr" key={n.id} onClick={() => openNews(n)}>
                    <div><div className="nt">{n.title}</div><div className="nm"><span>{n.source}</span><span>·</span><span>{n.ago}</span></div></div>
                    <span className={"ntag " + n.tag}>{n.tagText}</span>
                  </div>
                ))}
              </div>
            ) : <Empty label="관심종목 등록 시 맞춤 뉴스 표시" />}
          </Gate>
        )}
      </div>
    </div>
  );
}
