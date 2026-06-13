import { Briefing } from "./types";
export const EMPTY: Briefing = {
  date: new Date().toISOString(), temp: 50, tldr: "", points: [],
  usIndices: [], krIndices: [], futures: [], strategy: { up: "", dn: "", ob: "" },
  news: [], holdingsImpact: [], watchNews: [],
  flow: [], sectors: [], flowNote: "", stocks: [],
};
