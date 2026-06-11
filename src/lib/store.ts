import fs from "fs";
import path from "path";
import { DB } from "./types";

// 저장소 어댑터.
// - Vercel 등 서버리스: Upstash Redis REST (파일쓰기 불가 환경)
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN 있으면 자동 사용.
// - 로컬: data/db.json 파일.

const KEY = "beseller:db";
const DB_PATH = path.join(process.cwd(), "data", "db.json");

export const EMPTY: DB = {
  uploads: [],
  products: [],
  system: { cooldownUntil: null, lastGetTestOk: false, lastGetTestAt: null },
};

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

export function usingRedis(): boolean {
  return !!(REDIS_URL && REDIS_TOKEN);
}

function normalize(parsed: Partial<DB> | null): DB {
  if (!parsed) return structuredClone(EMPTY);
  return {
    uploads: parsed.uploads ?? [],
    products: parsed.products ?? [],
    system: parsed.system ?? structuredClone(EMPTY.system),
  };
}

// ── Upstash REST (command 형식: POST [url] body ["GET", key]) ────────────────
async function redisCmd(cmd: unknown[]): Promise<any> {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return res.json(); // { result: ... }
}

// ── 파일 ─────────────────────────────────────────────────────────────────────
function ensureFile() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify(EMPTY, null, 2), "utf-8");
}

// ── 공개 API ─────────────────────────────────────────────────────────────────
export async function loadDB(): Promise<DB> {
  if (usingRedis()) {
    try {
      const { result } = await redisCmd(["GET", KEY]);
      return normalize(result ? (JSON.parse(result) as Partial<DB>) : null);
    } catch {
      return structuredClone(EMPTY);
    }
  }
  ensureFile();
  try {
    return normalize(JSON.parse(fs.readFileSync(DB_PATH, "utf-8")));
  } catch {
    return structuredClone(EMPTY);
  }
}

export async function saveDB(db: DB): Promise<void> {
  if (usingRedis()) {
    await redisCmd(["SET", KEY, JSON.stringify(db)]);
    return;
  }
  ensureFile();
  const tmp = DB_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf-8");
  fs.renameSync(tmp, DB_PATH);
}
