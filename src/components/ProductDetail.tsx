"use client";

import { useEffect, useState, useCallback } from "react";
import { won, api, CAT_COLOR } from "@/lib/ui";

export default function ProductDetail({
  id, system, onChanged,
}: { id: string; system: any; onChanged: () => void }) {
  const [p, setP] = useState<any>(null);
  const [check, setCheck] = useState<any>(null);
  const [payload, setPayload] = useState<any>(null);
  const [dry, setDry] = useState<any>(null);
  const [postResult, setPostResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await api(`/api/products/${id}`);
    setP(d.product); setCheck(d.precheck);
  }, [id]);

  // 저장 후 stale 방지: 항상 상세 재조회
  useEffect(() => { setDry(null); setPostResult(null); setPayload(null); load(); }, [id, load]);

  if (!p) return <div className="card p-6 text-gray-400">로딩...</div>;

  const o = p.option;
  const edited = (f: string) => p.userEditedFields?.includes(f);

  async function save(url: string, body: any) {
    setBusy(true);
    await api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    await load(); onChanged();
  }

  async function runDry() {
    setBusy(true);
    const r = await api(`/api/products/${id}/dry-run`, { method: "POST" });
    setDry(r); setBusy(false); await load();
  }

  async function loadPayload() {
    const r = await api(`/api/products/${id}/payload`);
    setPayload(r.payload);
  }

  async function realPost() {
    const ok = window.confirm(
      "실제 쿠팡 상품 생성 POST를 1회 호출합니다. 임시저장 또는 오류 상품이 생성될 수 있습니다. 계속하시겠습니까?"
    );
    if (!ok) return;
    setBusy(true);
    const r = await api(`/api/products/${id}/post`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: true }),
    });
    setPostResult(r); setBusy(false); await load(); onChanged();
  }

  const cooldownActive = system?.cooldownUntil && new Date(system.cooldownUntil) > new Date();
  const postEnabled =
    !busy && !cooldownActive && system?.lastGetTestOk && p.dryRunOk && !check?.blocked &&
    p.lastErrorClass !== "COUPANG_CREATED_SUCCESS";

  return (
    <div className="card p-4 space-y-4 max-h-[calc(100vh-120px)] overflow-y-auto text-sm">
      <Section title="기본 정보">
        <div className="text-xs text-gray-500">원본: {p.originalName}</div>
        <div className="text-xs text-gray-500">SKU: {p.externalVendorSku}</div>
        {p.blockReasons?.length > 0 && (
          <ul className="mt-1 text-xs text-red-500 list-disc pl-4">
            {p.blockReasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ul>
        )}
      </Section>

      {/* 상품명 */}
      <Section title={`상품명 후보 ${edited("finalName") ? "(사용자 수정됨)" : ""}`}>
        <NameEditor product={p} onSave={(v: string) => save(`/api/products/${id}/name`, { finalName: v })} busy={busy} />
      </Section>

      {/* 쿠팡 옵션 정보 */}
      <Section title={`쿠팡 옵션 정보 · ${o.source === "user" ? "사용자 수정됨" : o.source === "needs_confirm" ? "확인 필요" : "자동 추출됨"}`}>
        <OptionEditor option={o} onSave={(patch: any) => save(`/api/products/${id}/option`, patch)} busy={busy} />
        <div className="mt-2 text-xs text-gray-500">총 구성: {o.composition} · 포장단위: {o.packageUnit}</div>
      </Section>

      {/* 가격 */}
      <Section title="가격 정보">
        <div className="grid grid-cols-3 gap-2">
          <Field label="공급가(원가)" value={won(p.supplyPrice)} readOnly />
          <NumberField label="판매가" value={o.salePrice}
            onSave={(v: number) => save(`/api/products/${id}/price`, { salePrice: v })} busy={busy} />
          <NumberField label="정상가" value={o.originalPrice}
            onSave={(v: number) => save(`/api/products/${id}/price`, { originalPrice: v })} busy={busy} />
        </div>
        {o.originalPrice <= o.salePrice && (
          <div className="text-xs text-red-500 mt-1">⚠ 정상가가 판매가 이하 (차단 대상)</div>
        )}
      </Section>

      {/* 카테고리 */}
      <Section title="카테고리 정보">
        <div className="flex items-center gap-2 mb-1">
          <span className={`badge ${CAT_COLOR[p.category.status] || ""}`}>{p.category.status}</span>
          {p.category.taxType === "FREE" ? <span className="badge bg-blue-50 text-blue-600">면세</span> : <span className="badge bg-gray-100 text-gray-600">과세</span>}
        </div>
        {p.category.reason && <div className="text-xs text-red-500 mb-1">{p.category.reason}</div>}
        <CategoryEditor category={p.category}
          onSave={(b: any) => save(`/api/products/${id}/category`, b)} busy={busy} />
      </Section>

      {/* 상세 이미지 */}
      <Section title="상세 이미지 정보">
        <div className="text-xs text-gray-500">대표: {p.images.representationUrl || <span className="text-red-500">없음 (차단)</span>}</div>
        <div className="text-xs text-gray-500">상세 {p.images.detailUrls.length}장 · intro/outro 자동 삽입</div>
        <div className="flex gap-1 mt-1 flex-wrap">
          {p.images.detailUrls.slice(0, 6).map((u: string, i: number) => (
            <img key={i} src={u} alt="" className="w-12 h-12 object-cover rounded border" />
          ))}
        </div>
      </Section>

      {/* 고시정보 */}
      <Section title={`고시정보 (${p.notice.noticeCategoryName}) · ${p.notice.status}`}>
        <NoticeEditor notice={p.notice}
          onSave={(b: any) => save(`/api/products/${id}/notice`, b)} busy={busy} />
      </Section>

      {/* payload */}
      <Section title="payload 미리보기">
        <button className="btn bg-white border-gray-300" onClick={loadPayload}>payload 생성/보기</button>
        {payload && (
          <pre className="mt-2 text-[10px] bg-gray-900 text-green-200 p-2 rounded overflow-auto max-h-60">
            {JSON.stringify(payload, null, 2)}
          </pre>
        )}
      </Section>

      {/* 등록 준비 체크리스트 + Dry Run */}
      <Section title="등록 준비 / Dry Run">
        {check && (
          <div className="space-y-1">
            {check.errors.map((e: string, i: number) => <div key={i} className="text-xs text-red-600">✕ {e}</div>)}
            {check.warnings.map((w: string, i: number) => <div key={i} className="text-xs text-amber-600">⚠ {w}</div>)}
            {check.errors.length === 0 && <div className="text-xs text-green-600">✓ 로컬 차단 사유 없음</div>}
          </div>
        )}
        <div className="flex gap-2 mt-2">
          <button className="btn bg-white border-gray-300" onClick={runDry} disabled={busy}>
            [Dry Run] payload 검증 (쿠팡 호출 안 함)
          </button>
        </div>
        {dry && (
          <div className={`mt-2 text-xs rounded p-2 ${dry.dryRunOk ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {dry.dryRunOk ? "Dry Run 통과" : `차단: ${dry.errorClass}`}
            <pre className="mt-1 text-[10px] overflow-auto">{JSON.stringify(dry.requestSummary, null, 2)}</pre>
          </div>
        )}
      </Section>

      {/* 실제 POST */}
      <Section title="실제 POST (마지막 단계)">
        <div className="text-[11px] text-gray-500 mb-2 space-y-0.5">
          <div>{system?.lastGetTestOk ? "✓" : "✕"} GET 테스트 성공</div>
          <div>{p.dryRunOk && !check?.blocked ? "✓" : "✕"} Dry Run 통과 / pre-check 무차단</div>
          <div>{cooldownActive ? "✕ 쿨다운 중 (24h)" : "✓ 쿨다운 없음"}</div>
        </div>
        <button
          className={`btn w-full ${postEnabled ? "bg-red-600 text-white border-red-600" : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"}`}
          onClick={realPost} disabled={!postEnabled}>
          [실제 POST] 신규 임시저장 1회 (requested=false)
        </button>
        {postResult && (
          <div className={`mt-2 text-xs rounded p-2 ${postResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            <div>{postResult.errorClass} · HTTP {postResult.httpStatus}</div>
            <div>{postResult.summary}</div>
            {postResult.akamaiReference && <div>Akamai Ref: {postResult.akamaiReference}</div>}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t pt-3 first:border-t-0 first:pt-0">
      <h3 className="font-semibold text-gray-700 mb-2 text-[13px]">{title}</h3>
      {children}
    </section>
  );
}

function NameEditor({ product, onSave, busy }: any) {
  const [val, setVal] = useState(product.finalName);
  useEffect(() => setVal(product.finalName), [product.finalName]);
  return (
    <div className="space-y-1">
      {product.nameCandidates.map((c: string, i: number) => (
        <button key={i} onClick={() => setVal(c)}
          className={`block w-full text-left text-xs px-2 py-1 rounded border ${val === c ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}>
          {c} <span className="text-gray-400">({c.length}자)</span>
        </button>
      ))}
      <div className="flex gap-1 mt-1">
        <input value={val} onChange={(e) => setVal(e.target.value)} maxLength={49}
          className="flex-1 border rounded px-2 py-1 text-xs" />
        <button className="btn bg-black text-white border-black" disabled={busy} onClick={() => onSave(val)}>저장</button>
      </div>
    </div>
  );
}

function OptionEditor({ option, onSave, busy }: any) {
  const [s, setS] = useState(option);
  useEffect(() => setS(option), [option]);
  const set = (k: string, v: any) => setS({ ...s, [k]: v });
  return (
    <div className="space-y-2">
      <input className="w-full border rounded px-2 py-1 text-xs" value={s.itemName}
        onChange={(e) => set("itemName", e.target.value)} placeholder="itemName" />
      <div className="grid grid-cols-3 gap-1 text-xs">
        <L label="수량"><input type="number" className="inp" value={s.quantity} onChange={(e) => set("quantity", Number(e.target.value))} /></L>
        <L label="단위"><input className="inp" value={s.quantityUnit} onChange={(e) => set("quantityUnit", e.target.value)} /></L>
        <div />
        <L label="개당 중량"><input type="number" className="inp" value={s.weightValue ?? ""} onChange={(e) => set("weightValue", e.target.value === "" ? null : Number(e.target.value))} /></L>
        <L label="중량단위">
          <select className="inp" value={s.weightUnit ?? ""} onChange={(e) => set("weightUnit", e.target.value || null)}>
            <option value="">-</option><option value="kg">kg</option><option value="g">g</option>
          </select>
        </L>
        <div />
        <L label="개당 용량"><input type="number" className="inp" value={s.volumeValue ?? ""} onChange={(e) => set("volumeValue", e.target.value === "" ? null : Number(e.target.value))} /></L>
        <L label="용량단위">
          <select className="inp" value={s.volumeUnit ?? ""} onChange={(e) => set("volumeUnit", e.target.value || null)}>
            <option value="">-</option><option value="ml">ml</option><option value="L">L</option>
          </select>
        </L>
        <div />
      </div>
      <input className="w-full border rounded px-2 py-1 text-xs" value={s.packageUnit}
        onChange={(e) => set("packageUnit", e.target.value)} placeholder="고시정보 포장단위" />
      <button className="btn bg-black text-white border-black" disabled={busy}
        onClick={() => onSave({
          itemName: s.itemName, quantity: s.quantity, quantityUnit: s.quantityUnit,
          weightValue: s.weightValue, weightUnit: s.weightUnit,
          volumeValue: s.volumeValue, volumeUnit: s.volumeUnit, packageUnit: s.packageUnit,
        })}>옵션 저장</button>
      <style jsx>{`.inp{border:1px solid #d1d5db;border-radius:4px;padding:2px 6px;width:100%}`}</style>
    </div>
  );
}

function CategoryEditor({ category, onSave, busy }: any) {
  const [code, setCode] = useState(category.displayCategoryCode ?? "");
  const [path, setPath] = useState(category.coupangPath ?? "");
  useEffect(() => { setCode(category.displayCategoryCode ?? ""); setPath(category.coupangPath ?? ""); }, [category]);
  return (
    <div className="space-y-1 text-xs">
      <input className="w-full border rounded px-2 py-1" value={code} onChange={(e) => setCode(e.target.value)} placeholder="displayCategoryCode" />
      <input className="w-full border rounded px-2 py-1" value={path} onChange={(e) => setPath(e.target.value)} placeholder="쿠팡 카테고리 경로" />
      <div className="flex gap-1">
        <button className="btn bg-white border-gray-300" disabled={busy} onClick={() => onSave({ displayCategoryCode: code, coupangPath: path })}>저장</button>
        <button className="btn bg-emerald-600 text-white border-emerald-600" disabled={busy} onClick={() => onSave({ displayCategoryCode: code, coupangPath: path, markValid: true })}>stored_valid 확정</button>
      </div>
    </div>
  );
}

function NoticeEditor({ notice, onSave, busy }: any) {
  return (
    <div className="space-y-1">
      <details className="text-xs">
        <summary className="cursor-pointer text-gray-500">필수 항목 {notice.fields.length}개 보기</summary>
        <ul className="mt-1 space-y-0.5">
          {notice.fields.map((f: any, i: number) => (
            <li key={i} className="text-gray-600"><b>{f.name}</b>: {f.content}</li>
          ))}
        </ul>
      </details>
      <button className="btn bg-green-600 text-white border-green-600" disabled={busy}
        onClick={() => onSave({ status: "reviewed" })}>고시정보 수동 검수 완료</button>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[10px] text-gray-400">{label}</span>{children}</label>;
}
function Field({ label, value, readOnly }: any) {
  return <label className="block text-xs"><span className="text-[10px] text-gray-400">{label}</span>
    <input readOnly={readOnly} value={value} className="w-full border rounded px-2 py-1 bg-gray-50" /></label>;
}
function NumberField({ label, value, onSave, busy }: any) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="block text-xs"><span className="text-[10px] text-gray-400">{label}</span>
      <div className="flex gap-1">
        <input type="number" value={v} onChange={(e) => setV(Number(e.target.value))} className="w-full border rounded px-2 py-1" />
        <button className="btn bg-gray-800 text-white border-gray-800 px-2" disabled={busy} onClick={() => onSave(v)}>✓</button>
      </div>
    </label>
  );
}
