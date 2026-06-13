export interface Idx { name: string; chg: number; note: string; spark: number[]; }
export interface Sector { name: string; chg: number; }
export interface Flow { who: string; w: number; label: string; dir: "up" | "down"; }
export interface NewsItem {
  id: string; title: string; source: string; ago: string;
  tag: "up" | "dn" | "nu"; tagText: string;
  summary: string; tickers: string[]; url: string; pro?: boolean;
}
export interface ProfileRow { price: number; vol: number; poc?: boolean; }
export interface Stock {
  rank: number; name: string; market: string; code: string;
  price: number; chg: number; turnover: string; volume: string; pos52: string;
  note: string; reason: string; spark: number[]; pro: boolean;
  profile: ProfileRow[];
  forecast: { trend: string; up: string; down: string };
}
export interface KrIndex { name: string; level: number; chg: number; state?: string; }

export interface Briefing {
  date: string;
  temp: number;
  tldr: string;
  points: string[];
  usIndices: Idx[];
  krIndices: KrIndex[];
  futures: { k: string; v: string; cls: "" | "up" | "down" }[];
  strategy: { up: string; dn: string; ob: string };
  news: NewsItem[];
  holdingsImpact: { name: string; chg: number }[];
  watchNews: NewsItem[];
  flow: Flow[];
  sectors: Sector[];
  flowNote: string;
  stocks: Stock[];
}
