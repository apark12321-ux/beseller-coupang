import fs from "fs";
import path from "path";
import { Product, Upload, SystemState, Settings, CategoryMap } from "./types";
import { DEFAULT_SETTINGS } from "./config";

// 저장소 어댑터 (상품별 키 구조).
// - Redis(Vercel): beseller:meta(업로드+시스템), beseller:index([{id,status}]), beseller:p:{id}(상품)
//   → 목록은 인덱스+페이지 MGET, 편집은 상품 1건만 SET. 대용량(수천건) 대응.
// - 로컬: data/db.json 단일 파일(동일 API로 추상화).

const PREFIX = "beseller";
const K_META = `${PREFIX}:meta`;
const K_INDEX = `${PREFIX}:index`;
const kProd = (id: string) => `${PREFIX}:p:${id}`;
const DB_PATH = path.join(process.cwd(), "data", "db.json");

export interface Meta { uploads: Upload[]; system: SystemState; settings: Settings; catmap: CategoryMap }
export interface IndexEntry { id: string; status: string; cat: string }

export const EMPTY_SYSTEM: SystemState = { cooldownUntil: null, lastGetTestOk: false, lastGetTestAt: null };

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
export function usingRedis(): boolean { return !!(REDIS_URL && REDIS_TOKEN); }
export function storageMode(): "redis" | "file" { return usingRedis() ? "redis" : "file"; }

export class StorageNotWritableError extends Error {
  code = "STORAGE_NOT_WRITABLE";
  constructor() {
    super("저장소에 쓸 수 없습니다. 서버리스(Vercel) 배포면 Upstash Redis 환경변수(UPSTASH_REDIS_REST_URL/TOKEN 또는 KV_REST_API_URL/TOKEN)를 설정하세요.");
  }
}

