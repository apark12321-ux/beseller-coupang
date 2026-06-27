import { NextRequest, NextResponse } from "next/server";
import { credentialStatus } from "@/lib/coupang/hmac";
import { getMeta } from "@/lib/db";
import { env } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CANONICAL_APP_URL = "https://beseller-coupang.vercel.app";

type IpCheckResult = { ip: string | null; source: string | null };

function firstForwardedIp(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",").map((x) => x.trim()).find(Boolean) ?? null;
  return first ? first.replace(/^::ffff:/, "") : null;
}

function asHttpsUrl(value: string | undefined | null): string {
  if (!value) return "";
  const v = value.trim().replace(/\/$/, "");
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function normalizeOrigin(req: NextRequest): string {
  const explicitUrl =
    asHttpsUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    asHttpsUrl(process.env.APP_URL) ||
    asHttpsUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (explicitUrl) return explicitUrl;

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || process.env.VERCEL_URL || "";
  const normalizedHost = host.replace(/\/$/, "");
  if (normalizedHost.endsWith(".vercel.app") && normalizedHost !== "beseller-coupang.vercel.app") return CANONICAL_APP_URL;
  if (!normalizedHost) return "http://127.0.0.1:3000";

  const proto = req.headers.get("x-forwarded-proto") ||
    (normalizedHost.includes("localhost") || normalizedHost.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${normalizedHost}`.replace(/\/$/, "");
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

async function readRelayHealth() {
  if (!env.relayUrl || !env.relaySecret) return null;
  try {
    const res = await fetch(`${env.relayUrl}/health`, { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function GET(req: NextRequest) {
  const serviceUrl = normalizeOrigin(req);
  const requestIp = firstForwardedIp(req.headers.get("x-real-ip")) || firstForwardedIp(req.headers.get("x-forwarded-for"));
  const serverIp = await detectServerEgressIp();
  const relay = await readRelayHealth();
  const isVercel = !!process.env.VERCEL;
  const meta = await getMeta().catch(() => null);
  const relayIp = typeof relay?.egressIp === "string" ? relay.egressIp : null;
  const ipForWing = relayIp || serverIp.ip;

  const warnings: string[] = [];
  if (env.relayUrl && relayIp) warnings.push("릴레이 모드입니다. 쿠팡 WING에는 릴레이 서버의 고정 IP만 등록하세요.");
  else if (isVercel) warnings.push("Vercel 직접 호출 모드입니다. 운영 안정성을 위해 COUPANG_RELAY_URL을 연결하세요.");
  if (!ipForWing) warnings.push("외부 호출 IP를 자동 확인하지 못했습니다. 서버 콘솔에서 공인 IP를 확인하세요.");

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    registration: {
      vendorInputType: "자체개발(직접입력)",
      companyName: "자체 개발",
      url: serviceUrl,
      ipAddress: ipForWing,
    },
    network: {
      serviceUrl,
      serverEgressIp: serverIp.ip,
      serverEgressIpSource: serverIp.source,
      relayMode: !!env.relayUrl,
      relayUrlSet: !!env.relayUrl,
      relayOk: !!relay?.ok,
      relayEgressIp: relayIp,
      requestIp,
      isVercel,
      vercelRegion: process.env.VERCEL_REGION ?? null,
      fixedIpRequired: true,
      warnings,
    },
    credentialStatus: credentialStatus(),
    system: {
      lastGetTestOk: !!meta?.system?.lastGetTestOk,
      lastGetTestAt: meta?.system?.lastGetTestAt ?? null,
    },
  });
}
