/**
 * 시도·시군구 선택 목록. API 의 Q0/Q1(약국·응급의료기관 목록), STAGE1/STAGE2(실시간 병상)
 * 파라미터에 그대로 넣는 값이다.
 *
 * 기준: 2026-07-01 행정구역 (전남광주통합특별시 출범, 인천 제물포구·영종구·서해구·검단구 신설).
 * 일반구가 있는 시(수원시 등)는 시 단위로만 둔다.
 * 행정구역이 바뀌면 이 표를 갱신한다.
 */
export const REGIONS: Readonly<Record<string, readonly string[]>> = {
  서울특별시: [
    "강남구",
    "강동구",
    "강북구",
    "강서구",
    "관악구",
    "광진구",
    "구로구",
    "금천구",
    "노원구",
    "도봉구",
    "동대문구",
    "동작구",
    "마포구",
    "서대문구",
    "서초구",
    "성동구",
    "성북구",
    "송파구",
    "양천구",
    "영등포구",
    "용산구",
    "은평구",
    "종로구",
    "중구",
    "중랑구",
  ],
  부산광역시: [
    "강서구",
    "금정구",
    "기장군",
    "남구",
    "동구",
    "동래구",
    "부산진구",
    "북구",
    "사상구",
    "사하구",
    "서구",
    "수영구",
    "연제구",
    "영도구",
    "중구",
    "해운대구",
  ],
  대구광역시: ["군위군", "남구", "달서구", "달성군", "동구", "북구", "서구", "수성구", "중구"],
  인천광역시: [
    "강화군",
    "검단구",
    "계양구",
    "남동구",
    "미추홀구",
    "부평구",
    "서해구",
    "연수구",
    "영종구",
    "옹진군",
    "제물포구",
  ],
  대전광역시: ["대덕구", "동구", "서구", "유성구", "중구"],
  울산광역시: ["남구", "동구", "북구", "울주군", "중구"],
  세종특별자치시: [],
  경기도: [
    "가평군",
    "고양시",
    "과천시",
    "광명시",
    "광주시",
    "구리시",
    "군포시",
    "김포시",
    "남양주시",
    "동두천시",
    "부천시",
    "성남시",
    "수원시",
    "시흥시",
    "안산시",
    "안성시",
    "안양시",
    "양주시",
    "양평군",
    "여주시",
    "연천군",
    "오산시",
    "용인시",
    "의왕시",
    "의정부시",
    "이천시",
    "파주시",
    "평택시",
    "포천시",
    "하남시",
    "화성시",
  ],
  강원특별자치도: [
    "강릉시",
    "고성군",
    "동해시",
    "삼척시",
    "속초시",
    "양구군",
    "양양군",
    "영월군",
    "원주시",
    "인제군",
    "정선군",
    "철원군",
    "춘천시",
    "태백시",
    "평창군",
    "홍천군",
    "화천군",
    "횡성군",
  ],
  충청북도: [
    "괴산군",
    "단양군",
    "보은군",
    "영동군",
    "옥천군",
    "음성군",
    "제천시",
    "증평군",
    "진천군",
    "청주시",
    "충주시",
  ],
  충청남도: [
    "계룡시",
    "공주시",
    "금산군",
    "논산시",
    "당진시",
    "보령시",
    "부여군",
    "서산시",
    "서천군",
    "아산시",
    "예산군",
    "천안시",
    "청양군",
    "태안군",
    "홍성군",
  ],
  전북특별자치도: [
    "고창군",
    "군산시",
    "김제시",
    "남원시",
    "무주군",
    "부안군",
    "순창군",
    "완주군",
    "익산시",
    "임실군",
    "장수군",
    "전주시",
    "정읍시",
    "진안군",
  ],
  전남광주통합특별시: [
    "강진군",
    "고흥군",
    "곡성군",
    "광산구",
    "광양시",
    "구례군",
    "나주시",
    "남구",
    "담양군",
    "동구",
    "목포시",
    "무안군",
    "보성군",
    "북구",
    "서구",
    "순천시",
    "신안군",
    "여수시",
    "영광군",
    "영암군",
    "완도군",
    "장성군",
    "장흥군",
    "진도군",
    "함평군",
    "해남군",
    "화순군",
  ],
  경상북도: [
    "경산시",
    "경주시",
    "고령군",
    "구미시",
    "김천시",
    "문경시",
    "봉화군",
    "상주시",
    "성주군",
    "안동시",
    "영덕군",
    "영양군",
    "영주시",
    "영천시",
    "예천군",
    "울릉군",
    "울진군",
    "의성군",
    "청도군",
    "청송군",
    "칠곡군",
    "포항시",
  ],
  경상남도: [
    "거제시",
    "거창군",
    "고성군",
    "김해시",
    "남해군",
    "밀양시",
    "사천시",
    "산청군",
    "양산시",
    "의령군",
    "진주시",
    "창녕군",
    "창원시",
    "통영시",
    "하동군",
    "함안군",
    "함양군",
    "합천군",
  ],
  제주특별자치도: ["서귀포시", "제주시"],
};

