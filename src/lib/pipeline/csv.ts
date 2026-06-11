import Papa from "papaparse";
import iconv from "iconv-lite";

// 비셀러 CSV 파서.
// - 인코딩: UTF-8 우선, 깨지면 EUC-KR(CP949)로 재디코딩
// - 컬럼: 헤더명을 느슨하게 매칭. 실제 헤더 확정 시 COLUMN_ALIASES 만 고치면 된다.

export interface RawRow {
  categoryCode: string;
  categoryLabel: string;
  name: string;
  supplyPrice: number;
  sku: string;
  detailImages: string[]; // 원본 문자열(보정 전)
  raw: Record<string, string>;
}

const COLUMN_ALIASES: Record<keyof Omit<RawRow, "raw" | "detailImages">, string[]> = {
  categoryCode: ["category_code", "카테고리코드", "카테고리_코드", "A", "분류코드"],
  categoryLabel: ["category_name", "카테고리", "분류", "카테고리명"],
  name: ["product_name", "상품명", "name", "품명", "제품명"],
  supplyPrice: ["supply_price", "공급가", "공급가격", "원가", "도매가", "price"],
  sku: ["sku", "상품코드", "product_code", "외부코드", "vendor_sku", "고유번호"],
};

const IMAGE_COLUMNS = ["detail_images", "상세이미지", "이미지", "image", "images", "상세"];

function looksMojibake(s: string): boolean {
  // EUC-KR 한글이 UTF-8로 잘못 읽히면 \uFFFD(치환문자) 가 다수 발생
  const bad = (s.match(/\uFFFD/g) || []).length;
  return bad > 2;
}

export function decodeBuffer(buf: Buffer): string {
  const utf8 = buf.toString("utf-8");
  if (!looksMojibake(utf8)) return utf8;
  return iconv.decode(buf, "euc-kr");
}

function pick(row: Record<string, string>, aliases: string[]): string {
  const keys = Object.keys(row);
  for (const a of aliases) {
    const hit = keys.find((k) => k.trim().toLowerCase() === a.toLowerCase());
    if (hit && row[hit] != null && String(row[hit]).trim() !== "") return String(row[hit]).trim();
  }
  return "";
}

function toNumber(s: string): number {
  const n = Number(String(s).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function parseCsv(buf: Buffer): RawRow[] {
  const text = decodeBuffer(buf);
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  const rows = result.data.filter((r) => r && Object.keys(r).length > 0);

  return rows.map((row) => {
    const imgRaw = pick(row, IMAGE_COLUMNS);
    const detailImages = imgRaw
      ? imgRaw
          .split(/[|,;\n]/)
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
    return {
      categoryCode: pick(row, COLUMN_ALIASES.categoryCode),
      categoryLabel: pick(row, COLUMN_ALIASES.categoryLabel),
      name: pick(row, COLUMN_ALIASES.name),
      supplyPrice: toNumber(pick(row, COLUMN_ALIASES.supplyPrice)),
      sku: pick(row, COLUMN_ALIASES.sku),
      detailImages,
      raw: row,
    };
  });
}
