import iconv from "iconv-lite";

// ===== 네이버 금융 기반 섹터/업종 데이터 =====

const NAVER_SECTOR_URL =
  "https://finance.naver.com/sise/sise_group.naver?type=upjong";
const NAVER_FCHART_URL = "https://fchart.stock.naver.com/sise.nhn";

export interface SectorData {
  code: string;
  name: string;
  changeRate: number; // 등락률 (%)
}

export interface IndexPrice {
  date: string; // YYYYMMDD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndexInfo {
  code: string;
  name: string;
  market: string; // KOSPI, KOSDAQ, KRX
}

// 주요 시장 지수 코드
export const MAJOR_INDICES: IndexInfo[] = [
  { code: "KOSPI", name: "코스피", market: "KOSPI" },
  { code: "KOSDAQ", name: "코스닥", market: "KOSDAQ" },
  { code: "KPI200", name: "코스피200", market: "KOSPI" },
  { code: "KPI100", name: "코스피100", market: "KOSPI" },
  { code: "KPI50", name: "코스피50", market: "KOSPI" },
  { code: "KRX100", name: "KRX100", market: "KRX" },
  { code: "KVALUE", name: "코리아밸류업", market: "KRX" },
];

// 네이버 금융에서 업종별 등락률 가져오기
export async function fetchSectorData(): Promise<SectorData[]> {
  const res = await fetch(NAVER_SECTOR_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  const buffer = Buffer.from(await res.arrayBuffer());
  const html = iconv.decode(buffer, "EUC-KR");

  const sectors: SectorData[] = [];
  const sections = html.split("no=");

  for (let i = 1; i < sections.length; i++) {
    const sec = sections[i];
    const nameMatch = sec.match(/(\d+)[^>]*>\s*([^<]+?)\s*<\/a>/);
    const rateMatch = sec.match(/([-+]?\d+\.\d+)%/);

    if (nameMatch && rateMatch) {
      sectors.push({
        code: nameMatch[1],
        name: nameMatch[2].trim(),
        changeRate: parseFloat(rateMatch[1]),
      });
    }
  }

  return sectors;
}

// 네이버 fchart API에서 지수 과거 데이터 가져오기
export async function fetchIndexHistory(
  symbol: string,
  count: number = 30
): Promise<IndexPrice[]> {
  const url = `${NAVER_FCHART_URL}?symbol=${symbol}&timeframe=day&count=${count}&requestType=0`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  const text = await res.text();

  const prices: IndexPrice[] = [];
  const itemRegex = /<item data="([^"]+)" \/>/g;
  let match;

  while ((match = itemRegex.exec(text)) !== null) {
    const parts = match[1].split("|");
    if (parts.length >= 5) {
      prices.push({
        date: parts[0],
        open: parseFloat(parts[1]),
        high: parseFloat(parts[2]),
        low: parseFloat(parts[3]),
        close: parseFloat(parts[4]),
        volume: parseInt(parts[5] || "0"),
      });
    }
  }

  return prices;
}

// 주요 지수들의 최신 시세 가져오기
export async function fetchMajorIndices(): Promise<
  { info: IndexInfo; latest: IndexPrice; prev: IndexPrice | null; weekAgo: IndexPrice | null; monthAgo: IndexPrice | null }[]
> {
  const results = [];

  for (const info of MAJOR_INDICES) {
    try {
      const history = await fetchIndexHistory(info.code, 25);
      if (history.length > 0) {
        const latest = history[history.length - 1];
        const prev = history.length > 1 ? history[history.length - 2] : null;
        const weekAgo = history.length > 5 ? history[history.length - 6] : null;
        const monthAgo = history.length > 20 ? history[history.length - 21] : null;
        results.push({ info, latest, prev, weekAgo, monthAgo });
      }
    } catch {
      continue;
    }
  }

  return results;
}
