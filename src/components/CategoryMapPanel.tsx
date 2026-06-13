"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/ui";

export default function CategoryMapPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [draft, setDraft] = useState<Record<string, { code: string; path: string }>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const d = await api("/api/category-codes");
    setItems(d.items || []);
    const init: Record<string, { code: string; path: string }> = {};
    for (const it of d.items || []) init[it.code] = { code: it.mapped?.displayCategoryCode || "", path: it.mapped?.coupangPath || "" };
    setDraft(init);
  }
  useEffect(() => { load(); }, []);

  async function save(code: string) {
    setBusy(true);
    const d = draft[code] || { code: "", path: "" };
    const r = await api("/api/category-map", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, displayCategoryCode: d.code, coupangPath: d.path }) });
    setBusy(false);
    if (r.ok) { setMsg(`저장됨: ${code}`); load(); }
  }

  const totalProducts = items.reduce((a, it) => a + it.count, 0);
  const coveredProducts = items.filter((it) => draft[it.code]?.code).reduce((a, it) => a + it.count, 0);

  return (
    <div className="card p-5 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-base">카테고리 일괄 매핑</h2>
        <span className="text-xs text-gray-500">
          매핑 적용: <b className="text-blue-600">{coveredProducts.toLocaleString("ko-KR")}</b> / {totalProducts.toLocaleString("ko-KR")} 상품
        </span>
      </div>
      <p className="text-[11px] text-gray-500">
        비셀러 카테고리코드별로 쿠팡 카테고리를 한 번만 지정하면 같은 코드의 모든 상품에 자동 적용됩니다.
        (상품 개별로 지정한 값이 우선) 등록 시점에 해석되므로 수천 건을 따로 수정할 필요가 없습니다.
      </p>
      {msg && <div className="text-xs bg-green-50 border border-green-200 rounded px-3 py-1">{msg}</div>}

      <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500 sticky top-0">
            <tr>
              <th className="text-left px-2 py-1">비셀러 코드</th>
              <th className="text-left px-2">분류</th>
              <th className="text-right px-2">상품수</th>
              <th className="text-left px-2">쿠팡 displayCategoryCode</th>
              <th className="text-left px-2">쿠팡 경로(선택)</th>
              <th className="px-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const d = draft[it.code] || { code: "", path: "" };
              const dirty = (it.mapped?.displayCategoryCode || "") !== d.code || (it.mapped?.coupangPath || "") !== d.path;
              return (
                <tr key={it.code} className="border-t">
                  <td className="px-2 py-1 font-mono">{it.code}</td>
                  <td className="px-2 text-gray-500">{it.label}</td>
                  <td className="px-2 text-right">{it.count.toLocaleString("ko-KR")}</td>
                  <td className="px-2">
                    <input className="w-28 border rounded px-1.5 py-0.5" value={d.code}
                      onChange={(e) => setDraft({ ...draft, [it.code]: { ...d, code: e.target.value } })} placeholder="예: 80001234" />
                  </td>
                  <td className="px-2">
                    <input className="w-44 border rounded px-1.5 py-0.5" value={d.path}
                      onChange={(e) => setDraft({ ...draft, [it.code]: { ...d, path: e.target.value } })} placeholder="식품>..." />
                  </td>
                  <td className="px-2">
                    <button className={`btn ${dirty ? "bg-black text-white border-black" : "bg-gray-100 text-gray-400 border-gray-200"}`}
                      disabled={busy || !dirty} onClick={() => save(it.code)}>저장</button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-8">상품을 업로드하면 코드가 집계됩니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
