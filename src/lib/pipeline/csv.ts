import Papa from "papaparse";
import iconv from "iconv-lite";

// 비셀러(메이크샵 일괄등록 양식) CSV 파서.
// - 인코딩: UTF-8 우선, 깨지면 EUC-KR(CP949)
// - 헤더 2줄 구조: 1행=한글설명, 2행=머신필드명(category_code/product_name/sell_price...)
//   → "category_code" 가 있는 행을 헤더로 잡고 그 다음부터 데이터로 처리.

export interface RawRow {
  categoryCode: string;
  categoryLabel: string;
  name: string;
  supplyPrice: number; // sell_price (= 비셀러 공급가; 의미는 운영자 확인값)
  sku: string;
  vatType: "TAX" | "FREE" | null; // vat_type: 과세/면세
  origin: string; // 원산지
  detailImages: string[]; // 보정 전 원본(파일명/URL)
  raw: Record<string, string>;
}

const COLUMN_ALIASES: Record<string, string[]> = {
  categoryCode: ["category_code", "메이크샵 카테고리", "카테고리코드", "분류코드"],
  name: ["product_name", "상품명", "상품명(필수입력)", "품명"],
  supplyPrice: ["sell_price", "판매가격", "공급가", "공급가격", "원가", "도매가"],
  sku: ["membership_code", "상품코드", "product_code", "상품번호", "sku"],
  vatType: ["vat_type", "부가세 설정", "부가세"],
  origin: ["origin", "원산지"],
};
const IMAGE_PRIMARY = ["mini_image", "상세이미지"];
const IMAGE_SECONDARY = ["max_image", "확대이미지"];
const LABEL_COLS = ["cate3_name", "소분류명", "cate2_name", "중분류명", "cate1_name", "대분류명"];

function looksMojibake(s: string): boolean {
  return (s.match(/\uFFFD/g) || []).length > 2;
}
export function decodeBuffer(buf: Buffer): string {
  const utf8 = buf.toString("utf-8");
  if (!looksMojibake(utf8)) return utf8;
  return iconv.decode(buf, "euc-kr");
}

function norm(s: string): string {
  return (s || "").split(/[\n\r]/)[0].replace(/\s+/g, "").toLowerCase();
}
function buildIndex(header: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  header.forEach((h, i) => { const n = norm(h); if (!(n in idx)) idx[n] = i; });
  return idx;
}
function findCol(idx: Record<string, number>, aliases: string[]): number {
  for (const a of aliases) { const n = norm(a); if (n in idx) return idx[n]; }
  return -1;
}
function num(s: string): number {
  const n = Number(String(s ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function vat(s: string): "TAX" | "FREE" | null {
  if (!s) return null;
  if (s.includes("면세")) return "FREE";
  if (s.includes("과세")) return "TAX";
  return null;
}

export function parseCsv(buf: Buffer): RawRow[] {
  const text = decodeBuffer(buf);
  const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true });
  const allRows = (parsed.data as string[][]).filter((r) => Array.isArray(r) && r.length > 1);
  if (allRows.length === 0) return [];

  let headerIdx = allRows.findIndex((r) => r.some((c) => norm(c) === "category_code"));
  if (headerIdx < 0) headerIdx = 0;

  const header = allRows[headerIdx];
  const idx = buildIndex(header);
  const dataRows = allRows.slice(headerIdx + 1);

  const cCat = findCol(idx, COLUMN_ALIASES.categoryCode);
  const cName = findCol(idx, COLUMN_ALIASES.name);
  const cPrice = findCol(idx, COLUMN_ALIASES.supplyPrice);
  const cSku = findCol(idx, COLUMN_ALIASES.sku);
  const cVat = findCol(idx, COLUMN_ALIASES.vatType);
  const cOrigin = findCol(idx, COLUMN_ALIASES.origin);
  const cImg1 = findCol(idx, IMAGE_PRIMARY);
  const cImg2 = findCol(idx, IMAGE_SECONDARY);
  const cLabel = LABEL_COLS.map((l) => findCol(idx, [l])).find((i) => i >= 0) ?? -1;

  const at = (r: string[], i: number) => (i >= 0 && i < r.length ? String(r[i] ?? "").trim() : "");

  return dataRows
    .map((r) => {
      const imgs: string[] = [];
      [at(r, cImg1), at(r, cImg2)].forEach((s) => {
        if (s && s.toUpperCase() !== "AUTO") {
          s.split(/[|,;\n]/).map((x) => x.trim()).filter(Boolean).forEach((u) => {
            if (!imgs.includes(u)) imgs.push(u);
          });
        }
      });
      return {
        categoryCode: at(r, cCat),
        categoryLabel: at(r, cLabel),
        name: at(r, cName),
        supplyPrice: num(at(r, cPrice)),
        sku: at(r, cSku),
        vatType: vat(at(r, cVat)),
        origin: at(r, cOrigin),
        detailImages: imgs,
        raw: {},
      } as RawRow;
    })
    .filter((row) => row.name);
}
