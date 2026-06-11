export const STATUS_LABEL: Record<string, string> = {
  all: "전체 상품",
  candidate: "정상 후보",
  needs_review: "검수 필요",
  excluded: "제외 상품",
  registered: "등록 완료",
  draft_saved: "쿠팡 임시저장",
  register_failed: "등록 실패",
};

export const STATUS_COLOR: Record<string, string> = {
  candidate: "bg-green-100 text-green-700",
  needs_review: "bg-amber-100 text-amber-700",
  excluded: "bg-gray-200 text-gray-600",
  registered: "bg-blue-100 text-blue-700",
  draft_saved: "bg-indigo-100 text-indigo-700",
  register_failed: "bg-red-100 text-red-700",
};

export const CAT_COLOR: Record<string, string> = {
  matched: "bg-green-100 text-green-700",
  stored_valid: "bg-emerald-100 text-emerald-700",
  needs_review: "bg-amber-100 text-amber-700",
  excluded: "bg-gray-200 text-gray-600",
  mismatch_warning: "bg-red-100 text-red-700",
};

export const won = (n: number) => (n ? n.toLocaleString("ko-KR") + "원" : "-");

export async function api<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  return res.json();
}