export const SIDO_LIST: readonly string[] = Object.keys(REGIONS);

export interface Region {
  sido: string;
  /** 세종특별자치시처럼 시군구가 없으면 빈 문자열 */
  sigungu: string;
}

/**
 * 약국 데이터용 옛 지역명(2026-07-01 개편 이전)에서 새 지역명(개편 이후)으로의 매핑.
 * 약국 API 응답이 대부분 옛 이름을 쓰므로, regionFromAddress 에서 옛 이름을 새 이름으로 변환할 때 쓴다.
 */
const OLD_TO_NEW_REGIONS: Readonly<Record<string, Readonly<Record<string, string | null>>>> = {
  광주광역시: {
    "": "전남광주통합특별시",
    동구: "동구",
    남구: "남구",
    서구: "서구",
    북구: "북구",
    광산구: "광산구",
  },
  전라남도: {
    "": "전남광주통합특별시",
  },
};

/**
 * 새 지역명(개편 이후)의 새 sigungu 이름에서 옛 sigungu 이름(개편 이전)으로의 역매핑.
 * 약국 API 응답에서 "인천광역시 중구" 같이 새 sido지만 옛 sigungu인 경우를 처리한다.
 */
const NEW_SIGUNGU_TO_OLD: Readonly<Record<string, string[]>> = {
  제물포구: ["중구"],
  영종구: ["동구"],
  서해구: ["서구"],
  검단구: ["서구"],
};

export function isKnownRegion(r: Region): boolean {
  const list = REGIONS[r.sido];
  if (!list) return false;
  return list.length === 0 ? r.sigungu === "" : list.includes(r.sigungu);
}

/**
 * 주소 앞머리에서 시도·시군구를 뽑는다. "서울특별시 강남구 일원동 50" → 서울특별시/강남구.
 * 약국 위치 조회 응답 주소에는 개편 전 지역명이 섞여 있으므로, 옛 이름도 인식해서 새 이름으로 변환한다.
 * 위치 검색 결과의 주소로 해당 지역 목록을 다시 조회할 때 쓴다.
 */
export function regionFromAddress(address: string): Region | null {
  const [sido, second] = address.trim().split(/\s+/);
  if (!sido) return null;

  if (sido in REGIONS) {
    const list = REGIONS[sido] ?? [];
    if (list.length === 0) return { sido, sigungu: "" };
    if (second && list.includes(second)) return { sido, sigungu: second };

    if (second) {
      for (const [newSigungu, oldSigungus] of Object.entries(NEW_SIGUNGU_TO_OLD)) {
        if (oldSigungus.includes(second)) {
          return { sido, sigungu: newSigungu };
        }
      }
    }
    return null;
  }

  const oldToNew = OLD_TO_NEW_REGIONS[sido];
  if (!oldToNew) return null;

  if (second && oldToNew[second]) {
    const sigungu = oldToNew[second];
    if (!sigungu) return null;
    return { sido: "전남광주통합특별시", sigungu };
  }

  const newSido = oldToNew[""];
  if (!newSido) return null;

  if (second) {
    const sigungu = oldToNew[second];
    if (sigungu) return { sido: newSido, sigungu };
  }

  return { sido: newSido, sigungu: "" };
}
