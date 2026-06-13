import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getMeta } from "@/lib/db";
import { env } from "@/lib/config";
import { maskAccessKey } from "@/lib/mask";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const meta = await getMeta();
  const body = await req.json().catch(() => ({}));
  const ts = new Date();
  const stamp = ts.getFullYear().toString() + String(ts.getMonth() + 1).padStart(2, "0") + String(ts.getDate()).padStart(2, "0")
    + "_" + String(ts.getHours()).padStart(2, "0") + String(ts.getMinutes()).padStart(2, "0") + String(ts.getSeconds()).padStart(2, "0");

  const report = {
    생성일시: ts.toISOString(),
    vendorId: env.vendorId,
    연동방식: "자체개발",
    현재공인IP: body?.currentIp ?? "(자동조회 미연동)",
    WING등록IP: body?.wingIp ?? "(운영자 입력)",
    GET성공API: meta.system.lastGetTestOk ? ["seller-products 조회"] : [],
    POST실패API: ["seller-products 생성"],
    HTTPstatus: body?.httpStatus ?? 403,
    contentType: body?.contentType ?? "text/html",
    AccessDenied참조번호: body?.akamaiReference ?? "(해당 시 입력)",
    logId: body?.logId ?? null,
    cooldownUntil: meta.system.cooldownUntil,
    HMAC검증요약: "GET/POST 동일 HMAC 함수 사용. GET 성공, POST 상품생성만 403. 구조문제 가능성 낮음.",
    AccessKey: maskAccessKey(env.accessKey),
    최종문의문구: "GET API는 성공했으나 POST 상품 생성 API만 403 Access Denied가 발생했습니다. HMAC 기본 구조 문제 가능성은 낮고, 상품 생성 API 권한 또는 자체개발 연동 IP 설정 확인이 필요합니다.",
  };

  const dir = path.join(process.cwd(), "outputs");
  const base = `coupang_api_permission_inquiry_report_${stamp}`;
  let saved: string[] = [];
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, base + ".json"), JSON.stringify(report, null, 2), "utf-8");
    const txt = Object.entries(report).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("\n");
    fs.writeFileSync(path.join(dir, base + ".txt"), txt, "utf-8");
    saved = [`outputs/${base}.txt`, `outputs/${base}.json`];
  } catch {
    // 서버리스(읽기전용)면 파일 저장 생략, 리포트 본문만 반환
    saved = [];
  }
  return NextResponse.json({ saved, report });
}
