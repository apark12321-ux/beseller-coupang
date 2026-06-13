# 배포 가이드 — GitHub + Vercel

## ⚠️ 핵심 결정: 왜 "통째로 Vercel"이 아니라 하이브리드인가

쿠팡 OpenAPI '자체개발(직접입력)'은 **등록된 고정 IP에서만** 호출이 허용된다(최대 10개).
미등록 IP에서 호출하면 `403 [FORBIDDEN] Not allowed IP`. Vercel 서버리스 함수는 고정
egress IP가 없으므로(대역도 등록 불가) **쿠팡 GET/POST는 Vercel에서 무조건 403이 난다.**

따라서:

| 구성요소 | 어디서 실행 | 이유 |
|---|---|---|
| 대시보드 UI, CSV 업로드/파싱, 분류, 상품명/옵션/가격/이미지/고시, payload 미리보기, **Dry Run**, pre-check, 리포트 생성 | **Vercel** OK | 쿠팡 호출 없음 |
| 쿠팡 **GET 테스트**, 실제 **POST**(임시저장) | **등록된 고정 IP** 필요 | 자체개발 IP 화이트리스트 |

고정 IP 확보 방법(택1):
1. **로컬 실행**(가장 단순): GET/POST가 필요한 순간엔 등록 IP를 가진 PC에서 `npm run dev`.
2. **고정 IP 릴레이**: 작은 VPS/홈서버(고정 IP를 WING에 등록)에 이 앱을 띄우고 그쪽에서 호출.
3. (확장) Vercel UI는 그대로 두고, 쿠팡 호출만 고정 IP 릴레이로 포워딩하는 에이전트 추가 — 필요하면 다음 단계에서 만들어줌.

---

## 1) GitHub에 올리기

이미 로컬 git 커밋 완료됨. 원격만 연결하면 된다.

```bash
# GitHub에서 빈 저장소 생성 후 (예: avro/beseller-coupang)
git remote add origin https://github.com/<계정>/beseller-coupang.git
git branch -M main
git push -u origin main
```

`.env.local`은 `.gitignore`에 있어 **절대 커밋되지 않는다**(확인 완료). 키는 깃에 올리지 말 것.

## 2) Vercel 배포

1. vercel.com → Add New → Project → 방금 만든 GitHub 저장소 Import.
2. Framework: Next.js 자동 감지. Build/Output 기본값 그대로.
3. **Environment Variables** 등록(Project Settings → Environment Variables):
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — **Vercel 배포 시 필수**(파일 저장 불가).
     - Vercel Marketplace의 Upstash 연동을 쓰면 `KV_REST_API_URL/KV_REST_API_TOKEN`로도 자동 인식됨.
   - `COUPANG_VENDOR_ID`, `COUPANG_OUTBOUND_SHIPPING_PLACE_CODE`, `COUPANG_RETURN_CENTER_CODE`,
     `COUPANG_VENDOR_USER_ID`, `DETAIL_INTRO_IMAGE_URL`, `DETAIL_OUTRO_IMAGE_URL`.
   - `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY` — 넣어도 되지만 **Vercel에선 쿠팡 호출이 403(IP)**.
     실제 호출은 등록 IP 환경에서. (키는 어디서도 화면/로그/리포트에 노출 안 됨.)
4. Deploy. 리전은 `vercel.json`에서 `icn1`(서울)로 지정해둠.

## 3) 저장소(Upstash Redis) 준비

- Upstash 콘솔에서 Redis DB 1개 생성 → REST URL/TOKEN 복사 → Vercel 환경변수에 입력.
- 환경변수가 없으면 자동으로 로컬 `data/db.json`을 쓴다(로컬 개발용).
- 키 1개(`beseller:db`)에 전체 상태 저장. 단일 사용자 기준 last-write-wins(동시 다중탭 편집은 주의).

## 4) 로컬에서 쿠팡 호출 단계만 실행하는 흐름(권장 운영)

1. Vercel(or 로컬)에서 CSV 업로드 → 검수/수정 → Dry Run 통과까지 끝낸다.
2. 같은 Upstash를 바라보는 **등록 IP PC**에서 `npm run dev` 실행
   (`.env.local`에 동일 `UPSTASH_*` + 쿠팡 키).
3. 그 PC의 화면에서 GET 테스트 → 실제 POST(임시저장 1회) 실행.
   → 상태는 Redis 공유라 Vercel 쪽에도 반영된다.

## 참고
- POST 403의 본질은 코드가 아니라 **권한/IP**다. 9단계 리포트(`/api/report`)로 쿠팡 문의를 병행.
- `next@14.2.35`(보안 패치판) 사용.
