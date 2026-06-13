# DECISIONS — 내가 임의로 채운 기본값 (덮어쓰기 가능)

스펙에 비어 있던 항목을 합리적 기본값으로 채웠다. 실제 비셀러 CSV/쿠팡 정책 확정 시 아래만 고치면 된다.

## 1. 비셀러 CSV 컬럼 (`src/lib/pipeline/csv.ts`)
- 인코딩: UTF-8 우선, mojibake 감지 시 EUC-KR(CP949) 자동 재디코딩.
- 컬럼은 헤더명 별칭(alias)으로 느슨하게 매칭. 실제 헤더 확정되면 `COLUMN_ALIASES` 만 수정.
- 현재 별칭: category_code/카테고리코드/A, 상품명, 공급가/원가/도매가, sku/상품코드, 상세이미지/이미지.
- **샘플 CSV 1개 주면 별칭을 실제 헤더에 맞춰 확정함.**

## 2. salePrice 계산식 (`src/lib/pipeline/price.ts`, `config.ts`)
- `salePrice = ceil( 공급가 / (1 - feeRate - margin) / 10 ) * 10`
- 기본 feeRate = 0.108(10.8%), margin = 0.20. 카테고리별 override는 `PRICE_POLICY.feeByCategoryPrefix`.
- `originalPrice = roundUpTo100(salePrice * 1.2)`, salePrice 이하면 자동 보정.
- **카테고리별 실제 수수료율 표를 주면 교체함.**

## 3. 대표 이미지 (`src/lib/pipeline/images.ts`)
- 비셀러 상세 이미지 중 **첫 번째 유효 URL을 대표(REPRESENTATION)** 로 사용.
- 없으면 pre-check에서 차단(대표 이미지 필수).
- URL 보정: 절대 URL 그대로, 파일명/상대경로는 `beseller.net/shopimages/beseller/` 로, makeshop 호스트 허용.
- (미구현) 이미지 HEAD 200/규격 검증 — 9~10단계에서 추가 권장.

## 4. payload 기본값 / taxType (`src/lib/config.ts`, `coupang/payload.ts`)
- taxType: 과일류(C002005*)·쌀/잡곡(C002003003) = 면세(FREE), 나머지 = 과세(TAX).
- saleStartedAt = now, saleEndedAt = +5년. maximumBuyCount 9999, adultOnly EVERYONE,
  parallelImported/overseasPurchased NOT_*, pccNeeded false, emptyBarcode true.
- **이 기본값은 임시저장 통과용. 실판매 전 검토 필요.**

## 5. 고시정보 템플릿 (`src/lib/pipeline/notice.ts`)
- 가공식품(food_processed) / 농수산물(agri_marine) 2종.
- 농수산물 판별: 과일·쌀/잡곡·김/해조·건어물 prefix.
- 기본값 "상세페이지 참조", 소비자상담 070-8064-4749 고정.

---

## 미구현 / 의도적 스텁 (MVP 범위 밖)
- 탭: 가격 자동조정 / 썸네일 관리 / 카테고리 검증 / 주문·발주 변환 → placeholder(비활성).
- 카테고리 추천을 쿠팡 추천 API로 받는 연동(현재는 룰 기반 추천 + 오매칭 가드만).
- attributes를 카테고리 메타의 MANDATORY 속성에 맞춰 동적 매핑(현재는 수량/중량/용량 고정).
- 이미지 URL 도달성(HEAD) 검사.
- 중복 SKU dedupe(GET sellerProduct 대조).

## POST 403의 본질
이건 코드로 못 푼다. WING 자체개발 연동의 **상품 생성 API 권한** 문제일 확률이 높음.
→ 9단계 리포트 기능을 먼저 써서 쿠팡에 문의 넣는 걸 개발과 병행 권장.

---

## 실데이터(메이크샵 일괄등록 CSV) 반영 (2026-06-12)
- 헤더 2줄 구조 자동 인식: 머신필드행(`category_code` 포함)을 헤더로, 그 다음부터 데이터.
- 컬럼 매핑: category_code, product_name, sell_price, membership_code(상품코드),
  mini_image/max_image(이미지), vat_type(부가세), origin(원산지).
- 분류맵을 실제 코드로 교체: C002001=가공식품, C002002=건기식(제외), C002003=농산물,
  C002004=수산(활수산 C002004003 제외), C002005=과일, C002006=축산(제외), C002007=김치/젓갈.
- 부가세: CSV vat_type(면세/과세) 우선 적용.
- 저장구조: 상품별 키(beseller:p:{id}) + 인덱스 + 메타. 수천 건 대응(단일 blob 폐기).

## ★ 운영자 확인 필요(2건, 가격·이미지 정확도 직결)
1. **sell_price 의미**: 이게 '원가(공급가)'인가, '판매가(그대로 노출)'인가?
   - 현재 코드: 원가로 보고 수수료+마진 역산 → 판매가 산출.
   - 만약 이미 판매가면 가격이 과대 계상됨. (예: 이가네 떡볶이 1.5kg 13650 → 현재 ~19730)
2. **이미지 base URL**: CSV엔 파일명만 있음(예: 002001000146.png).
   실제 노출 URL 베이스 1개 필요(라이브 상품 이미지 주소). 없으면 대표이미지 누락→등록 차단.
