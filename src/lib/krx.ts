import iconv from "iconv-lite";

// ===== 네이버 금융 기반 섹터/업종 데이터 =====

const NAVER_SECTOR_URL =
  "https://finance.naver.com/sise/sise_group.naver?type=upjong";
const NAVER_FCHART_URL = "https://fchart.stock.naver.com/sise.nhn";

const KRX_API_URL = "https://data-dbg.krx.co.kr/svc/apis";
const KRX_AUTH_KEY = "D65BFADBAD814686960A883714A55CF54799BAE5";

export interface SectorData {
  code: string;
  name: string;
  changeRate: number; // 등락률 (%)
}

// 트리맵용 종목 데이터 (marketValue API에서 가져옴)
export interface TopStock {
  code: string;
  name: string;
  changeRate: number;
  marketCap: number; // 억원
  sectorCode?: string;
  sectorName?: string;
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

// 종목코드 → 섹터코드 매핑 (79개 섹터 상세 페이지에서 추출)
let stockSectorCache: { map: Map<string, string>; ts: number } | null = null;
const SECTOR_MAP_TTL = 6 * 60 * 60 * 1000; // 6시간 (섹터 매핑은 자주 바뀌지 않음)

export async function fetchStockSectorMap(
  sectorCodes: string[]
): Promise<Map<string, string>> {
  // 캐시 확인
  if (stockSectorCache && Date.now() - stockSectorCache.ts < SECTOR_MAP_TTL) {
    return stockSectorCache.map;
  }

  const map = new Map<string, string>();

  // 배치 20개씩 병렬 호출
  for (let i = 0; i < sectorCodes.length; i += 20) {
    const batch = sectorCodes.slice(i, i + 20);
    const results = await Promise.allSettled(
      batch.map(async (code) => {
        const url = `https://finance.naver.com/sise/sise_group_detail.naver?type=upjong&no=${code}`;
        const res = await fetchWithTimeout(url, 4000);
        const buffer = Buffer.from(await res.arrayBuffer());
        const html = iconv.decode(buffer, "EUC-KR");
        const codeRegex = /item\/main\.naver\?code=(\d{6})/g;
        let m;
        while ((m = codeRegex.exec(html)) !== null) {
          if (!map.has(m[1])) map.set(m[1], code);
        }
      })
    );
  }

  stockSectorCache = { map, ts: Date.now() };
  return map;
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

// KRX 전종목 데이터 캐시 (fetchTopStocks + fetchSectorDetail에서 공유)
interface KrxStockItem {
  code: string;
  name: string;
  price: number;
  changeRate: number;
  marketCap: number; // 억원
}

let krxStockCache: { data: KrxStockItem[]; ts: number } | null = null;
const KRX_STOCK_TTL = 60 * 60 * 1000; // 1시간

async function fetchKrxAllStocks(): Promise<KrxStockItem[]> {
  if (krxStockCache && Date.now() - krxStockCache.ts < KRX_STOCK_TTL) {
    return krxStockCache.data;
  }

  const today = new Date();
  const dates = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
    );
  }

  for (const basDd of dates) {
    const res = await fetch(
      `${KRX_API_URL}/sto/stk_bydd_trd?basDd=${basDd}`,
      { headers: { AUTH_KEY: KRX_AUTH_KEY } }
    );
    if (!res.ok) continue;

    const json = await res.json();
    const items = json.OutBlock_1;
    if (!items || items.length === 0) continue;

    const stocks: KrxStockItem[] = items
      .filter((s: Record<string, string>) => s.TDD_CLSPRC && s.MKTCAP)
      .map((s: Record<string, string>) => ({
        code: s.ISU_CD,
        name: s.ISU_NM,
        price: parseInt(s.TDD_CLSPRC.replace(/,/g, "")) || 0,
        changeRate: parseFloat(s.FLUC_RT) || 0,
        marketCap: Math.round(parseInt(s.MKTCAP || "0") / 100000000),
      }));

    krxStockCache = { data: stocks, ts: Date.now() };
    return stocks;
  }

  return [];
}

// 종목코드로 KRX 데이터 조회 (sector detail에서 사용)
export async function getKrxStockMap(): Promise<Map<string, KrxStockItem>> {
  const stocks = await fetchKrxAllStocks();
  const map = new Map<string, KrxStockItem>();
  for (const s of stocks) map.set(s.code, s);
  return map;
}

