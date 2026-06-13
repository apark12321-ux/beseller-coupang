import { useEffect, useState, ReactNode } from "react";

export function LockIcon({ cls }: { cls?: string }) {
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function CountUp({ value, dec = 0, pre = "", suf = "", comma = false, run }: {
  value: number; dec?: number; pre?: string; suf?: string; comma?: boolean; run: boolean;
}) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0; const st = performance.now(), dur = 1000;
    const step = (now: number) => {
      const k = Math.min((now - st) / dur, 1), e = 1 - Math.pow(1 - k, 3);
      setV(value * e); if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run, value]);
  const num = comma ? Number(v.toFixed(dec)).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec);
  return <>{pre}{num}{suf}</>;
}

export function Spark({ pts, cls = "spark" }: { pts: number[]; cls?: string }) {
  const max = 24, step = 100 / (pts.length - 1);
  const line = pts.map((y, i) => `${(i * step).toFixed(0)},${y}`).join(" ");
  const area = `${line} 100,${max} 0,${max}`;
  return (
    <svg className={cls} viewBox={`0 0 100 ${max}`} preserveAspectRatio="none">
      <polyline points={line} /><polygon className="area" points={area} />
    </svg>
  );
}

export function Bar({ w, color, run }: { w: number; color: string; run: boolean }) {
  return <div className="bar"><i style={{ width: run ? w + "%" : 0, background: color }} /></div>;
}

/** 유료 게이트: active 면 그대로, 아니면 블러+잠금 오버레이(클릭 시 onUnlock) */
export function Gate({ active, onUnlock, children, teaser }: {
  active: boolean; onUnlock: () => void; children: ReactNode; teaser?: ReactNode;
}) {
  if (active) return <>{children}</>;
  return (
    <div className="lockwrap" onClick={onUnlock}>
      <div className="lockblur">{teaser ?? children}</div>
      <div className="lockover"><div className="lc2"><LockIcon /><span className="lt">PRO</span></div></div>
    </div>
  );
}

export function Empty({ label }: { label: string }) {
  return <div className="empty"><span className="edot" />{label}</div>;
}
