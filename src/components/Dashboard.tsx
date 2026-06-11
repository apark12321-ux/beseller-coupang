"use client";

import { useEffect, useState, useCallback } from "react";
import { STATUS_LABEL, STATUS_COLOR, CAT_COLOR, won, api } from "@/lib/ui";
import ProductDetail from "@/components/ProductDetail";

const TABS = [
  "all", "candidate", "needs_review", "excluded",
  "registered", "draft_saved", "register_failed",
];
const STUB_TABS = ["가격 자동조정", "썸네일 관리", "쿠팡 API 설정", "카테고리 검증", "주문/발주 변환"];

export default function Dashboard() {
  const [tab, setTab] = useState("all");
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [system, setSystem] = useState<any>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [storage, setStorage] = useState<string>("");

  const load = useCallback(async (t: string) => {
    const data = await api(`/api/products?status=${t}`);
    setItems(data.items || []);
    setCounts(data.counts || {});
    setSystem(data.system || {});
    setStorage(data.storage || "");
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setMsg("업로드/파싱 중...");
    const fd = new FormData();
    fd.append("file", file);
    const r = await api("/api/upload", { method: "POST", body: fd });
    setBusy(false);
    if (r.error) { setMsg("오류: " + r.error); return; }
    setMsg(`업로드 완료: ${r.rowCount}행 (${JSON.stringify(r.counts)})`);
    load(tab);
    e.target.value = "";
  }

  const cooldownActive = system?.cooldownUntil && new Date(system.cooldownUntil) > new Date();

  return (
    <div className="max-w-[1400px] mx-auto p-4">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">비셀러 → 쿠팡 등록 대시보드</h1>
          <p className="text-xs text-gray-500">로컬 검수 도구 · 127.0.0.1:3000 · 실제 POST는 마지막 단계에서만</p>
        </div>
        <div className="flex items-center gap-2">
          {cooldownActive && (
            <span className="badge bg-red-100 text-red-700">
              쿨다운 ~ {new Date(system.cooldownUntil).toLocaleString("ko-KR")}
            </span>
          )}
          <span className={`badge ${system?.lastGetTestOk ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
            GET 테스트 {system?.lastGetTestOk ? "성공" : "미실행"}
          </span>
          <label className="btn bg-black text-white border-black cursor-pointer">
            CSV 업로드
            <input type="file" accept=".csv" className="hidden" onChange={onUpload} disabled={busy} />
          </label>
        </div>
      </header>

      {msg && <div className="mb-3 text-sm text-gray-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">{msg}</div>}

      {storage === "file" && typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname) && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-300 rounded px-3 py-2">
          ⚠ 서버리스(배포) 환경인데 저장소가 <b>파일 모드</b>입니다. 업로드/저장이 실패합니다.
          Vercel에 Upstash Redis를 연결하고(<code>UPSTASH_REDIS_REST_URL/TOKEN</code> 또는 <code>KV_REST_API_URL/TOKEN</code>) 재배포하세요.
        </div>
      )}

      <div className="flex flex-wrap gap-1 mb-3">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`btn ${tab === t ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-300"}`}>
            {STATUS_LABEL[t]} <span className="opacity-70">{counts[t] ?? 0}</span>
          </button>
        ))}
        {STUB_TABS.map((t) => (
          <button key={t} disabled title="MVP 범위 외 (placeholder)"
            className="btn bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed">{t}</button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_520px] gap-4">
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2">상품</th>
                <th className="text-left px-2">카테고리</th>
                <th className="text-right px-2">원가</th>
                <th className="text-right px-2">판매가</th>
                <th className="text-right px-2">정상가</th>
                <th className="text-left px-2">상태</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} onClick={() => setSelected(it.id)}
                  className={`border-t cursor-pointer hover:bg-blue-50 ${selected === it.id ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {it.thumbnail
                        ? <img src={it.thumbnail} alt="" className="w-9 h-9 object-cover rounded border" />
                        : <div className="w-9 h-9 rounded border bg-gray-100 text-[9px] text-gray-400 flex items-center justify-center">無</div>}
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[260px]">{it.finalName}</div>
                        <div className="text-[11px] text-gray-400 truncate max-w-[260px]">{it.originalName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2">
                    <span className={`badge ${CAT_COLOR[it.categoryStatus] || ""}`}>{it.categoryStatus}</span>
                  </td>
                  <td className="px-2 text-right text-gray-500">{won(it.supplyPrice)}</td>
                  <td className="px-2 text-right">{won(it.salePrice)}</td>
                  <td className="px-2 text-right text-gray-500">{won(it.originalPrice)}</td>
                  <td className="px-2">
                    <span className={`badge ${STATUS_COLOR[it.status] || ""}`}>{STATUS_LABEL[it.status] || it.status}</span>
                    {it.blockReasons?.length > 0 && (
                      <div className="text-[10px] text-red-500 mt-0.5 truncate max-w-[140px]">{it.blockReasons[0]}</div>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-400 py-10">상품 없음. CSV를 업로드하세요.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          {selected
            ? <ProductDetail id={selected} system={system} onChanged={() => load(tab)} />
            : <div className="card p-8 text-center text-gray-400">상품을 선택하면 상세가 표시됩니다.</div>}
        </div>
      </div>
    </div>
  );
}
