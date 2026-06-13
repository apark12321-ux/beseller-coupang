import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * 실시간 종목 분석 — Gemini + Google Search Grounding.
 * 매수/매도·목표가 지시는 하지 않음. 최신 뉴스·수급·변동성 '관찰'과 '주의 요인' 중심.
 * env: GEMINI_API_KEY (없으면 미연동 안내 반환)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const keyword = (req.body?.keyword || "").toString().trim();
  if (!keyword) { res.status(400).json({ error: "종목명 또는 코드를 입력해주세요." }); return; }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(200).json({ success: true, source: "none",
      analysis: `AI 분석이 아직 연동되지 않았습니다(GEMINI_API_KEY 미설정).\n연동되면 '${keyword}'의 최신 뉴스·전일 수급·거래량·변동성을 실시간 검색해 관찰 포인트와 주의 요인을 정리해 드립니다.` });
    return;
  }

  const prompt = `당신은 KOSPI/KOSDAQ 시장을 관찰하는 애널리스트입니다. 종목 "${keyword}"에 대해 최신 뉴스, 전일 수급, 거래량 흐름, 변동성을 실시간 검색해 객관적으로 정리하세요.
규칙:
- 매수/매도 권유, 목표가·진입가·손절가 제시는 하지 마세요.
- '관찰 포인트'(무엇이 움직였나)와 '주의 요인'(리스크)을 중심으로 분석하세요.
- 단기 변동성은 '관찰' 관점에서만 언급하고, 확정적 판단은 피하세요.
- 읽기 쉬운 한국어 단락과 불릿으로 작성하세요.`;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: key });
    let response: any;
    try {
      response = await ai.models.generateContent({ model: "gemini-3.5-flash", contents: prompt, config: { tools: [{ googleSearch: {} }] } });
    } catch {
      response = await ai.models.generateContent({ model: "gemini-3.5-flash", contents: prompt });
    }
    res.status(200).json({ success: true, source: "gemini", analysis: response.text });
  } catch (e: any) {
    res.status(200).json({ success: false, error: "분석 서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요." });
  }
}
