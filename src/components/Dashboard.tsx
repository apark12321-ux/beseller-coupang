"use client";

import { useEffect, useState, useCallback } from "react";
import Papa from "papaparse";
import { STATUS_LABEL, STATUS_COLOR, CAT_COLOR, won, api } from "@/lib/ui";
import { detectHeaderIndex } from "@/lib/pipeline/csv";
import ProductDetail from "@/components/ProductDetail";
import SettingsPanel from "@/components/SettingsPanel";
import CategoryMapPanel from "@/components/CategoryMapPanel";

const TABS = [
  "all", "candidate", "needs_review", "excluded",
  "registered", "draft_saved", "register_failed",
];

export default function Dashboard() {
  const [tab, setTab] = useState("all");
  const [view, setView] = useState<"products" | "settings" | "catmap">("products");
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [system, setSystem] = useState<any>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [storage, setStorage] = useState<string>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 50;

  const load = useCallback(async (t: string, pg: number) => {
    const data = await api(`/api/products?status=${t}&page=${pg}&pageSize=${PAGE_SIZE}`);
    setItems(data.items || []);
    setCounts(data.counts || {});
    setSystem(data.system || {});
    setStorage(data.storage || "");
    setTotal(data.total || 0);
  }, []);

  useEffect(() => { load(tab, page); }, [tab, page, load]);
  useEffect(() => { setPage(1); }, [tab]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setBusy(true); setMsg("파일 읽는 중...");
    try {
      // 1) 브라우저에서 디코딩(UTF-8 → 깨지면 EUC-KR)
      const buf = await file.arrayBuffer();
      let text = new TextDecoder("utf-8").decode(buf);
      if ((text.match(/\uFFFD/g) || []).length > 2) {
        try { text = new TextDecoder("euc-kr").decode(buf); } catch {}
      }
      // 2) 파싱 + 헤더행 탐지
      const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true });
      const allRows = (parsed.data as string[][]).filter((r) => Array.isArray(r) && r.length > 1);
      if (allRows.length === 0) { setMsg("오류: 파싱된 행 없음"); setBusy(false); return; }
      const hi = detectHeaderIndex(allRows);
      const header = allRows[hi];
      const dataRows = allRows.slice(hi + 1);

      // 3) 배치 전송 (Vercel 4.5MB 본문 제한 회피)
      const uploadId = (crypto as any).randomUUID ? crypto.randomUUID() : String(Date.now());
      const BATCH = 400;
      const totalRows = dataRows.length;
      let added = 0;
      const agg: Record<string, number> = {};
      for (let i = 0; i < dataRows.length; i += BATCH) {
        const rows = dataRows.slice(i, i + BATCH);
        const batchIndex = i / BATCH;
        setMsg(`업로드 중... ${Math.min(i + BATCH, totalRows)}/${totalRows}`);
        const r = await api("/api/upload-rows", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId, filename: file.name, header, rows, batchIndex, rowOffset: i, totalRows }),
        });
        if (r.error) { setMsg(`오류(${added}건 저장됨): ${r.error}`); setBusy(false); load(tab, 1); return; }
        added += r.added || 0;
        for (const [k, v] of Object.entries(r.counts || {})) agg[k] = (agg[k] || 0) + (v as number);
      }
      setMsg(`업로드 완료: ${added}건 (${JSON.stringify(agg)})`);
      setPage(1);
      load(tab, 1);
    } catch (err: any) {
      setMsg("오류: " + String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    if (!window.confirm("업로드된 모든 상품 데이터를 삭제합니다. 되돌릴 수 없습니다. 계속할까요?")) return;
    setBusy(true); setMsg("초기화 중...");
    const r = await api("/api/reset", { method: "POST" });
    setBusy(false);
    if (r.error) { setMsg("오류: " + r.error); return; }
    setSelected(null);
    setMsg(`초기화 완료: ${r.removed}건 삭제`);
    load(tab, 1);
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
          <button className="btn bg-white border-gray-300 text-red-600 hover:bg-red-50"
            onClick={onReset} disabled={busy}>전체 초기화</button>
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
          <button key={t} onClick={() => { setTab(t); setView("products"); }}
            className={`btn ${view === "products" && tab === t ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-300"}`}>
            {STATUS_LABEL[t]} <span className="opacity-70">{counts[t] ?? 0}</span>
          </button>
        ))}
        <span className="mx-1 border-l" />
        <button onClick={() => setView("catmap")}
          className={`btn ${view === "catmap" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-gray-300"}`}>카테고리 매핑</button>
        <button onClick={() => setView("settings")}
          className={`btn ${view === "settings" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-gray-300"}`}>설정</button>
        {["가격 자동조정", "썸네일 관리", "주문/발주 변환"].map((t) => (
          <button key={t} disabled title="MVP 범위 외"
            className="btn bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed">{t}</button>
        ))}
      </div>

      {view === "settings" ? (
        <SettingsPanel onRecomputed={() => load(tab, page)} />
      ) : view === "catmap" ? (
        <CategoryMapPanel />
      ) : (
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
          {total > 0 && (
            <div className="flex items-center justify-between px-3 py-2 border-t bg-gray-50 text-xs text-gray-600">
              <span>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / 총 {total.toLocaleString("ko-KR")}건
              </span>
              <div className="flex gap-1">
                <button className="btn bg-white border-gray-300 disabled:opacity-40" disabled={page <= 1}
                  onClick={() => setPage((v) => Math.max(1, v - 1))}>이전</button>
                <span className="px-2 py-1">{page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
                <button className="btn bg-white border-gray-300 disabled:opacity-40" disabled={page >= Math.ceil(total / PAGE_SIZE)}
                  onClick={() => setPage((v) => v + 1)}>다음</button>
              </div>
            </div>
          )}
        </div>

        <div>
          {selected
            ? <ProductDetail id={selected} system={system} onChanged={() => load(tab, page)} />
            : <div className="card p-8 text-center text-gray-400">상품을 선택하면 상세가 표시됩니다.</div>}
        </div>
      </div>
      )}
    </div>
  );
}
