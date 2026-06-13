import Papa from "papaparse";
import iconv from "iconv-lite";

// 비셀러(메이크샵 일괄등록 양식) CSV 파서.
// 서버: parseCsv(buf). 클라이언트 배치 업로드: detectHeaderIndex + mapDataRows 공용 사용.

export interface RawRow {
  categoryCode: string;
  categoryLabel: string;
  name: string;
  supplyPrice: number;
  sku: string;
  vatType: "TAX" | "FREE" | null;
  origin: string;
  detailImages: string[];
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
export function norm(s: string): string {
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

// 머신필드행(category_code 포함) 인덱스. 없으면 0.
export function detectHeaderIndex(rows: string[][]): number {
  const i = rows.findIndex((r) => r.some((c) => norm(c) === "category_code"));
  return i < 0 ? 0 : i;
}

// header + 데이터행 → RawRow[] (서버/클라 공용)
export function mapDataRows(header: string[], dataRows: string[][]): RawRow[] {
  const idx = buildIndex(header);
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
          s.split(/[|,;\n]/).map((x) => x.trim()).filter(Boolean).forEach((u) => { if (!imgs.includes(u)) imgs.push(u); });
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

export function parseCsv(buf: Buffer): RawRow[] {
  const text = decodeBuffer(buf);
  const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true });
  const allRows = (parsed.data as string[][]).filter((r) => Array.isArray(r) && r.length > 1);
  if (allRows.length === 0) return [];
  const hi = detectHeaderIndex(allRows);
  return mapDataRows(allRows[hi], allRows.slice(hi + 1));
}
