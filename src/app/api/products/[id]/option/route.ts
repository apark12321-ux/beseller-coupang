import { NextRequest, NextResponse } from "next/server";
import { mutate } from "@/lib/db";
import { OptionInfo } from "@/lib/types";

export const runtime = "nodejs";

// 사용자가 옵션 정보를 직접 수정. 저장 시 즉시 payload 반영.
// 수정된 필드는 userEditedFields 에 기록되어 자동 재생성으로 덮어쓰이지 않는다.
const EDITABLE: (keyof OptionInfo)[] = [
  "itemName", "quantity", "quantityUnit",
  "weightValue", "weightUnit", "volumeValue", "volumeUnit",
  "packageUnit", "salePrice", "originalPrice",
];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const patch = (await req.json()) as Partial<OptionInfo>;

  const product = await mutate((db) => {
    const p = db.products.find((x) => x.id === params.id);
    if (!p) return null;

    for (const key of EDITABLE) {
      if (key in patch && patch[key] !== undefined) {
        (p.option as any)[key] = patch[key];
        const f = `option.${key}`;
        if (!p.userEditedFields.includes(f)) p.userEditedFields.push(f);
      }
    }
    // 중량 우선 정책 강제: 중량 있으면 용량 비움
    if (p.option.weightValue && p.option.weightUnit) {
      p.option.volumeValue = null; p.option.volumeUnit = null;
    }
    // 총 구성/포장단위 재생성(사용자가 packageUnit 직접 수정 안 한 경우만)
    const comp = p.option.weightValue && p.option.weightUnit
      ? `${p.option.weightValue}${p.option.weightUnit} x ${p.option.quantity}개`
      : p.option.volumeValue && p.option.volumeUnit
      ? `${p.option.volumeValue}${p.option.volumeUnit} x ${p.option.quantity}개`
      : `${p.option.quantity}개`;
    p.option.composition = comp;
    if (!p.userEditedFields.includes("option.packageUnit")) p.option.packageUnit = comp;

    // notices 포장단위 동기화
    const nf = p.notice.fields.find((f) => f.name.includes("포장단위별"));
    if (nf) nf.content = p.option.packageUnit;

    p.option.source = "user";
    p.updatedAt = new Date().toISOString();
    return p;
  });

  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ product });
}
