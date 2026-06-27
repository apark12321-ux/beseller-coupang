"use client";

import { useState, useRef } from "react";
import { api } from "@/lib/ui";

type StepState = "idle" | "run" | "done" | "err";

export default function AutopilotPanel({ onChanged }: { onChanged: () => void }) {
  const [doRecommend, setDoRecommend] = useState(false);
  const [doRegister, setDoRegister] = useState(false);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<{ t: string; cls?: string }[]>([]);
  const [steps, setSteps] = useState<Record<string, StepState>>({ price: "idle", cat: "idle", dry: "idle", reg: "idle" });
  const logRef = useRef<HTMLDivElement>(null);

  const add = (t: string, cls?: string) => setLog((L) => [...L, { t, cls }]);
  const setStep = (k: string, v: StepState) => setSteps((s) => ({ ...s, [k]: v }));
  function scroll() { setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 30); }

  async function loopOffset(url: string, body: any, onTick: (r: any) => void): Promise<any> {
    let offset = 0;
    while (true) {
      const r = await api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, offset }) });
      if (r.error || r.stopped) return r;
      onTick(r); scroll();
      offset = r.nextOffset;
      if (r.done || r.processed === 0) return r;
    }
  }

  async function run() {
    setRunning(true); setLog([]); setSteps({ price: "idle", cat: "idle", dry: "idle", reg: "idle" });
    add("자동 처리 시작", "dim");
    try {
      setStep("price", "run"); add("① 가격·이미지 재계산…");
      const recompute = await loopOffset("/api/recompute", { limit: 300 }, (r) => add(`   ${Math.min(r.nextOffset, r.total)}/${r.total} 처리`, "dim"));
      if (recompute.error || recompute.stopped) { setStep("price", "err"); add(`① 중단: ${recompute.message || recompute.error || recompute.reason}`, "err"); return; }
      setStep("price", "done"); add("① 완료", "ok");

      if (doRecommend) {
        setStep("cat", "run"); add("② 카테고리 자동배정(쿠팡 추천)…");
        let totalRecommended = 0;
        const r = await loopOffset("/api/bulk/category-recommend", { limit: 3 }, (r) => {
          totalRecommended += r.recommended || 0;
          add(`   ${Math.min(r.nextOffset, r.total)}/${r.total} 확인 · 배정 ${totalRecommended}건 누적`, "dim");
        });
        if (r.error || r.stopped) {
          setStep("cat", "err");
          add(`② 중단: ${r.message || r.error || r.reason || "카테고리 자동배정 실패"}`, "err");
          add("터널/PC 절전/쿠팡 응답 지연이면 그대로 다시 실행하면 이미 저장된 건은 건너뛰고 이어서 진행됩니다.", "dim");
          return;
        }
        setStep("cat", "done"); add(`② 완료 (추천 배정 ${totalRecommended}건)`, "ok");
      } else { add("② 카테고리 자동배정 건너뜀 (매핑표 사용)", "dim"); }

      setStep("dry", "run"); add("③ 일괄 Dry Run(검증)…");
      let ready = 0, blocked = 0;
      const dry = await loopOffset("/api/bulk/dry-run", { limit: 300 }, (r) => { ready += r.ready || 0; blocked += r.blocked || 0; add(`   준비완료 ${ready} / 차단 ${blocked}`, "dim"); });
      if (dry.error || dry.stopped) { setStep("dry", "err"); add(`③ 중단: ${dry.message || dry.error || dry.reason}`, "err"); return; }
      setStep("dry", "done"); add(`③ 완료 — 등록 준비 ${ready}건, 차단 ${blocked}건`, ready > 0 ? "ok" : "err");
      onChanged();

      if (ready <= 0) {
        if (doRegister) setStep("reg", "err");
        add("등록 준비 상품이 0건이라 실제 등록을 실행하지 않습니다.", "err");
        return;
      }

      if (doRegister) {
        setStep("reg", "run"); add("④ 실제 등록(임시저장, requested=false)…");
        let reg = 0, fail = 0, guard = 0;
        while (guard++ < 2000) {
          const r = await api("/api/bulk/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 10 }) });
          if (r.error) { setStep("reg", "err"); add(`④ 오류: ${r.message || r.error}`, "err"); break; }
          if (r.stopped) { setStep("reg", "err"); add(`④ 중단: ${r.message || r.reason}${r.cooldownUntil ? " (쿨다운)" : ""}`, "err"); break; }
          reg += r.registered || 0; fail += r.failed || 0;
          add(`   등록 ${reg} / 실패 ${fail} (남은 ${r.remaining})`, "dim"); scroll();
          onChanged();
          if (r.done || r.processed === 0) { setStep("reg", "done"); add(`④ 완료 — 등록 ${reg}, 실패 ${fail}`, "ok"); break; }
        }
      } else { add("④ 실제 등록 건너뜀 (준비까지만)", "dim"); }

      add("자동 처리 종료", "dim");
    } catch (e: any) { add("오류: " + String(e?.message ?? e), "err"); }
    finally { setRunning(false); onChanged(); }
  }

  const stepRows = [
    { k: "price", n: "01", name: "가격·이미지 재계산", desc: "설정 기준으로 전 상품 판매가·이미지 갱신 (직접 수정값 보존)" },
    { k: "cat", n: "02", name: "카테고리 자동배정", desc: "쿠팡 추천 API로 카테고리 자동 지정 · 등록 IP 필요 (끄면 매핑표 사용)" },
    { k: "dry", n: "03", name: "일괄 Dry Run", desc: "전 상품 검증 → 통과는 ‘등록 준비’, 미흡은 ‘정상 후보’로 분류" },
    { k: "reg", n: "04", name: "실제 등록(임시저장)", desc: "준비된 상품을 쿠팡에 임시저장 · 등록 IP 필요 · 403 시 자동 정지" },
  ];

  return (
    <div className="panel" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>오토파일럿 · 전체 자동 처리</h2>
        <button className="btn btn-primary" onClick={run} disabled={running} style={{ padding: "9px 18px" }}>
          {running ? "실행 중…" : "자동 처리 시작"}
        </button>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0 }}>
        업로드된 상품을 한 번에 처리합니다. 쿠팡을 호출하는 ②·④는 WING에 등록된 고정 IP에서만 동작하며, 그 외 환경에선 403으로 안전하게 정지합니다.
      </p>

      <div style={{ display: "flex", gap: 16, margin: "10px 0 16px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 }}>
          <input type="checkbox" checked={doRecommend} onChange={(e) => setDoRecommend(e.target.checked)} disabled={running} />
          ② 카테고리 자동배정 포함
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 }}>
          <input type="checkbox" checked={doRegister} onChange={(e) => setDoRegister(e.target.checked)} disabled={running} />
          ④ 실제 등록까지 포함
        </label>
      </div>

      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        {stepRows.map((s) => {
          const st = steps[s.k];
          const skipped = (s.k === "cat" && !doRecommend) || (s.k === "reg" && !doRegister);
          return (
            <div key={s.k} className={`auto-step ${st === "run" ? "run" : st === "done" ? "done" : ""}`} style={skipped ? { opacity: 0.5 } : {}}>
              <div className="auto-num">{st === "done" ? "✓" : st === "err" ? "!" : s.n}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{s.name}{skipped && <span style={{ fontSize: 11, color: "var(--faint)", fontWeight: 600 }}> · 건너뜀</span>}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.desc}</div>
              </div>
              {st === "run" && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--brand)" }}>진행 중…</span>}
              {st === "done" && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ready)" }}>완료</span>}
              {st === "err" && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--danger)" }}>정지</span>}
            </div>
          );
        })}
      </div>

      {log.length > 0 && (
        <div className="log" ref={logRef}>
          {log.map((l, i) => <div key={i} className={l.cls}>{l.t}</div>)}
        </div>
      )}
    </div>
  );
}
