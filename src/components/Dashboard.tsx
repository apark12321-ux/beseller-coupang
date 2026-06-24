"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import { STATUS_LABEL, won, api } from "@/lib/ui";
import { detectHeaderIndex } from "@/lib/pipeline/csv";
import ProductDetail from "@/components/ProductDetail";
import SettingsPanel from "@/components/SettingsPanel";
import CategoryMapPanel from "@/components/CategoryMapPanel";
import AutopilotPanel from "@/components/AutopilotPanel";
import OpenApiPanel from "@/components/OpenApiPanel";

const STATUS_PILLS = ["all", "candidate", "ready", "needs_review", "excluded", "draft_saved", "register_failed"];
const PAGE_SIZE = 50;

export default function Dashboard() {
  const [view, setView] = useState<"products" | "settings" | "catmap" | "auto" | "openapi">("products");
  const [tab, setTab] = useState("all");
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [system, setSystem] = useState<any>({});
  const [storage, setStorage] = useState("");
  const [coverage, setCoverage] = useState<{ covered: number; total: number }>({ covered: 0, total: 0 });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [up, setUp] = useState<{ active: boolean; pct: number; label: string }>({ active: false, pct: 0, label: "" });
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (t: string, pg: number) => {
    const data = await api(`/api/products?status=${t}&page=${pg}&pageSize=${PAGE_SIZE}`);
    setItems(data.items || []); setCounts(data.counts || {}); setSystem(data.system || {});
    setStorage(data.storage || ""); setTotal(data.total || 0);
  }, []);

  const loadCoverage = useCallback(async () => {
    try {
      const d = await api("/api/category-codes");
      const tot = (d.items || []).reduce((a: number, x: any) => a + x.count, 0);
      const cov = (d.items || []).filter((x: any) => x.mapped?.displayCategoryCode).reduce((a: number, x: any) => a + x.count, 0);
      setCoverage({ covered: cov, total: tot });
    } catch {}
  }, []);

  useEffect(() => { load(tab, page); }, [tab, page, load]);
  useEffect(() => { setPage(1); }, [tab]);
  useEffect(() => { loadCoverage(); }, [loadCoverage, counts.all]);

  async function processFile(file: File) {
    setBusy(true); setUp({ active: true, pct: 0, label: "파일 읽는 중…" });
    try {
      const buf = await file.arrayBuffer();
      let text = new TextDecoder("utf-8").decode(buf);
      if ((text.match(/\uFFFD/g) || []).length > 2) { try { text = new TextDecoder("euc-kr").decode(buf); } catch {} }
      const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true });
      const allRows = (parsed.data as string[][]).filter((r) => Array.isArray(r) && r.length > 1);
      if (allRows.length === 0) { setUp({ active: false, pct: 0, label: "" }); setMsg("파싱된 행이 없습니다. 파일 형식을 확인하세요."); setBusy(false); return; }
      const hi = detectHeaderIndex(allRows);
      const header = allRows[hi]; const dataRows = allRows.slice(hi + 1);
      const uploadId = (crypto as any).randomUUID ? crypto.randomUUID() : String(Date.now());
      const BATCH = 400; const totalRows = dataRows.length; let added = 0; const agg: Record<string, number> = {};
      for (let i = 0; i < dataRows.length; i += BATCH) {
        const rows = dataRows.slice(i, i + BATCH); const batchIndex = i / BATCH;
        const done = Math.min(i + BATCH, totalRows);
        setUp({ active: true, pct: Math.round((done / totalRows) * 100), label: `등록 중 ${done.toLocaleString("ko-KR")} / ${totalRows.toLocaleString("ko-KR")}` });
        const r = await api("/api/upload-rows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uploadId, filename: file.name, header, rows, batchIndex, rowOffset: i, totalRows }) });
        if (r.error) { setMsg(`오류 (${added}건 저장됨): ${r.error}`); break; }
        added += r.added || 0;
        for (const [k, v] of Object.entries(r.counts || {})) agg[k] = (agg[k] || 0) + (v as number);
      }
      setUp({ active: false, pct: 100, label: "" });
      setMsg(`${added.toLocaleString("ko-KR")}건 등록 완료 · 후보 ${agg.candidate || 0} / 검수 ${agg.needs_review || 0} / 제외 ${agg.excluded || 0}`);
      setView("products"); setTab("all"); setPage(1); load("all", 1); loadCoverage();
    } catch (e: any) { setMsg("오류: " + String(e?.message ?? e)); setUp({ active: false, pct: 0, label: "" }); }
    finally { setBusy(false); }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }
  function onDrop(e: React.DragEvent) { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f && /\.csv$/i.test(f.name)) processFile(f); else if (f) setMsg("CSV 파일만 업로드할 수 있습니다."); }

  async function onReset() {
    if (!window.confirm("등록된 모든 상품 데이터를 삭제합니다. 되돌릴 수 없습니다. 계속할까요?")) return;
    setBusy(true); setMsg("초기화 중…");
    const r = await api("/api/reset", { method: "POST" }); setBusy(false);
    if (r.error) { setMsg("오류: " + r.error); return; }
    setSelected(null); setMsg(`${(r.removed || 0).toLocaleString("ko-KR")}건 삭제됨`); load(tab, 1); loadCoverage();
  }

  const all = counts.all || 0;
  const cooldownActive = system?.cooldownUntil && new Date(system.cooldownUntil) > new Date();
  const deployedFileMode = storage === "file" && typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname);
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  const stages = [
    { no: "00", name: "OPEN API", metric: system?.lastGetTestOk ? 1 : 0, sub: system?.lastGetTestOk ? "GET OK" : "미연동", bar: system?.lastGetTestOk ? 100 : 0, cls: system?.lastGetTestOk ? "ready" : "review", onClick: () => setView("openapi") },
    { no: "01", name: "업로드", metric: all, sub: "상품", bar: all > 0 ? 100 : 0, cls: "", onClick: () => { setView("products"); setTab("all"); } },
    { no: "02", name: "정상 후보", metric: counts.candidate || 0, sub: `/ ${all}`, bar: pct(counts.candidate || 0, all), cls: "ready", onClick: () => { setView("products"); setTab("candidate"); } },
    { no: "03", name: "카테고리 매핑", metric: coverage.covered, sub: `/ ${coverage.total}`, bar: pct(coverage.covered, coverage.total), cls: "", onClick: () => setView("catmap") },
    { no: "04", name: "자동 등록", metric: counts.draft_saved || 0, sub: `/ ${(counts.candidate||0)+(counts.ready||0)}`, bar: pct(counts.draft_saved || 0, (counts.candidate||0)+(counts.ready||0)+(counts.draft_saved||0)), cls: "ready", onClick: () => setView("auto") },
  ];

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="brand-mark">비셀러 <b>→</b> 쿠팡</span>
          <span className="brand-sub">등록 파이프라인 · 검수 후 마지막 단계에서만 실제 등록</span>
        </div>
        <div className="topbar-right">
          {cooldownActive && <span className="chip warn"><span className="dot" />쿨다운</span>}
          <span className={`chip ${storage === "redis" ? "ok" : ""}`}><span className="dot" />{storage === "redis" ? "Redis 저장" : "파일 저장"}</span>
          <span className={`chip ${system?.lastGetTestOk ? "ok" : ""}`}><span className="dot" />GET {system?.lastGetTestOk ? "성공" : "미실행"}</span>
          <button className="btn btn-danger-ghost" onClick={onReset} disabled={busy}>전체 초기화</button>
        </div>
      </div>

      {/* signature: pipeline rail */}
      <div className="rail">
        {stages.map((s) => {
          const active = (view === "openapi" && s.no === "00") || (view === "products" && ((s.no === "01" && tab === "all") || (s.no === "02" && tab === "candidate") || false)) || (view === "catmap" && s.no === "03") || (view === "auto" && s.no === "04");
          return (
            <button key={s.no} className={`stage ${active ? "active" : ""}`} onClick={s.onClick}>
              {up.active && s.no === "01" && <div className="rail-flow" style={{ position: "absolute", top: 0, left: 0, right: 0 }} />}
              <div className="stage-no">{s.no}</div>
              <div className="stage-name">{s.name}</div>
              <div className="stage-metric">{s.metric.toLocaleString("ko-KR")}<small>{s.sub}</small></div>
              <div className={`stage-bar ${s.cls}`}><i style={{ width: `${s.bar}%` }} /></div>
            </button>
          );
        })}
      </div>

      {deployedFileMode && <div className="banner warn">서버리스 배포인데 저장소가 파일 모드입니다. Upstash Redis를 연결하고 재배포하세요.</div>}

      {/* uploader */}
      {up.active ? (
        <div className="uploader-bar">
          <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{up.label}</span>
          <div className="progress"><i style={{ width: `${up.pct}%` }} /></div>
          <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{up.pct}%</span>
        </div>
      ) : all === 0 ? (
        <div className={`dropzone ${drag ? "drag" : ""}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)} onDrop={onDrop}>
          <div className="dz-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          </div>
          <div className="dz-title">비셀러 상품 CSV를 여기에 끌어다 놓으세요</div>
          <div className="dz-sub">놓으면 바로 분석·등록됩니다 · 클릭해서 파일 선택도 가능 · EUC-KR/UTF-8 자동 인식</div>
        </div>
      ) : (
        <div className="uploader-bar">
          <span style={{ fontSize: 13, fontWeight: 700 }}>상품 {all.toLocaleString("ko-KR")}건 등록됨</span>
          <span style={{ flex: 1 }} />
          {msg && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{msg}</span>}
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>CSV 추가 업로드</button>
        </div>
      )}
      <input ref={fileRef} type="file" accept=".csv" hidden onChange={onPick} />
      {all === 0 && msg && <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>{msg}</div>}

      {/* secondary nav */}
      <div className="toolbar">
        {view === "products" && STATUS_PILLS.map((t) => (
          <button key={t} className={`pill ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            <span className={`pdot ${t}`} />{STATUS_LABEL[t]}<span className="pn">{counts[t] ?? 0}</span>
          </button>
        ))}
        {view !== "products" && <button className="tab2" onClick={() => setView("products")}>← 상품 목록</button>}
        <span style={{ flex: 1 }} />
        <button className={`tab2 ${view === "openapi" ? "active" : ""}`} onClick={() => setView("openapi")}>OPEN API</button>
        <button className={`tab2 ${view === "auto" ? "active" : ""}`} onClick={() => setView("auto")}>⚡ 자동 실행</button>
        <button className={`tab2 ${view === "catmap" ? "active" : ""}`} onClick={() => setView("catmap")}>카테고리 매핑</button>
        <button className={`tab2 ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}>설정</button>
      </div>

      {view === "openapi" ? (
        <OpenApiPanel onChanged={() => { load(tab, page); loadCoverage(); }} />
      ) : view === "auto" ? (
        <AutopilotPanel onChanged={() => { load(tab, page); loadCoverage(); }} />
      ) : view === "settings" ? (
        <SettingsPanel onRecomputed={() => { load(tab, page); loadCoverage(); }} />
      ) : view === "catmap" ? (
        <CategoryMapPanel onChanged={loadCoverage} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 520px" : "1fr", gap: 16 }}>
          <div className="panel" style={{ overflow: "hidden" }}>
            <div style={{ maxHeight: "calc(100vh - 320px)", overflowY: "auto" }}>
              <table className="data">
                <thead><tr>
                  <th>상품</th><th>카테고리</th><th style={{ textAlign: "right" }}>원가</th>
                  <th style={{ textAlign: "right" }}>판매가</th><th style={{ textAlign: "right" }}>정상가</th><th>상태</th>
                </tr></thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className={selected === it.id ? "sel" : ""} onClick={() => setSelected(it.id)}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {it.thumbnail ? <img src={it.thumbnail} alt="" className="thumb" /> : <div className="thumb-empty">IMG</div>}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>{it.finalName}</div>
                            <div style={{ fontSize: 11.5, color: "var(--faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>{it.originalName}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge b-${it.categoryStatus}`}>{it.categoryStatus}</span>
                        <span className={`badge ${it.taxType === "FREE" ? "b-free" : "b-tax"}`} style={{ marginLeft: 4 }}>{it.taxType === "FREE" ? "면세" : "과세"}</span>
                      </td>
                      <td style={{ textAlign: "right", color: "var(--muted)" }} className="mono">{won(it.supplyPrice)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }} className="mono">{won(it.salePrice)}</td>
                      <td style={{ textAlign: "right", color: "var(--muted)" }} className="mono">{won(it.originalPrice)}</td>
                      <td>
                        <span className={`badge b-${it.status}`}>{STATUS_LABEL[it.status] || it.status}</span>
                        {it.blockReasons?.length > 0 && <div style={{ fontSize: 10.5, color: "var(--danger)", marginTop: 3, maxWidth: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.blockReasons[0]}</div>}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan={6}><div className="empty">{all === 0 ? "위에 CSV를 올리면 상품이 표시됩니다." : "이 상태의 상품이 없습니다."}</div></td></tr>}
                </tbody>
              </table>
            </div>
            {total > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderTop: "1px solid var(--line)", fontSize: 12.5, color: "var(--muted)" }}>
                <span>{((page - 1) * PAGE_SIZE + 1).toLocaleString("ko-KR")}–{Math.min(page * PAGE_SIZE, total).toLocaleString("ko-KR")} · 총 {total.toLocaleString("ko-KR")}건</span>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button className="btn" disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>이전</button>
                  <span className="mono">{page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
                  <button className="btn" disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage((v) => v + 1)}>다음</button>
                </span>
              </div>
            )}
          </div>
          {selected && <ProductDetail id={selected} system={system} onChanged={() => load(tab, page)} onClose={() => setSelected(null)} />}
        </div>
      )}
    </div>
  );
}
