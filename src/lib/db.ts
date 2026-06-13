import { Product, Upload } from "./types";
import * as store from "./store";

// 직렬 큐(같은 인스턴스 내 쓰기 순서 보장).
let queue: Promise<void> = Promise.resolve();
function enqueue<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.then(run, run);
  queue = next.then(() => undefined, () => undefined);
  return next;
}

export const getProduct = store.getProduct;
export const listProducts = store.listProducts;
export const getMeta = store.getMeta;

// 상품 1건 변경(편집). 해당 상품 키만 갱신.
export function mutateProduct<T>(id: string, fn: (p: Product) => T): Promise<{ product: Product | null; result: T | null }> {
  return enqueue(async () => {
    const p = await store.getProduct(id);
    if (!p) return { product: null, result: null };
    const result = fn(p);
    p.updatedAt = new Date().toISOString();
    await store.saveProduct(p);
    return { product: p, result };
  });
}

// 시스템/업로드(meta) 변경.
export function mutateMeta<T>(fn: (meta: store.Meta) => T): Promise<T> {
  return enqueue(async () => {
    const meta = await store.getMeta();
    const r = fn(meta);
    await store.setMeta(meta);
    return r;
  });
}

export function addUpload(upload: Upload, products: Product[]): Promise<void> {
  return enqueue(() => store.addProducts(upload, products));
}

export function resetAll(): Promise<number> {
  return enqueue(() => store.clearAllProducts());
}

export function appendProducts(products: Product[]): Promise<void> {
  return enqueue(() => store.appendProducts(products));
}
