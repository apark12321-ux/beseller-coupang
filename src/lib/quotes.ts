export const QUOTES = [
  { k: "남들이 탐욕스러울 때 두려워하고, 남들이 두려워할 때 탐욕스러워라.", e: "Be fearful when others are greedy, and greedy when others are fearful.", b: "워런 버핏 · Warren Buffett" },
  { k: "주식시장은 조급한 사람의 돈을 인내심 있는 사람에게 옮기는 장치다.", e: "The stock market is a device for transferring money from the impatient to the patient.", b: "워런 버핏 · Warren Buffett" },
  { k: "무엇을 보유하는지, 왜 보유하는지를 알라.", e: "Know what you own, and know why you own it.", b: "피터 린치 · Peter Lynch" },
  { k: "투자자의 가장 큰 문제이자 최악의 적은 바로 자기 자신이다.", e: "The investor’s chief problem — and his worst enemy — is likely to be himself.", b: "벤저민 그레이엄 · Benjamin Graham" },
  { k: "가격은 당신이 지불하는 것이고, 가치는 당신이 얻는 것이다.", e: "Price is what you pay. Value is what you get.", b: "워런 버핏 · Warren Buffett" },
];
export function quoteOfToday() {
  const d = new Date();
  const doy = Math.floor((+d - +new Date(d.getFullYear(), 0, 0)) / 864e5);
  return QUOTES[doy % QUOTES.length];
}
