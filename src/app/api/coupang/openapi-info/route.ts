import { NextRequest, NextResponse } from "next/server";
import { credentialStatus } from "@/lib/coupang/hmac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IpCheckResult = { ip: string | null; source: string | null };

function firstForwardedIp(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",").map((x) => x.trim()).find(Boolean) ?? null;
  return first ? first.replace(/^::ffff:/, "") : null;
}

function normalizeOrigin(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  if (envUrl) return envUrl.replace(/\/$/, "");

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || process.env.VERCEL_URL || "";
  if (!host) return "http://127.0.0.1:3000";

  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`.replace(/\/$/, "");
}

function looksLikeIp(value: string): boolean {
  const v = value.trim();
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(v) || /^[0-9a-f:]+$/i.test(v);
}

async function readIpEndpoint(url: string, source: string): Promise<IpCheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!res.ok) return { ip: null, source: null };
    const text = (await res.text()).trim();
    let candidate = text;
    if (text.startsWith("{")) {
      try { candidate = String(JSON.parse(text).ip ?? "").trim(); } catch { candidate = ""; }
    }
    return candidate && looksLikeIp(candidate) ? { ip: candidate, source } : { ip: null, source: null };
  } catch {
    return { ip: null, source: null };
  } finally {
    clearTimeout(timer);
  }
}

async function detectServerEgressIp(): Promise<IpCheckResult> {
  const endpoints: Array<[string, string]> = [
    ["https://api.ipify.org?format=json", "api.ipify.org"],
    ["https://checkip.amazonaws.com", "checkip.amazonaws.com"],
    ["https://ifconfig.me/ip", "ifconfig.me"],
  ];
  for (const [url, source] of endpoints) {
    const result = await readIpEndpoint(url, source);
    if (result.ip) return result;
  }
  return { ip: null, source: null };
}

export async function GET(req: NextRequest) {
  const serviceUrl = normalizeOrigin(req);
  const requestIp =
    firstForwardedIp(req.headers.get("x-real-ip")) ||
    firstForwardedIp(req.headers.get("x-forwarded-for"));
  const serverIp = await detectServerEgressIp();
  const isVercel = !!process.env.VERCEL;

  const warnings: string[] = [];
  if (isVercel) warnings.push("Vercel 서버리스 함수의 외부 호출 IP는 고정 IP 등록 대상으로 권장하지 않습니다.");
  if (!serverIp.ip) warnings.push("서버 외부 IP를 자동 확인하지 못했습니다. 고정 IP 제공자/공유기/VPS 콘솔에서 확인하세요.");

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    registration: {
      vendorInputType: "자체개발(직접입력)",
      companyName: "자체 개발",
      url: serviceUrl,
      ipAddress: serverIp.ip,
    },
    network: {
      serviceUrl,
      serverEgressIp: serverIp.ip,
      serverEgressIpSource: serverIp.source,
      requestIp,
      isVercel,
      vercelRegion: process.env.VERCEL_REGION ?? null,
      fixedIpRequired: true,
      warnings,
    },
    credentialStatus: credentialStatus(),
  });
}
