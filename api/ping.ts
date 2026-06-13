import type { VercelRequest, VercelResponse } from "@vercel/node";
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, ts: Date.now(), env: { td: !!process.env.TWELVEDATA_API_KEY, kiwoom: !!process.env.KIWOOM_APP_KEY, naver: !!process.env.NAVER_CLIENT_ID } });
}
