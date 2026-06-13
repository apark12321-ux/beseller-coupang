import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

export function Deck({ render, classes = [] }: { render: (go: (i: number) => void) => ReactNode[]; classes?: string[] }) {
  const [cur, setCur] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(new Set([0]));
  const x0 = useRef<number | null>(null), y0 = useRef<number | null>(null);

  const total = useRef(0);
  const go = useCallback((i: number) => {
    i = Math.max(0, Math.min(total.current - 1, i));
    setCur(i); setSeen((s) => new Set(s).add(i));
  }, []);
  const slides = render(go);
  total.current = slides.length;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(cur + 1); if (e.key === "ArrowLeft") go(cur - 1); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [cur, go]);

  return (
    <div className={"deck" + (cur === 0 ? " hidenav" : "")}
      onTouchStart={(e) => { x0.current = e.touches[0].clientX; y0.current = e.touches[0].clientY; }}
      onTouchEnd={(e) => {
        if (x0.current == null) return;
        const dx = e.changedTouches[0].clientX - x0.current, dy = e.changedTouches[0].clientY - (y0.current || 0);
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? cur + 1 : cur - 1);
        x0.current = null;
      }}>
      <div className="track" style={{ transform: `translateX(${-cur * 100}%)` }}>
        {slides.map((s, i) => (
          <section key={i} className={"slide " + (classes[i] || "") + (seen.has(i) ? " seen" : "")} data-active={cur === i ? "1" : undefined}>{s}</section>
        ))}
      </div>
      <div className={"chev l" + (cur <= 1 ? " dim" : "")} onClick={() => go(cur - 1)}>
        <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </div>
      <div className={"chev r" + (cur === slides.length - 1 ? " dim" : "")} onClick={() => go(cur + 1)}>
        <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
      </div>
      <div className="nav">
        {slides.slice(1).map((_, j) => (
          <span key={j} className={"dot" + (cur === j + 1 ? " on" : "")} onClick={() => go(j + 1)} />
        ))}
      </div>
    </div>
  );
}

export function useActive(ref: React.RefObject<HTMLElement>) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const el = ref.current?.closest(".slide") as HTMLElement | null;
    if (!el) return;
    const sync = () => setActive(el.dataset.active === "1");
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["data-active"] });
    sync();
    return () => obs.disconnect();
  }, []);
  return active;
}
