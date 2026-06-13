import { NextRequest, NextResponse } from "next/server";
import { mutateProduct } from "@/lib/db";
import { OptionInfo } from "@/lib/types";
export const runtime = "nodejs";

const EDITABLE: (keyof OptionInfo)[] = [
  "itemName", "quantity", "quantityUnit", "weightValue", "weightUnit",
  "volumeValue", "volumeUnit", "packageUnit", "salePrice", "originalPrice",
];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const patch = (await req.json()) as Partial<OptionInfo>;
  const { product } = await mutateProduct(params.id, (p) => {
    for (const key of EDITABLE) {
      if (key in patch && patch[key] !== undefined) {
        (p.option as any)[key] = patch[key];
        const f = `option.${key}`;
        if (!p.userEditedFields.includes(f)) p.userEditedFields.push(f);
      }
    }
    if (p.option.weightValue && p.option.weightUnit) { p.option.volumeValue = null; p.option.volumeUnit = null; }
    const comp = p.option.weightValue && p.option.weightUnit
      ? `${p.option.weightValue}${p.option.weightUnit} x ${p.option.quantity}개`
      : p.option.volumeValue && p.option.volumeUnit
      ? `${p.option.volumeValue}${p.option.volumeUnit} x ${p.option.quantity}개`
      : `${p.option.quantity}개`;
    p.option.composition = comp;
    if (!p.userEditedFields.includes("option.packageUnit")) p.option.packageUnit = comp;
    const nf = p.notice.fields.find((f) => f.name.includes("포장단위별"));
    if (nf) nf.content = p.option.packageUnit;
    p.option.source = "user";
  });
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ product });
}
