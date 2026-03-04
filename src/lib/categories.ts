export type Category =
  | "IT"
  | "금융"
  | "헬스케어"
  | "산업재"
  | "경기소비재"
  | "필수소비재"
  | "소재"
  | "커뮤니케이션"
  | "에너지"
  | "유틸리티"
  | "부동산"
  | "기타";

export const CATEGORIES: Category[] = [
  "IT",
  "금융",
  "헬스케어",
  "산업재",
  "경기소비재",
  "필수소비재",
  "소재",
  "커뮤니케이션",
  "에너지",
  "유틸리티",
  "부동산",
  "기타",
];

export const CATEGORY_WEIGHT: Record<Category, number> = {
  IT: 600,
  금융: 300,
  헬스케어: 200,
  산업재: 250,
  경기소비재: 280,
  필수소비재: 120,
  소재: 200,
  커뮤니케이션: 150,
  에너지: 80,
  유틸리티: 60,
  부동산: 40,
  기타: 50,
};

export function getCategory(name: string): Category {
  if (
    /반도체|소프트웨어|IT서비스|전자장비|컴퓨터|디스플레이|핸드셋|전자제품|전기제품|사무용전자|통신장비/.test(
      name
    )
  )
    return "IT";
  if (/은행|증권|보험|기타금융|창업투자|카드/.test(name)) return "금융";
  if (/제약|생물공학|생명과학|건강관리/.test(name)) return "헬스케어";
  if (
    /기계|조선|건설|전기장비|항공|해운|도로|운송|우주항공|상업서비스/.test(name)
  )
    return "산업재";
  if (/통신서비스|무선통신|다각화된통신|방송|엔터|게임|광고|출판|양방향/.test(name))
    return "커뮤니케이션";
  if (
    /자동차|호텔|레스토랑|레저|인터넷과카탈|백화점|전문소매|판매|무역|다각화된소비|교육|섬유|의류|화장품|가구/.test(
      name
    )
  )
    return "경기소비재";
  if (/식품|음료|담배|가정용/.test(name)) return "필수소비재";
  if (/화학|철강|비철금속|종이|목재|포장재|건축자재|건축제품/.test(name))
    return "소재";
  if (/석유|에너지/.test(name)) return "에너지";
  if (/유틸리티|전기유틸/.test(name)) return "유틸리티";
  if (/부동산/.test(name)) return "부동산";
  return "기타";
}