// ── Redis REST ───────────────────────────────────────────────────────────────
async function cmd(c: unknown[]): Promise<any> {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(c), cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return res.json();
}
async function pipeline(cmds: unknown[][]): Promise<void> {
  if (cmds.length === 0) return;
  const res = await fetch(REDIS_URL + "/pipeline", {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds), cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash pipeline ${res.status}`);
}
function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ── 파일 모드 헬퍼 ───────────────────────────────────────────────────────────
interface FileDB { uploads: Upload[]; products: Product[]; system: SystemState; settings?: Settings; catmap?: CategoryMap }
function fileRead(): FileDB {
  try {
    const j = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    return { uploads: j.uploads ?? [], products: j.products ?? [], system: j.system ?? { ...EMPTY_SYSTEM }, settings: j.settings, catmap: j.catmap };
  } catch {
    return { uploads: [], products: [], system: { ...EMPTY_SYSTEM } };
  }
}
function fileWrite(db: FileDB) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = DB_PATH + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf-8");
    fs.renameSync(tmp, DB_PATH);
  } catch (e: any) {
    if (["EROFS", "EACCES", "EPERM"].includes(e?.code)) throw new StorageNotWritableError();
    throw e;
  }
}

// ── 공개 API ─────────────────────────────────────────────────────────────────
export async function getMeta(): Promise<Meta> {
  if (usingRedis()) {
    try {
      const { result } = await cmd(["GET", K_META]);
      if (result) { const m = JSON.parse(result); return { uploads: m.uploads ?? [], system: m.system ?? { ...EMPTY_SYSTEM }, settings: { ...DEFAULT_SETTINGS, ...(m.settings ?? {}) }, catmap: m.catmap ?? {} }; }
    } catch {}
    return { uploads: [], system: { ...EMPTY_SYSTEM }, settings: { ...DEFAULT_SETTINGS }, catmap: {} };
  }
  const db = fileRead();
  return { uploads: db.uploads, system: db.system, settings: { ...DEFAULT_SETTINGS, ...(db.settings ?? {}) }, catmap: db.catmap ?? {} };
}

export async function setMeta(meta: Meta): Promise<void> {
  if (usingRedis()) { await cmd(["SET", K_META, JSON.stringify(meta)]); return; }
  const db = fileRead(); db.uploads = meta.uploads; db.system = meta.system; db.settings = meta.settings; db.catmap = meta.catmap; fileWrite(db);
}

export async function getIndex(): Promise<IndexEntry[]> {
  if (usingRedis()) {
    try { const { result } = await cmd(["GET", K_INDEX]); return result ? JSON.parse(result) : []; }
    catch { return []; }
  }
  return fileRead().products.map((p) => ({ id: p.id, status: p.status, cat: p.beSellerCode || "" }));
}

export async function getProduct(id: string): Promise<Product | null> {
  if (usingRedis()) {
    try { const { result } = await cmd(["GET", kProd(id)]); return result ? (JSON.parse(result) as Product) : null; }
    catch { return null; }
  }
  return fileRead().products.find((p) => p.id === id) ?? null;
}

// 페이지 단위 상품 조회(목록용). status='all' 또는 특정 상태.
export async function listProducts(status: string, page: number, pageSize: number): Promise<{ items: Product[]; total: number; counts: Record<string, number> }> {
  if (usingRedis()) {
    const index = await getIndex();
    const counts: Record<string, number> = { all: index.length };
    for (const e of index) counts[e.status] = (counts[e.status] ?? 0) + 1;
    const filtered = status && status !== "all" ? index.filter((e) => e.status === status) : index;
    const slice = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    let items: Product[] = [];
    if (slice.length) {
      const { result } = await cmd(["MGET", ...slice.map((e) => kProd(e.id))]);
      items = (result as (string | null)[]).map((s) => (s ? (JSON.parse(s) as Product) : null)).filter((p): p is Product => !!p);
    }
    return { items, total: filtered.length, counts };
  }
  const db = fileRead();
  const counts: Record<string, number> = { all: db.products.length };
  for (const p of db.products) counts[p.status] = (counts[p.status] ?? 0) + 1;
  const filtered = status && status !== "all" ? db.products.filter((p) => p.status === status) : db.products;
  const items = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  return { items, total: filtered.length, counts };
}

export async function saveProduct(p: Product): Promise<void> {
  if (usingRedis()) {
    await cmd(["SET", kProd(p.id), JSON.stringify(p)]);
    // 인덱스 상태 동기화
    const index = await getIndex();
    const e = index.find((x) => x.id === p.id);
    if (e) { if (e.status !== p.status) { e.status = p.status; await cmd(["SET", K_INDEX, JSON.stringify(index)]); } }
    else { index.push({ id: p.id, status: p.status, cat: p.beSellerCode || "" }); await cmd(["SET", K_INDEX, JSON.stringify(index)]); }
    return;
  }
  const db = fileRead();
  const i = db.products.findIndex((x) => x.id === p.id);
  if (i >= 0) db.products[i] = p; else db.products.push(p);
  fileWrite(db);
}

export async function addProducts(upload: Upload, products: Product[]): Promise<void> {
  if (usingRedis()) {
    // 상품 키 일괄 저장(파이프라인 청크)
    for (const part of chunk(products, 200)) {
      await pipeline(part.map((p) => ["SET", kProd(p.id), JSON.stringify(p)]));
    }
    const index = await getIndex();
    index.push(...products.map((p) => ({ id: p.id, status: p.status, cat: p.beSellerCode || "" })));
    await cmd(["SET", K_INDEX, JSON.stringify(index)]);
    const meta = await getMeta();
    meta.uploads.push(upload);
    await setMeta(meta);
    return;
  }
  const db = fileRead();
  db.uploads.push(upload);
  db.products.push(...products);
  fileWrite(db);
}

export async function clearAllProducts(): Promise<number> {
  if (usingRedis()) {
    const index = await getIndex();
    for (const part of chunk(index, 300)) {
      await pipeline(part.map((e) => ["DEL", kProd(e.id)]));
    }
    await cmd(["SET", K_INDEX, JSON.stringify([])]);
    const meta = await getMeta();
    const n = index.length;
    meta.uploads = [];
    await setMeta(meta);
    return n;
  }
  const db = fileRead();
  const n = db.products.length;
  db.products = []; db.uploads = [];
  fileWrite(db);
  return n;
}

// 배치 업로드용: 상품만 추가(업로드 메타는 호출측에서 setMeta로 처리)
export async function appendProducts(products: Product[]): Promise<void> {
  if (usingRedis()) {
    for (const part of chunk(products, 200)) {
      await pipeline(part.map((p) => ["SET", kProd(p.id), JSON.stringify(p)]));
    }
    const index = await getIndex();
    index.push(...products.map((p) => ({ id: p.id, status: p.status, cat: p.beSellerCode || "" })));
    await cmd(["SET", K_INDEX, JSON.stringify(index)]);
    return;
  }
  const db = fileRead();
  db.products.push(...products);
  fileWrite(db);
}

// 배치 저장(재계산용): 상품 키 일괄 SET + 인덱스 상태 동기화
export async function saveProductsBatch(products: Product[]): Promise<void> {
  if (products.length === 0) return;
  if (usingRedis()) {
    for (const part of chunk(products, 200)) {
      await pipeline(part.map((p) => ["SET", kProd(p.id), JSON.stringify(p)]));
    }
    const index = await getIndex();
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const e of index) { const p = byId.get(e.id); if (p) { e.status = p.status; e.cat = p.beSellerCode || ""; } }
    await cmd(["SET", K_INDEX, JSON.stringify(index)]);
    return;
  }
  const db = fileRead();
  const byId = new Map(products.map((p) => [p.id, p]));
  db.products = db.products.map((p) => byId.get(p.id) ?? p);
  fileWrite(db);
}

// 카테고리코드 집계(인덱스 기반) + 코드별 샘플 1건
export async function aggregateCategoryCodes(): Promise<Array<{ code: string; count: number }>> {
  const index = await getIndex();
  const m = new Map<string, number>();
  for (const e of index) { const c = e.cat || "(빈코드)"; m.set(c, (m.get(c) ?? 0) + 1); }
  return Array.from(m.entries()).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count);
}
