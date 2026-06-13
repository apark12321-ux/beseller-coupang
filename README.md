# DAWN · 여명 — 아침 시장 브리핑

장이 열리기 전, 시장을 읽다. 한국 개인 투자자를 위한 매일 아침 6:30 프리마켓 브리핑.
Vite + React + TypeScript. Vercel 배포. 데이터는 서버리스 함수(`api/`)에서 모아 프론트로 전달.

가로 페이지 덱(스와이프/키보드/점), 라이트·쿨 톤, 한국식 색(상승=빨강·하락=파랑),
실시간 시계·환율·BTC, 디지털 시장 체온, 종목 상세(추이+시나리오), 뉴스 상세, 카카오 구독,
그리고 **체험 게이팅(1일차 풀오픈 / 2일차 유료 잠금)**.

---

## 1. 정확한 서비스를 위해 호출해야 하는 API

프론트는 `src/lib/api.ts` 의 `fetchBriefing()` 으로 **`/api/briefing`** 하나만 부릅니다.
그 서버리스 함수가 아래 소스들을 모아 `src/lib/types.ts` 의 `Briefing` 스키마로 반환합니다.
**모든 시크릿은 서버리스(`api/`)에서만** 사용하고 클라이언트로 노출하지 않습니다.

| 데이터 | API | 호출 위치 | 환경변수 |
|---|---|---|---|
| 국내 거래량/거래대금 상위·현재가·수급 | **키움증권 REST API** `POST /api/dostk/rkinfo` (api-id: `ka10030` 당일거래량상위 · `ka10032` 거래대금상위) | `api/quotes.ts` | `KIWOOM_APP_KEY`, `KIWOOM_SECRET_KEY`, `KIWOOM_BASE` |
| 실시간 체결 → **거래량 프로파일(매물대)** | 키움 **WebSocket** `wss://api.kiwoom.com:10000/api/dostk/websocket` (주식체결 type `0B` 누적) | 별도 워커/크론 | 〃 |
| 토큰 발급 | 키움 `POST /oauth2/token` (응답 필드 `token`) | `api/kiwoom-token.ts` | 〃 |
| 미국 지수(나스닥/S&P/다우) | **Twelve Data** `quote?symbol=IXIC,SPX,DJI` (무료 키) | `api/us-indices.ts` | `TWELVEDATA_API_KEY` |
| 환율(원/달러) | 한국은행 **ECOS** 또는 `open.er-api.com`(무키) | 프론트 직접 또는 서버 | (ECOS 시 키) |
| 뉴스(시장·종목 연관) | **네이버 검색 API(news)** / 언론사 RSS | `api/news.ts` | `NAVER_CLIENT_ID/SECRET` |
| 공시 | 금융감독원 **DART OpenAPI** | `api/briefing.ts` | `DART_API_KEY` |
| 24h 위험선호 프록시(BTC) | Binance `ticker/24hr` (무키) | 프론트 직접 | — |
| 카카오 발송(06:30) | 카카오 메시지/알림톡 API + Vercel Cron | 발송 워커 | `KAKAO_*` |

> 키가 없으면 `/api/briefing` 이 **501** 을 반환하고, 프론트는 자동으로 `src/data/sample.ts`(SAMPLE)로 폴백합니다.
> 즉 키 없이 배포해도 화면은 정상 동작(데모 데이터)하고, 키를 넣는 순간 실데이터로 전환됩니다.

**운영 팁:** 매일 06:20경 Vercel Cron 으로 브리핑을 미리 생성·캐시(KV/Redis)해 두면
06:30 발송과 첫 화면 로딩이 안정적입니다. 거래량 프로파일은 장중 WebSocket 누적이 필요하므로
별도 상시 워커(예: Railway)에서 집계해 스냅샷을 저장하는 구조를 권장합니다.

## 2. 체험 게이팅 (1일차 / 2일차)

`src/lib/trial.ts` — 첫 방문 날짜를 `localStorage` 에 저장하고 오늘과의 일수로 판단합니다.
- **1일차**: `trialActive = true` → 모든 유료 콘텐츠 오픈(1~4위 종목·전체 매물대·관심종목 뉴스·보유종목 영향도).
- **2일차+**: `trialActive = false` → 유료 콘텐츠는 블러+잠금(`<Gate>`), 탭하면 결제 시트.

테스트용 URL 파라미터:
- `?day=2` → 2일차(잠금) 상태 강제 미리보기
- `?day=1` → 1일차(풀오픈)
- `?reset` → 가입일 초기화

실결제·계정 연동 시에는 `trial.ts` 를 서버 세션/구독 상태로 교체하세요.

## 3. 뉴스 클릭 → 상세

뉴스 항목 탭 → `NewsModal`(제목·출처·시간·요약·연관 종목·원문 링크). 데이터는 `Briefing.news[]`,
실서비스에서는 `api/news.ts`(네이버) 결과를 매핑합니다.

## 4. 로컬 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 타입체크 + 프로덕션 빌드 → dist/
```

## 5. GitHub + Vercel 배포

1. 이 폴더를 GitHub 저장소로 푸시 (GitHub Desktop: Add → 커밋 → Publish).
2. Vercel → New Project → 저장소 import. 프레임워크는 **Vite** 자동 인식.
3. **Settings → Environment Variables** 에 `.env.example` 키들 입력(필요한 것만).
4. Deploy. `api/*.ts` 는 자동으로 서버리스 함수로 배포됩니다.

> 폰트는 Google Fonts(Space Grotesk·JetBrains Mono) + jsdelivr(Pretendard) CDN 사용.
> 실시간 환율·BTC는 `open.er-api.com`·`api.binance.com` 직접 호출(무키)이라 해당 도메인이 차단되면 샘플로 표시됩니다.

## 구조

```
src/
  App.tsx                 덱·모달·체험·라이브 오케스트레이션
  lib/{api,trial,quotes,types}.ts
  data/sample.ts          API 응답 스키마 + 폴백
  hooks/useLive.ts        시계·환율·BTC·위험선호
  components/
    Deck.tsx  ui.tsx  Modals.tsx
    slides/{Landing,Overview,GlobalSlide,NewsSlide,FlowSectors,Stocks,Pro}.tsx
api/
  briefing.ts  quotes.ts  news.ts  kis-token.ts
```

— Crafted by Park Yejun
