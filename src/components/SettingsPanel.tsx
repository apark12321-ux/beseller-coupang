"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/ui";

export default function SettingsPanel({ onRecomputed }: { onRecomputed: () => void }) {
  const [s, setS] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { api("/api/settings").then((d) => setS(d.settings)); }, []);
  if (!s) return <div className="card p-6 text-gray-400">설정 로딩...</div>;
  const set = (k: string, v: any) => setS({ ...s, [k]: v });

  async function save() {
    setBusy(true); setMsg("저장 중...");
    const d = await api("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    setS(d.settings); setBusy(false); setMsg("저장됨. (기존 상품에 적용하려면 '전체 재계산')");
  }

  async function recompute() {
    if (!window.confirm("현재 설정으로 모든 상품의 가격·이미지를 다시 계산합니다. (직접 수정한 가격은 보존) 계속할까요?")) return;
    setBusy(true);
    let offset = 0, total = 0;
    try {
      // 먼저 저장
      await api("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
      while (true) {
        const r = await api("/api/recompute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offset, limit: 300 }) });
        total = r.total; offset = r.nextOffset;
        setMsg(`재계산 중... ${Math.min(offset, total)}/${total}`);
        if (r.done || r.processed === 0) break;
      }
      setMsg(`재계산 완료: ${total}건`);
      onRecomputed();
    } catch (e: any) { setMsg("오류: " + String(e?.message ?? e)); }
    setBusy(false);
  }

  return (
    <div className="card p-5 space-y-4 text-sm">
      <h2 className="font-bold text-base">설정 · 가격/이미지 정책</h2>
      {msg && <div className="text-xs bg-yellow-50 border border-yellow-200 rounded px-3 py-2">{msg}</div>}

      <div>
        <div className="font-semibold mb-1">가격 모드</div>
        <label className="flex items-start gap-2 mb-1">
          <input type="radio" checked={s.priceMode === "supply"} onChange={() => set("priceMode", "supply")} className="mt-1" />
          <span><b>공급가(원가) 모드</b> — sell_price를 원가로 보고 수수료+마진을 얹어 판매가 산출</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" checked={s.priceMode === "sale"} onChange={() => set("priceMode", "sale")} className="mt-1" />
          <span><b>판매가 모드</b> — sell_price를 판매가로 그대로 사용(정상가만 배수 적용)</span>
        </label>
      </div>

      {s.priceMode === "supply" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">쿠팡 수수료율 (%)
            <input type="number" step="0.1" className="w-full border rounded px-2 py-1 mt-0.5"
              value={(s.feeRate * 100).toFixed(1)} onChange={(e) => set("feeRate", Number(e.target.value) / 100)} />
          </label>
          <label className="block">목표 마진 (%)
            <input type="number" step="0.1" className="w-full border rounded px-2 py-1 mt-0.5"
              value={(s.margin * 100).toFixed(1)} onChange={(e) => set("margin", Number(e.target.value) / 100)} />
          </label>
        </div>
      )}

      <label className="block">정상가 배수 (판매가 × N)
        <input type="number" step="0.05" className="w-full border rounded px-2 py-1 mt-0.5"
          value={s.originalMultiplier} onChange={(e) => set("originalMultiplier", Number(e.target.value))} />
      </label>

      <label className="block">이미지 URL 베이스
        <input className="w-full border rounded px-2 py-1 mt-0.5 font-mono text-xs"
          value={s.imageBaseUrl} onChange={(e) => set("imageBaseUrl", e.target.value)}
          placeholder="https://.../ (파일명 앞에 붙음)" />
        <span className="text-[11px] text-gray-400">CSV 이미지가 파일명만 있을 때 이 베이스를 앞에 붙여 완성. 절대 URL은 그대로 둠.</span>
      </label>

      <div className="flex gap-2 pt-1">
        <button className="btn bg-black text-white border-black" disabled={busy} onClick={save}>설정 저장</button>
        <button className="btn bg-blue-600 text-white border-blue-600" disabled={busy} onClick={recompute}>전체 재계산(가격·이미지)</button>
      </div>
      <p className="text-[11px] text-gray-400">재계산은 직접 수정한 판매가/정상가는 건드리지 않습니다.</p>
    </div>
  );
}
