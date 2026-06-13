import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getKiwoomToken } from "./kiwoom-token";

/**
 * 국내 거래량/거래대금 상위 종목 — 키움 순위정보.
 * 엔드포인트:  POST /api/dostk/rkinfo
 * 헤더 api-id 로 TR 선택:
 *   ka10030 당일거래량상위   ka10032 거래대금상위
 *   ka10023 거래량급증       ka10027 전일대비등락률상위
 * 연속조회: 요청 헤더 cont-yn / next-key, 응답 헤더의 동일 값 재사용.
 * 시크릿(appkey/secretkey)은 절대 클라이언트로 내보내지 말 것.
 *
 * ▼ 매물대(거래량 프로파일)는 단발 조회로는 안 나옵니다.
 *   실시간 체결 WebSocket(주식체결 type "0B")을 장중 누적해 가격대별 거래량으로 집계하세요.
 *   wss://api.kiwoom.com:10000/api/dostk/websocket  (모의: mockapi)
 *   LOGIN(token) → REG {trnm:"REG", data:[{item:["005930"], type:["0B"]}]}
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const token = await getKiwoomToken();
    const base = process.env.KIWOOM_BASE || "https://api.kiwoom.com";
    const apiId = String(req.query.tr || "ka10030"); // 기본: 당일거래량상위

    const r = await fetch(`${base}/api/dostk/rkinfo`, {
      method: "POST",
      headers: {
        "content-type": "application/json;charset=UTF-8",
        authorization: `Bearer ${token}`,
        "api-id": apiId,
      },
      // ※ 바디 필드는 선택한 TR 문서에 맞춰 조정하세요(가이드의 Request 표 참고).
      body: JSON.stringify({
        mrkt_tp: "000",        // 시장구분 000:전체 001:코스피 101:코스닥
        sort_tp: "1",          // 정렬구분
        mang_stk_incls: "0",   // 관리종목 포함 여부
        crd_tp: "0",
        trde_qty_tp: "0",
        pric_tp: "0",
        trde_prica_tp: "0",
        mrkt_open_tp: "0",
        stex_tp: "3",          // 거래소구분 3:통합(KRX+NXT)
      }),
    });
    const j = await r.json();
    res.status(200).json(j);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
