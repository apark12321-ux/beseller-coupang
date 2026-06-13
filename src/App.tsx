import { useEffect, useState } from "react";
import { PriceModal, KakaoModal, StockModal, NewsModal } from "./components/Modals";
import { fetchBriefing } from "./lib/api";
import { useLive } from "./hooks/useLive";
import { EMPTY } from "./lib/empty";
import { Briefing, Stock, NewsItem } from "./lib/types";
import Finder from "./finder/Finder";
import Web from "./Web";

type Modal = { kind: "price" } | { kind: "kakao" } | { kind: "stock"; stock: Stock } | { kind: "news"; news: NewsItem } | null;

export default function App() {
  if (typeof window !== "undefined" && window.location.pathname.replace(/\/+$/, "") === "/finder") return <Finder />;
  return <Briefingapp />;
}

function Briefingapp() {
  const [b, setB] = useState<Briefing>(EMPTY);
  const live = useLive();
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");

  useEffect(() => { fetchBriefing().then(setB).catch(() => {}); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2800); return () => clearTimeout(t); }, [toast]);

  const openPrice = () => setModal({ kind: "price" });
  const openKakao = () => setModal({ kind: "kakao" });
  const openStock = (s: Stock) => setModal({ kind: "stock", stock: s });
  const openNews = (n: NewsItem) => setModal({ kind: "news", news: n });
  const close = () => setModal(null);

  return (
    <>
      <Web b={b} live={live} openPrice={openPrice} openKakao={openKakao} openStock={openStock} openNews={openNews} />
      {modal?.kind === "price" && <PriceModal onClose={close} />}
      {modal?.kind === "kakao" && <KakaoModal onClose={close} onDone={() => { close(); setToast("신청 완료 — 내일 06:30부터 카톡으로 받아요"); }} />}
      {modal?.kind === "stock" && <StockModal stock={modal.stock} onClose={close} />}
      {modal?.kind === "news" && <NewsModal news={modal.news} onClose={close} />}
      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}
