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

// ---- Sector Detail Types ----

export interface StockInSector {
  code: string;
  name: string;
  price: number;
  changeRate: number;
  marketCap: number; // 시가총액 (억원)
}

export interface InvestorTrading {
  foreignNet: number; // 외국인 순매수 (억원)
  institutionNet: number; // 기관 순매수 (억원)
  individualNet: number; // 개인 순매수 (억원)
}

export interface SectorDetailResult {
  sectorCode: string;
  sectorName: string;
  topByMarketCap: StockInSector[];
  topByVolatility: StockInSector[];
  investor: InvestorTrading;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

// 시가총액 문자열 파싱: "1,019조 3,617억" → 10193617 (억원)
function parseMarketCapStr(value: string): number {
  let total = 0;
  const joMatch = value.match(/([\d,.]+)조/);
  const ukMatch = value.match(/([\d,.]+)억/);
  if (joMatch)
    total += parseFloat(joMatch[1].replace(/,/g, "")) * 10000;
  if (ukMatch) total += parseFloat(ukMatch[1].replace(/,/g, ""));
  return Math.round(total);
}

// 콤마 제거 후 숫자 파싱
function parseNum(s: string): number {
  return parseInt(s.replace(/[,+]/g, "")) || 0;
}

// 업종 상세 페이지에서 종목 코드 추출
async function parseSectorStockCodes(sectorCode: string): Promise<{
  sectorName: string;
  stockCodes: string[];
}> {
  const url = `https://finance.naver.com/sise/sise_group_detail.naver?type=upjong&no=${sectorCode}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const buffer = Buffer.from(await res.arrayBuffer());
  const html = iconv.decode(buffer, "EUC-KR");

  // 업종명
  const nameMatch = html.match(/<title>([^:<]+)/);
  const sectorName = nameMatch ? nameMatch[1].trim() : "";

  // 종목 코드 (6자리) 추출 및 중복 제거
  const codes: string[] = [];
  const codeRegex = /item\/main\.naver\?code=(\d{6})/g;
  let m;
  while ((m = codeRegex.exec(html)) !== null) {
    if (!codes.includes(m[1])) codes.push(m[1]);
  }

  return { sectorName, stockCodes: codes };
}

// integration 엔드포인트에서 종목 전체 정보 가져오기 (시총, 가격, 등락률, 투자자)
interface StockFullData extends StockInSector {
  foreignNetOk: number;
  institutionNetOk: number;
  individualNetOk: number;
}

async function fetchStockFullData(
  stockCode: string
): Promise<StockFullData | null> {
  try {
    const res = await fetch(
      `https://m.stock.naver.com/api/stock/${stockCode}/integration`,
      { headers: { "User-Agent": UA } }
    );
    if (!res.ok) return null;
    const data = await res.json();

    const name = data.stockName || "";

    // totalInfos에서 시가총액, 전일가 추출
    let marketCap = 0;
    let lastClosePrice = 0;
    const infos = data.totalInfos || [];
    for (const info of infos) {
      if (info.code === "marketValue") {
        marketCap = parseMarketCapStr(info.value || "");
      } else if (info.code === "lastClosePrice") {
        lastClosePrice = parseNum(info.value || "0");
      }
    }

    // dealTrendInfos에서 당일 가격 및 투자자 데이터 추출
    let price = lastClosePrice;
    let foreignNetOk = 0;
    let institutionNetOk = 0;
    let individualNetOk = 0;
    let changeRate = 0;

    const trends = data.dealTrendInfos || [];
    if (trends.length > 0) {
      const latest = trends[0];
      const cp = parseNum(latest.closePrice || "0");
      if (cp > 0) price = cp;

      const foreignShares = parseNum(latest.foreignerPureBuyQuant || "0");
      const institutionShares = parseNum(latest.organPureBuyQuant || "0");
      const individualShares = parseNum(latest.individualPureBuyQuant || "0");

      const toOk = (shares: number) =>
        Math.round((shares * price) / 100000000);
      foreignNetOk = toOk(foreignShares);
      institutionNetOk = toOk(institutionShares);
      individualNetOk = toOk(individualShares);
    }

    // 등락률 계산
    if (lastClosePrice > 0 && price > 0) {
      changeRate =
        ((price - lastClosePrice) / lastClosePrice) * 100;
    }

    return {
      code: stockCode,
      name,
      price,
      changeRate: Math.round(changeRate * 100) / 100,
      marketCap,
      foreignNetOk,
      institutionNetOk,
      individualNetOk,
    };
  } catch {
    return null;
  }
}

// 섹터 상세 정보 메인 함수
export async function fetchSectorDetail(
  sectorCode: string
): Promise<SectorDetailResult> {
  // 1. 업종 내 종목 코드 가져오기
  const { sectorName, stockCodes } = await parseSectorStockCodes(sectorCode);

  // 2. 모든 종목 정보 병렬 조회 (최대 30개)
  const allStocks = (
    await Promise.all(
      stockCodes.slice(0, 30).map((c) => fetchStockFullData(c))
    )
  ).filter((s): s is StockFullData => s !== null && s.price > 0);

  // 3. 시총 상위 5
  const topByMarketCap = [...allStocks]
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 5)
    .map(({ foreignNetOk, institutionNetOk, individualNetOk, ...rest }) => rest);

  // 4. 등락률 변동 상위 5 (절대값)
  const topByVolatility = [...allStocks]
    .sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate))
    .slice(0, 5)
    .map(({ foreignNetOk, institutionNetOk, individualNetOk, ...rest }) => rest);

  // 5. 투자자별 매매동향 (시총 상위 종목 합산)
  const sortedByMcap = [...allStocks].sort(
    (a, b) => b.marketCap - a.marketCap
  );
  let foreignNet = 0;
  let institutionNet = 0;
  let individualNet = 0;

  for (const s of sortedByMcap.slice(0, 15)) {
    foreignNet += s.foreignNetOk;
    institutionNet += s.institutionNetOk;
    individualNet += s.individualNetOk;
  }

  return {
    sectorCode,
    sectorName,
    topByMarketCap,
    topByVolatility,
    investor: { foreignNet, institutionNet, individualNet },
  };
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
