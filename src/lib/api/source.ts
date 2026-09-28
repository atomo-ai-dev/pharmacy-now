import type { LatLon } from "../geo/distance";
import type { Region } from "../regions";
import type { RawItem } from "./xml";

/**
 * 국립중앙의료원 오픈API 가 주는 원자료. 실서비스(DataGoKrClient)와 데모·테스트용
 * (FixtureSource)이 같은 인터페이스를 구현하므로, 정규화·판정 로직은 둘을 구분하지 않는다.
 */
export interface MedicalDataSource {
  /** 약국 목록정보 조회 (getParmacyListInfoInqire) — 요일별 운영시간 포함 */
  pharmaciesByRegion(region: Region): Promise<RawItem[]>;
  /** 약국 위치정보 조회 (getParmacyLcinfoInqire) — 가까운 순, 오늘 운영시간만 */
  pharmaciesNear(point: LatLon): Promise<RawItem[]>;
  /** 응급의료기관 목록정보 조회 (getEgytListInfoInqire) */
  emergencyRoomsByRegion(region: Region): Promise<RawItem[]>;
  /** 응급의료기관 위치정보 조회 (getEgytLcinfoInqire) */
  emergencyRoomsNear(point: LatLon): Promise<RawItem[]>;
  /** 응급실 실시간 가용병상정보 조회 (getEmrrmRltmUsefulSckbdInfoInqire) */
  emergencyBeds(region: Region): Promise<RawItem[]>;
}