// 시총 상위 종목 가져오기
export async function fetchTopStocks(): Promise<TopStock[]> {
  // 네이버 API 우선 (실시간 데이터)
  try {
    const [kospiRes, kosdaqRes] = await Promise.all([
      fetch(
        "https://m.stock.naver.com/api/stocks/marketValue/KOSPI?page=1&pageSize=80",
        { headers: { "User-Agent": UA } }
      ),
      fetch(
        "https://m.stock.naver.com/api/stocks/marketValue/KOSDAQ?page=1&pageSize=40",
        { headers: { "User-Agent": UA } }
      ),
    ]);

    const kospiData = await kospiRes.json();
    const kosdaqData = await kosdaqRes.json();

    const parse = (stocks: Record<string, string>[]): TopStock[] =>
      (stocks || []).map((s) => ({
        code: s.itemCode,
        name: s.stockName,
        changeRate: parseFloat(s.fluctuationsRatio) || 0,
        marketCap: parseInt((s.marketValue || "0").replace(/,/g, "")) || 0,
      }));

    const result = [...parse(kospiData.stocks), ...parse(kosdaqData.stocks)];
    if (result.length > 0) return result;
  } catch {
    // 네이버 실패 시 KRX 폴백
  }

  // 폴백: KRX API (전일 종가 기준)
  try {
    const stocks = await fetchKrxAllStocks();
    if (stocks.length > 0) {
      return stocks
        .map((s) => ({
          code: s.code,
          name: s.name,
          changeRate: s.changeRate,
          marketCap: s.marketCap,
        }))
        .sort((a, b) => b.marketCap - a.marketCap);
    }
  } catch {
    // KRX도 실패
  }

  return [];
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

// ---- 종목별 가격 히스토리 (기간별 수익률 계산용) ----

let priceHistoryCache: { data: Map<string, IndexPrice[]>; ts: number } | null =
  null;
const PRICE_HISTORY_TTL = 3 * 60 * 60 * 1000; // 3시간

export async function fetchStockPriceHistories(
  codes: string[]
): Promise<Map<string, IndexPrice[]>> {
  if (priceHistoryCache && Date.now() - priceHistoryCache.ts < PRICE_HISTORY_TTL) {
    return priceHistoryCache.data;
  }

  const map = new Map<string, IndexPrice[]>();

  for (let i = 0; i < codes.length; i += 20) {
    const batch = codes.slice(i, i + 20);
    await Promise.allSettled(
      batch.map(async (code) => {
        try {
          const prices = await fetchIndexHistory(code, 260);
          if (prices.length > 0) map.set(code, prices);
        } catch {
          // skip failed
        }
      })
    );
  }

  priceHistoryCache = { data: map, ts: Date.now() };
  return map;
}

// ---- Sector Detail Types ----

export interface StockInSector {
  code: string;
  name: string;
  price: number;
  changeRate: number;
  marketCap: number; // 시가총액 (억원)
  per: number | null; // PER (배)
  pbr: number | null; // PBR (배)
  eps: number | null; // EPS (원)
  bps: number | null; // BPS (원)
  dividendYield: number | null; // 배당수익률 (%)
  high52w: number | null; // 52주 최고
  low52w: number | null; // 52주 최저
  foreignRate: number | null; // 외인소진율 (%)
}

export interface InvestorTrading {
  foreignNet: number; // 외국인 순매수 (억원)
  institutionNet: number; // 기관 순매수 (억원)
  individualNet: number; // 개인 순매수 (억원)
}

export interface SectorValuation {
  avgPer: number | null;
  avgPbr: number | null;
  avgDividendYield: number | null;
}

export interface SectorDetailResult {
  sectorCode: string;
  sectorName: string;
  topByMarketCap: StockInSector[];
  topByVolatility: StockInSector[];
  investor: InvestorTrading;
  valuation: SectorValuation;
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

// "26.23배", "0.97%", "6,564원" 등에서 숫자 추출
function parseValNum(s: string | undefined): number | null {
  if (!s) return null;
  const num = parseFloat(s.replace(/[,+]/g, ""));
  return isNaN(num) ? null : num;
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

// integration 엔드포인트에서 종목 전체 정보 가져오기
export interface StockFullData extends StockInSector {
  foreignNetOk: number;
  institutionNetOk: number;
  individualNetOk: number;
}

export async function fetchStockFullData(
  stockCode: string
): Promise<StockFullData | null> {
  try {
    // integration (밸류에이션) + basic (실시간 가격) 병렬 호출
    const [intRes, basicRes] = await Promise.all([
      fetch(
        `https://m.stock.naver.com/api/stock/${stockCode}/integration`,
        { headers: { "User-Agent": UA } }
      ),
      fetch(
        `https://m.stock.naver.com/api/stock/${stockCode}/basic`,
        { headers: { "User-Agent": UA } }
      ),
    ]);
    if (!intRes.ok) return null;
    const data = await intRes.json();
    const basicData = basicRes.ok ? await basicRes.json() : null;

    const name = basicData?.stockName || data.stockName || "";

    // totalInfos에서 시가총액, 전일가, 밸류에이션 추출
    let marketCap = 0;
    let lastClosePrice = 0;
    let per: number | null = null;
    let pbr: number | null = null;
    let eps: number | null = null;
    let bps: number | null = null;
    let dividendYield: number | null = null;
    let high52w: number | null = null;
    let low52w: number | null = null;
    let foreignRate: number | null = null;

    const infos = data.totalInfos || [];
    for (const info of infos) {
      const val = info.value || "";
      switch (info.code) {
        case "marketValue": marketCap = parseMarketCapStr(val); break;
        case "lastClosePrice": lastClosePrice = parseNum(val); break;
        case "per": per = parseValNum(val); break;
        case "pbr": pbr = parseValNum(val); break;
        case "eps": eps = parseValNum(val); break;
        case "bps": bps = parseValNum(val); break;
        case "dividendYieldRatio": dividendYield = parseValNum(val); break;
        case "highPriceOf52Weeks": high52w = parseNum(val) || null; break;
        case "lowPriceOf52Weeks": low52w = parseNum(val) || null; break;
        case "foreignRate": foreignRate = parseValNum(val); break;
      }
    }

    // basic API에서 실시간 가격/등락률 (장중에도 정확)
    let price = lastClosePrice;
    let changeRate = 0;
    if (basicData) {
      const bp = parseNum(basicData.closePrice || "0");
      if (bp > 0) price = bp;
      const fr = parseFloat(basicData.fluctuationsRatio || "0");
      if (!isNaN(fr)) changeRate = fr;
    }

    // basic이 없으면 dealTrendInfos에서 폴백
    let foreignNetOk = 0;
    let institutionNetOk = 0;
    let individualNetOk = 0;

    const trends = data.dealTrendInfos || [];
    if (trends.length > 0) {
      const latest = trends[0];
      // basic 가격이 없을 때만 dealTrendInfos 가격 사용
      if (!basicData) {
        const cp = parseNum(latest.closePrice || "0");
        if (cp > 0) price = cp;
      }

      const foreignShares = parseNum(latest.foreignerPureBuyQuant || "0");
      const institutionShares = parseNum(latest.organPureBuyQuant || "0");
      const individualShares = parseNum(latest.individualPureBuyQuant || "0");

      const toOk = (shares: number) =>
        Math.round((shares * price) / 100000000);
      foreignNetOk = toOk(foreignShares);
      institutionNetOk = toOk(institutionShares);
      individualNetOk = toOk(individualShares);
    }

    // basic이 없을 때만 수동 등락률 계산
    if (!basicData && lastClosePrice > 0 && price > 0) {
      changeRate =
        ((price - lastClosePrice) / lastClosePrice) * 100;
    }

    return {
      code: stockCode,
      name,
      price,
      changeRate: Math.round(changeRate * 100) / 100,
      marketCap,
      per,
      pbr,
      eps,
      bps,
      dividendYield,
      high52w,
      low52w,
      foreignRate,
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

  // 2. KRX 전종목 데이터에서 가격/등락률/시총 가져오기
  const krxMap = await getKrxStockMap();

  // 3. 네이버 integration에서 밸류에이션 + 투자자 데이터 (KRX에 없는 것들)
  const allStocks: StockFullData[] = [];
  for (let i = 0; i < stockCodes.length; i += 30) {
    const batch = stockCodes.slice(i, i + 30);
    const results = await Promise.all(batch.map((c) => fetchStockFullData(c)));
    for (const s of results) {
      if (s === null) continue;
      // KRX 데이터는 시총 보정에만 사용 (가격/등락률은 네이버 실시간 유지)
      const krx = krxMap.get(s.code);
      if (krx && s.marketCap === 0) {
        s.marketCap = krx.marketCap;
      }
      if (s.price > 0) allStocks.push(s);
    }
  }

  // 4. 시총 순 전체 종목
  const strip = ({ foreignNetOk, institutionNetOk, individualNetOk, ...rest }: StockFullData): StockInSector => rest;
  const topByMarketCap = [...allStocks]
    .sort((a, b) => b.marketCap - a.marketCap)
    .map(strip);

  // 5. 등락률 변동 상위 (절대값)
  const topByVolatility = [...allStocks]
    .sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate))
    .slice(0, 10)
    .map(strip);

  // 6. 투자자별 매매동향 (시총 상위 종목 합산)
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

  // 7. 섹터 평균 밸류에이션 (유효한 값만)
  const pers = allStocks.filter((s) => s.per !== null && s.per > 0).map((s) => s.per!);
  const pbrs = allStocks.filter((s) => s.pbr !== null && s.pbr > 0).map((s) => s.pbr!);
  const divs = allStocks.filter((s) => s.dividendYield !== null && s.dividendYield > 0).map((s) => s.dividendYield!);

  const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : null;

  return {
    sectorCode,
    sectorName,
    topByMarketCap,
    topByVolatility,
    investor: { foreignNet, institutionNet, individualNet },
    valuation: {
      avgPer: avg(pers),
      avgPbr: avg(pbrs),
      avgDividendYield: avg(divs),
    },
  };
}

// ---- 투자자별 순매수 TOP 섹터 ----

export interface SectorInvestorData {
  sectorCode: string;
  sectorName: string;
  foreignNet: number; // 억원
  institutionNet: number;
  individualNet: number;
  stockCount: number; // 집계에 사용된 종목 수
}

// 트리맵용 종목 데이터
export interface TreemapStock {
  code: string;
  name: string;
  sectorCode: string;
  sectorName: string;
  price: number;
  changeRate: number;
  marketCap: number; // 억원
}

export interface InvestorTrendsResult {
  sectors: SectorInvestorData[];
  treemapStocks: TreemapStock[];
  lastUpdated: string;
}

// 타임아웃 fetch 헬퍼
async function fetchWithTimeout(url: string, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// 인메모리 캐시 (Vercel 서버리스 웜 인스턴스용)
let investorCache: { data: InvestorTrendsResult; ts: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1시간

// 시총 상위 종목을 가져와서 섹터별 투자자 순매수 집계
export async function fetchInvestorBySector(): Promise<InvestorTrendsResult> {
  // 캐시 확인
  if (investorCache && Date.now() - investorCache.ts < CACHE_TTL) {
    return investorCache.data;
  }

  // 1. KOSPI 상위 80 + KOSDAQ 상위 40 종목 (120개 유지, 데이터 품질 보존)
  const [kospiRes, kosdaqRes] = await Promise.all([
    fetchWithTimeout(
      "https://m.stock.naver.com/api/stocks/marketValue/KOSPI?page=1&pageSize=80",
      8000
    ),
    fetchWithTimeout(
      "https://m.stock.naver.com/api/stocks/marketValue/KOSDAQ?page=1&pageSize=40",
      8000
    ),
  ]);

  const kospiData = await kospiRes.json();
  const kosdaqData = await kosdaqRes.json();
  const allCodes: string[] = [
    ...(kospiData.stocks || []).map(
      (s: { itemCode: string }) => s.itemCode
    ),
    ...(kosdaqData.stocks || []).map(
      (s: { itemCode: string }) => s.itemCode
    ),
  ];

  // 2. 배치 40개씩 병렬 호출 (한번에 120개는 Vercel에서 터짐)
  interface StockInvestor {
    code: string;
    name: string;
    industryCode: number;
    price: number;
    lastClosePrice: number;
    marketCap: number;
    foreignShares: number;
    institutionShares: number;
    individualShares: number;
  }

  const fetchOne = async (code: string): Promise<StockInvestor | null> => {
    try {
      const res = await fetchWithTimeout(
        `https://m.stock.naver.com/api/stock/${code}/integration`,
        5000
      );
      if (!res.ok) return null;
      const data = await res.json();
      const industryCode = data.industryCode;
      if (!industryCode) return null;
      const name = data.stockName || code;

      let price = 0;
      let lastClosePrice = 0;
      let marketCap = 0;
      for (const info of data.totalInfos || []) {
        if (info.code === "lastClosePrice") {
          lastClosePrice = parseNum(info.value || "0");
          price = lastClosePrice;
        } else if (info.code === "marketValue") {
          marketCap = parseMarketCapStr(info.value || "");
        }
      }
      const trends = data.dealTrendInfos || [];
      if (trends.length > 0) {
        const cp = parseNum(trends[0].closePrice || "0");
        if (cp > 0) price = cp;
      }
      if (price <= 0) return null;

      const t = trends[0] || {};
      return {
        code, name, industryCode, price, lastClosePrice, marketCap,
        foreignShares: parseNum(t.foreignerPureBuyQuant || "0"),
        institutionShares: parseNum(t.organPureBuyQuant || "0"),
        individualShares: parseNum(t.individualPureBuyQuant || "0"),
      };
    } catch {
      return null;
    }
  };

  const stockResults: StockInvestor[] = [];
  for (let i = 0; i < allCodes.length; i += 20) {
    const batch = allCodes.slice(i, i + 20);
    const batchResults = await Promise.all(batch.map(fetchOne));
    for (const r of batchResults) {
      if (r) stockResults.push(r);
    }
  }

  // 3. 섹터별 집계 (억원 변환)
  const sectorMap = new Map<
    number,
    { foreignNet: number; institutionNet: number; individualNet: number; count: number }
  >();
  for (const s of stockResults) {
    const toOk = (shares: number) =>
      Math.round((shares * s.price) / 100000000);
    const existing = sectorMap.get(s.industryCode) || {
      foreignNet: 0, institutionNet: 0, individualNet: 0, count: 0,
    };
    existing.foreignNet += toOk(s.foreignShares);
    existing.institutionNet += toOk(s.institutionShares);
    existing.individualNet += toOk(s.individualShares);
    existing.count += 1;
    sectorMap.set(s.industryCode, existing);
  }

  // 4. 섹터 이름 매핑 (기존 섹터 목록 활용)
  const sectorList = await fetchSectorData();
  const nameMap = new Map(sectorList.map((s) => [s.code, s.name]));

  const sectors: SectorInvestorData[] = [];
  for (const [code, data] of sectorMap.entries()) {
    sectors.push({
      sectorCode: String(code),
      sectorName: nameMap.get(String(code)) || `업종 ${code}`,
      foreignNet: data.foreignNet,
      institutionNet: data.institutionNet,
      individualNet: data.individualNet,
      stockCount: data.count,
    });
  }

  // 5. 트리맵용 종목 데이터 구성
  const treemapStocks: TreemapStock[] = stockResults.map((s) => {
    const changeRate =
      s.lastClosePrice > 0
        ? Math.round(((s.price - s.lastClosePrice) / s.lastClosePrice) * 10000) / 100
        : 0;
    return {
      code: s.code, name: s.name,
      sectorCode: String(s.industryCode),
      sectorName: nameMap.get(String(s.industryCode)) || `업종 ${s.industryCode}`,
      price: s.price, changeRate, marketCap: s.marketCap,
    };
  });

  const result = { sectors, treemapStocks, lastUpdated: new Date().toISOString() };
  investorCache = { data: result, ts: Date.now() };
  return result;
}

// 주요 지수들의 최신 시세 가져오기 (병렬 조회)
export async function fetchMajorIndices(): Promise<
  { info: IndexInfo; latest: IndexPrice; prev: IndexPrice | null; weekAgo: IndexPrice | null; monthAgo: IndexPrice | null }[]
> {
  type IndexResult = { info: IndexInfo; latest: IndexPrice; prev: IndexPrice | null; weekAgo: IndexPrice | null; monthAgo: IndexPrice | null };

  const settled = await Promise.allSettled(
    MAJOR_INDICES.map(async (info): Promise<IndexResult | null> => {
      const history = await fetchIndexHistory(info.code, 25);
      if (history.length === 0) return null;
      const latest = history[history.length - 1];
      const prev = history.length > 1 ? history[history.length - 2] : null;
      const weekAgo = history.length > 5 ? history[history.length - 6] : null;
      const monthAgo = history.length > 20 ? history[history.length - 21] : null;
      return { info, latest, prev, weekAgo, monthAgo };
    })
  );

  const results: IndexResult[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) results.push(r.value);
  }
  return results;
}

// ===== KRX 공식 API: VKOSPI (변동성지수) =====

export interface VkospiData {
  value: number; // VKOSPI 현재값
  change: number; // 전일대비 변동
  changeRate: number; // 전일대비 변동률 (%)
}

export async function fetchVkospi(): Promise<VkospiData | null> {
  try {
    const today = new Date();
    const dates = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(
        `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
      );
    }

    for (const basDd of dates) {
      const res = await fetch(
        `${KRX_API_URL}/idx/drvprod_dd_trd?basDd=${basDd}`,
        { headers: { AUTH_KEY: KRX_AUTH_KEY } }
      );
      if (!res.ok) continue;

      const json = await res.json();
      const items = json.OutBlock_1;
      if (!items || items.length === 0) continue;

      const vkospi = items.find(
        (x: Record<string, string>) =>
          x.IDX_NM === "코스피 200 변동성지수"
      );
      if (!vkospi || !vkospi.CLSPRC_IDX) continue;

      return {
        value: parseFloat(vkospi.CLSPRC_IDX),
        change: parseFloat(vkospi.CMPPREVDD_IDX || "0"),
        changeRate: parseFloat(vkospi.FLUC_RT || "0"),
      };
    }
    return null;
  } catch {
    return null;
  }
}
