/**
 * API 라우트가 돌려주고 화면이 받는 모양. 서버 전용 모듈을 끌어오지 않도록 타입만 둔다.
 */

export type OpenState = "open" | "closed" | "unknown";

export interface PharmacyView {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  lat: number | null;
  lon: number | null;
  distanceKm: number | null;
  openState: OpenState;
  /** 영업 중일 때 닫는 시각 "22:00". 영업 중인데 null 이면 24시간 영업 */
  closesAt: string | null;
  /** 오늘 운영시간 "09:00–22:00" · "휴무" · "24시간", 모르면 null */
  todayHours: string | null;
  /** 요일별 운영시간 [라벨, 시간] — 상세 보기용 */
  weeklyHours: Array<[string, string | null]> | null;
  night: boolean;
  holiday: boolean;
}

export type BedState = "available" | "full" | "over" | "unknown";

export interface BedView {
  available: number | null;
  capacity: number | null;
  state: BedState;
}

export interface EmergencyRoomView {
  id: string;
  name: string;
  address: string | null;
  /** 응급실 전화 (dutyTel3), 없으면 대표전화 */
  phone: string | null;
  category: string | null;
  lat: number | null;
  lon: number | null;
  distanceKm: number | null;
  general: BedView;
  pediatric: BedView;
  /** 병상 정보 입력 시각 (ISO 8601) */
  updatedAt: string | null;
  /** 입력 시각이 오래돼 믿기 어려운가 */
  stale: boolean;
}

export interface ListMeta {
  mode: "live" | "demo";
  generatedAt: string;
  /** 오늘이 공휴일이면 그 이름 */
  holidayName: string | null;
  /** 올해 공휴일 표가 없으면 false — 공휴일 판정이 틀릴 수 있다 */
  holidayCovered: boolean;
}

export interface PharmacyResponse extends ListMeta {
  items: PharmacyView[];
}

export interface EmergencyResponse extends ListMeta {
  items: EmergencyRoomView[];
}

export interface ErrorResponse {
  error: string;
}
