"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/ui";

type OpenApiInfo = {
  generatedAt: string;
  registration: {
    vendorInputType: string;
    companyName: string;
    url: string;
    ipAddress: string | null;
  };
  network: {
    serviceUrl: string;
    serverEgressIp: string | null;
    requestIp: string | null;
    isVercel: boolean;
    vercelRegion: string | null;
    fixedIpRequired: boolean;
    warnings: string[];
  };
  credentialStatus: {
    accessKeySet: boolean;
    secretKeySet: boolean;
    vendorIdSet: boolean;
  };
};

const ENV_ROWS = [
  ["COUPANG_ACCESS_KEY", "쿠팡에서 발급받은 Access Key"],
  ["COUPANG_SECRET_KEY", "쿠팡에서 발급받은 Secret Key"],
  ["COUPANG_VENDOR_ID", "판매자 ID · 예: A00798505"],
] as const;

export default function OpenApiPanel({ onChanged }: { onChanged: () => void }) {
  const [info, setInfo] = useState<OpenApiInfo | null>(null);
  const [test, setTest] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setMsg("연동 정보 확인 중…");
    try {
      const d = await api<OpenApiInfo>("/api/coupang/openapi-info");
      setInfo(d);
      setMsg("연동 정보 갱신 완료");
    } catch (e: any) {
      setMsg("오류: " + String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const serviceUrl = useMemo(() => {
    if (info?.registration.url) return info.registration.url;
    if (typeof window !== "undefined") return window.location.origin;
    return "";
  }, [info]);

  const ipForWing = info?.registration.ipAddress ?? "";
  const isVercel = !!info?.network.isVercel;
  const cred = info?.credentialStatus;
  const credentialReady = !!(cred?.accessKeySet && cred?.secretKeySet && cred?.vendorIdSet);

  async function copy(text: string, label: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setMsg(`${label} 복사됨`);
    } catch {
      setMsg(`${label}: ${text}`);
    }
  }

  async function runGetTest() {
    setBusy(true);
    setMsg("쿠팡 GET 테스트 실행 중…");
    try {
      const r = await api("/api/coupang/get-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setTest(r);
      setMsg(r.ok ? "GET 테스트 성공" : `GET 테스트 실패: ${r.error || r.sellerProducts?.summary || "원인 확인 필요"}`);
      onChanged();
    } catch (e: any) {
      setMsg("오류: " + String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>쿠팡 OPEN API 키 발급 · 연동 설정</h2>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "6px 0 0" }}>
            WING의 ‘자체개발(직접입력)’ 화면에 넣을 URL/IP를 확인하고, 키 입력 후 GET 테스트까지 수행합니다.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn" onClick={load} disabled={busy}>정보 새로고침</button>
          <button className={`btn ${credentialReady ? "btn-primary" : ""}`} onClick={runGetTest} disabled={busy || !credentialReady}>
            GET 테스트 실행
          </button>
        </div>
      </div>

      {msg && <div className={`banner ${msg.includes("오류") || msg.includes("실패") ? "warn" : "info"}`} style={{ marginBottom: 14 }}>{msg}</div>}

      {isVercel && (
        <div className="banner warn">
          현재 화면은 Vercel 배포 환경입니다. Vercel은 쿠팡 호출용 고정 IP로 보기 어렵기 때문에 실제 GET/POST 등록은 고정 IP가 있는 PC/VPS/릴레이에서 실행하세요.
          이 Vercel URL은 대시보드 URL로 등록하고, IP 주소는 실제 쿠팡 API를 호출할 고정 IP를 등록하는 방식이 안전합니다.
        </div>
      )}

      <div className="setup-grid">
        <div className="setup-card">
          <div className="setup-kicker">WING 입력값</div>
          <h3>OPEN API 키 발급 화면에 그대로 입력</h3>
          <CopyField label="업체 입력 방식" value="자체개발(직접입력)" onCopy={() => copy("자체개발(직접입력)", "업체 입력 방식")} />
          <CopyField label="업체명" value="자체 개발" onCopy={() => copy("자체 개발", "업체명")} />
          <CopyField label="URL" value={serviceUrl || "확인 중…"} onCopy={() => copy(serviceUrl, "URL")} />
          <CopyField
            label="IP 주소"
            value={ipForWing || "고정 IP 환경에서 실행 후 확인"}
            helper={isVercel ? "Vercel IP는 고정 등록용으로 권장하지 않음" : "이 앱을 실행 중인 서버의 외부 호출 IP"}
            onCopy={() => copy(ipForWing, "IP 주소")}
            disabled={!ipForWing}
          />
          <p className="setup-note">
            쿠팡은 IP를 여러 개 등록할 수 있습니다. 실제 호출이 로컬 PC와 VPS 양쪽에서 일어나면 두 IP를 모두 등록하세요.
          </p>
        </div>

        <div className="setup-card">
          <div className="setup-kicker">현재 환경</div>
          <h3>연동 상태 점검</h3>
          <StatusRow label="Access Key" ok={!!cred?.accessKeySet} />
          <StatusRow label="Secret Key" ok={!!cred?.secretKeySet} />
          <StatusRow label="Vendor ID" ok={!!cred?.vendorIdSet} />
          <StatusRow label="GET 테스트" ok={!!test?.ok} muted={!test} />
          <div className="env-box">
            {ENV_ROWS.map(([k, desc]) => (
              <div key={k}>
                <code>{k}</code>
                <span>{desc}</span>
              </div>
            ))}
          </div>
          <p className="setup-note">
            키 값은 화면에 표시하지 않습니다. 로컬은 <code>.env.local</code>, Vercel은 Project Settings → Environment Variables에만 입력하세요.
          </p>
        </div>
      </div>

      <div className="setup-flow">
        <Step no="1" title="쿠팡 WING에서 OPEN API 키 발급" desc="업체 입력 방식은 ‘자체개발(직접입력)’을 선택합니다. 업체명은 ‘자체 개발’로 입력해도 됩니다." />
        <Step no="2" title="URL과 IP 등록" desc="URL에는 이 대시보드 주소를 넣고, IP에는 실제 쿠팡 API를 호출할 고정 IP를 넣습니다." />
        <Step no="3" title="환경변수에 Access/Secret 입력" desc="GitHub 코드에 키를 넣지 말고 .env.local 또는 Vercel 환경변수로만 관리합니다." />
        <Step no="4" title="GET 테스트 성공 확인" desc="GET 테스트가 성공해야 Dry Run 이후 실제 임시저장 POST 버튼이 열립니다." />
      </div>

      {test && (
        <div className="setup-result">
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>GET 테스트 결과</div>
          <pre>{JSON.stringify(test, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function CopyField({
  label, value, helper, onCopy, disabled,
}: { label: string; value: string; helper?: string; onCopy: () => void; disabled?: boolean }) {
  return (
    <div className="copy-field">
      <label>{label}</label>
      <div>
        <code>{value}</code>
        <button className="btn" onClick={onCopy} disabled={disabled}>복사</button>
      </div>
      {helper && <small>{helper}</small>}
    </div>
  );
}

function StatusRow({ label, ok, muted }: { label: string; ok: boolean; muted?: boolean }) {
  return (
    <div className="status-row">
      <span>{label}</span>
      <b className={ok ? "ok" : muted ? "muted" : "bad"}>{ok ? "OK" : muted ? "미실행" : "필요"}</b>
    </div>
  );
}

function Step({ no, title, desc }: { no: string; title: string; desc: string }) {
  return (
    <div className="setup-step">
      <div>{no}</div>
      <b>{title}</b>
      <p>{desc}</p>
    </div>
  );
}
