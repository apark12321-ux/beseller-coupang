# 비셀러 → 쿠팡 등록 대시보드 (로컬)

비셀러 식품 도매 CSV를 업로드하면 쿠팡 등록 후보를 자동 생성하고, 검수/수정 후
Dry Run → GET 진단 → (마지막 단계) 임시저장 1회 POST 까지 안전하게 진행하는 로컬 도구.

## 실행
```bash
npm install
cp .env.local.example .env.local   # 쿠팡 키 입력 (절대 커밋/공유 금지)
npm run dev                         # http://127.0.0.1:3000
```

## 안전 원칙 (기존 문제 재발 방지)
- 실제 POST 버튼은 기본 비활성. GET 성공 + Dry Run 통과 + pre-check 무차단 + 쿨다운 없음 + confirm 일 때만 활성.
- 실제 POST는 `requested=false`(임시저장)만 호출.
- 403 발생 시 실제 POST 24시간 쿨다운(GET/Dry Run/리포트는 가능).
- 로컬 pre-check 차단(LOCAL_PRECHECK_BLOCKED)과 게이트웨이 403(COUPANG_GATEWAY_ACCESS_DENIED)을 UI에서 분리.
- Secret/Authorization/signature는 화면·로그·리포트에 출력 안 함. Access Key는 앞 4자리만.
- 사용자가 수정한 옵션 정보(userEditedFields)는 자동 재생성 시 덮어쓰지 않음.
- 저장 후 상세 데이터 재조회로 stale 방지.

## 구조
- `src/lib/pipeline/*` — CSV파싱·분류·카테고리·상품명·옵션·가격·이미지·고시·빌드
- `src/lib/coupang/*` — HMAC·클라이언트·payload·precheck
- `src/app/api/*` — REST 라우트
- `src/components/*` — 대시보드/상세 UI
- 임의 기본값은 **DECISIONS.md** 참고.

## MVP 단계 대응
1~5단계(업로드·분류·상품명·카테고리·옵션·가격) + 6단계(이미지) + 7단계(고시 검수)
+ 8단계(payload preview·Dry Run·pre-check) + 9단계(GET 테스트·리포트) + 10단계(임시저장 1회 POST) 구현.
가격 자동조정/썸네일 관리/주문·발주 변환 탭은 placeholder.
