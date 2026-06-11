import { DB } from "./types";
import { loadDB, saveDB } from "./store";

// 저장소 추상화 위에 올린 직렬 큐.
// 로컬(파일) / Vercel(Upstash Redis) 모두 동일 인터페이스.
// 주의: 서버리스에서는 인스턴스 간 동시성까지는 보장 못함(단일 사용자 기준 last-write-wins).

export async function readDB(): Promise<DB> {
  return loadDB();
}

let queue: Promise<void> = Promise.resolve();

// 모든 변경은 mutate 를 통해 직렬화한다(같은 인스턴스 내).
export function mutate<T>(fn: (db: DB) => T): Promise<T> {
  const run = async (): Promise<T> => {
    const db = await loadDB();
    const result = fn(db);
    await saveDB(db);
    return result;
  };
  const next = queue.then(run, run);
  queue = next.then(() => undefined, () => undefined);
  return next;
}

export async function getProduct(id: string) {
  const db = await loadDB();
  return db.products.find((p) => p.id === id) ?? null;
}
