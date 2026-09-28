# 사용하는 공공데이터 API

모두 국립중앙의료원이 공공데이터포털(data.go.kr)에 제공하는 REST(XML) 오픈API다.
아래 내용은 2026-09-28 에 각 서비스의 공공데이터포털 상세 페이지와, 그 페이지에 첨부된
**OpenAPI 활용가이드(hwp)** 를 직접 확인해 정리했다. 추측으로 채운 항목은 맨 아래
「확인하지 못한 것」에 따로 적었다.

| 서비스 | 공공데이터포털 페이지 | 참고문서 |
|---|---|---|
| 국립중앙의료원\_전국 약국 정보 조회 서비스 | <https://www.data.go.kr/data/15000576/openapi.do> | `NIA-IFT-OpenAPI활용가이드-01.국립중앙의료원_전국약국정보조회서비스.hwp` (v1.0, 2016-12-09) |
| 국립중앙의료원\_전국 응급의료기관 정보 조회 서비스 | <https://www.data.go.kr/data/15000563/openapi.do> | `NIA-IFT-OpenAPI활용가이드-01.국립중앙의료원-응급의료정보조회서비스_V13.hwp` + 페이지 내장 Swagger 명세 |

공통 사항 (두 페이지 기준)

- 이용허락범위: **제한 없음**, 비용 무료, 개발·운영 단계 모두 **자동승인**
- 개발계정 트래픽: 약국 서비스 1,000건/일 (응급의료기관 페이지에는 값이 비어 있음)
- 데이터 갱신주기(가이드): 일 1회 — 단, 실시간 병상 정보는 병원이 수시로 입력한다
- 응답 형식: XML. 정상 응답은 `response/header/resultCode` 가 `00`
- 인증키 파라미터: `ServiceKey` (Swagger 명세 표기). 포털에서 발급하는 **일반 인증키(Decoding)** 를
  그대로 넣고, URL 인코딩은 코드(`URLSearchParams`)가 한 번만 한다.

---

## 1. 약국 정보 조회 서비스 — `B552657/ErmctInsttInfoInqireService`

서비스 URL: `https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService`

### 1-1. 약국 목록정보 조회 `getParmacyListInfoInqire` — 사용

시도/시군구/진료요일별 약국 목록. **요일별 운영시간**이 들어 있어 "지금 영업 중" 판정의 원자료다.

요청

| 파라미터 | 필수 | 설명 | 예 |
|---|---|---|---|
| `Q0` | 옵션 | 주소(시도) | 서울특별시 |
| `Q1` | 옵션 | 주소(시군구) | 강남구 |
| `QT` | 옵션 | 진료요일. 월~일 1~7, 공휴일 8 | 1 |
| `QN` | 옵션 | 기관명 | 삼성약국 |
| `ORD` | 옵션 | 순서 | NAME |
| `pageNo` | 옵션 | 페이지 번호 | 1 |
| `numOfRows` | 옵션 | 목록 건수 | 10 |

응답 item 에서 쓰는 필드

| 필드 | 뜻 | 비고 |
|---|---|---|
| `hpid` | 기관ID | 다른 조회와 합칠 때의 키 |
| `dutyName` | 기관명 | |
| `dutyAddr` | 주소 | |
| `dutyTel1` | 대표전화1 | |
| `dutyTime1s` … `dutyTime8s` | 진료시간 시작 (1=월 … 7=일, 8=공휴일) | HHMM, 4자리. 옵션 |
| `dutyTime1c` … `dutyTime8c` | 진료시간 종료 | HHMM. 옵션 |
| `wgs84Lat`, `wgs84Lon` | 위도, 경도 | |

그 밖에 `rnum`, `dutyEtc`, `dutyMapimg`, `postCdn1`, `postCdn2` 가 있다.

### 1-2. 약국 위치정보 조회 `getParmacyLcinfoInqire` — 사용

위·경도 기준 가까운 약국. **운영시간은 오늘 하루치(`startTime`/`endTime`)만** 준다.

요청: `WGS84_LON`(필수), `WGS84_LAT`(필수), `pageNo`, `numOfRows`

응답: `hpid`, `dutyName`, `dutyAddr`, `dutyTel1`, `dutyDiv`, `dutyDivName`, `dutyFax`,
`latitude`, `longitude`(좌표 필드 이름이 목록 조회와 다르다), `distance`, `startTime`, `endTime`, `cnt`, `rnum`

### 1-3. 약국별 기본정보 `getParmacyBassInfoInqire`, 1-4. FullData `getParmacyFullDown` — 사용하지 않음

기본정보는 `HPID` 로 한 곳씩 조회한다(약국마다 1회 호출이라 목록 조회로 대신한다).
FullData 는 전국 전체(가이드 예시 `totalCount` 22,274)를 페이지로 내려받는다.

---

## 2. 응급의료기관 정보 조회 서비스 — `B552657/ErmctInfoInqireService`

서비스 URL: `https://apis.data.go.kr/B552657/ErmctInfoInqireService`

### 2-1. 응급실 실시간 가용병상정보 조회 `getEmrrmRltmUsefulSckbdInfoInqire` — 사용

요청: `STAGE1` 주소(시도, **필수**), `STAGE2` 주소(시군구, **필수**), `pageNo`, `numOfRows`

응답 item 에서 쓰는 필드

| 필드 | 뜻 | 비고 |
|---|---|---|
| `hpid` | 기관코드 | |
| `dutyName` | 기관명 | 명세표·Swagger 는 `dutyname`, 응답 예시는 `dutyName` — 파서가 태그를 소문자로 맞춘다 |
| `dutyTel3` | 응급실 전화 | 명세표는 「기관대표전화」, Swagger 는 `dutytel3` |
| `hvidate` | 입력일시 | 응답 예시 `20230414092700`, 명세표 예시 `2013-10-01 오후1:14:12` — 둘 다 해석 |
| `hvec` | 응급실 일반 병상 (가용) | 음수가 올 수 있다 — 정원 초과 |
| `hvs01` | 일반\_기준 (기준 병상 수) | |
| `hv28` | 소아 (가용) | |
| `hvs02` | 소아\_기준 | |

이 밖에 수술실(`hvoc`), 중환자실(`hvcc`, `hvncc`, `hvccc`, `hvicc`), 입원실(`hvgc`), 장비 가용 여부
(`hvctayn`, `hvmriayn` …), 격리 병상(`hv13`~`hv30`) 등 수십 개 필드가 있으나 MVP 에서는 쓰지 않는다.

### 2-2. 응급의료기관 목록정보 조회 `getEgytListInfoInqire` — 사용

요청: `Q0`, `Q1`, `QT`, `QZ`(기관분류), `QD`(진료과목), `QN`, `ORD`, `pageNo`, `numOfRows` (모두 옵션)

응답: `hpid`, `phpid`, `dutyEmcls`(응급의료기관분류 코드), `dutyEmclsName`(분류명), `dutyAddr`,
`dutyName`, `dutyTel1`(대표전화), `dutyTel3`(응급실 전화), `wgs84Lat`, `wgs84Lon`

### 2-3. 응급의료기관 위치정보 조회 `getEgytLcinfoInqire` — 사용

요청: `WGS84_LON`(필수), `WGS84_LAT`(필수), `pageNo`, `numOfRows`

응답: 약국 위치정보 조회와 같은 모양 (`latitude`, `longitude`, `distance`, `dutyDivName` …)

그 밖의 오퍼레이션(중증질환자 수용가능정보, 기본정보, 외상센터 3종, 응급실·중증질환 메시지)은 쓰지 않는다.

---

## 오류 응답

포털 페이지의 「오픈API 에러코드 안내」 표 기준.

| 코드 | 메시지 |
|---|---|
| 01 | APPLICATION\_ERROR |
| 04 | HTTP\_ERROR |
| 05 | SERVICETIMEOUT\_ERROR |
| 10 | INVALID\_REQUEST\_PARAMETER\_ERROR |
| 12 | NO\_OPENAPI\_SERVICE\_ERROR |
| 20 | SERVICE\_KEY\_IS\_NULL / PERMISSION\_DENIED / SERVICE\_ACCESS\_DENIED\_ERROR |
| 22 | LIMITED\_NUMBER\_OF\_SERVICE\_REQUESTS\_EXCEEDS\_ERROR (일일 한도) |
| 23 | LIMITED\_NUMBER\_OF\_SERVICE\_REQUESTS\_PER\_SECOND\_EXCEEDS\_ERROR |
| 29 | BLACKLIST\_IP\_ACCESS\_ERROR |
| 30 | SERVICE\_KEY\_IS\_NOT\_REGISTERED\_ERROR |
| 31 | DEADLINE\_HAS\_EXPIRED\_ERROR |

---

## 이 저장소가 API 를 쓰는 방식

- **내 위치**: 위치정보 조회로 가까운 약국·응급실을 받고, 결과 주소 앞머리에서 시도·시군구를
  뽑아 최대 두 지역의 목록 조회(약국 요일별 운영시간)와 실시간 병상 조회를 추가로 부른다.
  `hpid` 로 합친다.
- **지역 선택**: 목록 조회 한 번(+ 응급실은 실시간 병상 한 번).
- **캐시** (`src/lib/api/cache.ts`): 목록·위치 조회 1시간, 실시간 병상 1분. 좌표는 소수 셋째
  자리(약 100m)로 반올림해 캐시 키를 나눠 쓴다. 실패는 캐시하지 않는다.
- 운영시간 해석 규칙은 README 의 「영업 중 판정」을 본다.

## 확인하지 못한 것

서비스 키가 없어 실제 호출은 한 번도 하지 않았다. 아래는 문서끼리 어긋나거나 문서에 없는 부분이다.

1. **응답 필드 대소문자** — 같은 필드가 문서마다 `dutyName`/`dutyname`, `dutyTel3`/`dutytel3` 로
   다르다. 파서가 태그를 모두 소문자로 바꿔 읽으므로 어느 쪽이든 동작한다.
2. **`hvidate` 형식** — 두 형식을 모두 받지만 실제 값이 또 다른 형식이면 「입력 시각 없음」으로 보인다.
3. **`numOfRows` 상한** — 문서에 상한이 없다. 시군구 전체를 한 번에 받으려고 1,000 을 쓴다. 상한이
   있으면 목록이 잘릴 수 있다(페이지 반복이 필요).
4. **`ServiceKey` 대소문자** — Swagger 표기를 따랐다. 포털 게이트웨이는 보통 `serviceKey` 도 받는다.
5. **`Q1`/`STAGE2` 값** — 일반구가 있는 시(수원시 장안구 등)는 시 이름(`수원시`)으로 보낸다.
   API 가 이 값을 부분 일치로 찾는지 확인하지 못했다. 세종특별자치시는 `Q1`/`STAGE2` 를 보내지 않는데,
   실시간 병상 조회는 `STAGE2` 가 필수라 세종에서 실패할 수 있다.
6. **2026-07-01 행정구역 개편** — 전남광주통합특별시 출범, 인천 제물포구·영종구·서해구·검단구 신설을
   `src/lib/regions.ts` 에 반영했다. 국립중앙의료원 데이터의 주소가 새 이름으로 바뀌었는지는 확인하지
   못했다. 옛 이름(광주광역시·전라남도·인천 중구/동구/서구)으로 남아 있으면 지역 선택 조회가 비고,
   위치 기반 조회의 지역 보강이 빠진다(그 경우 영업 여부는 오늘 운영시간만으로 판정된다).
7. **공휴일 운영시간(`dutyTime8*`)의 의미** — 공휴일 값이 비어 있으면 공휴일에 쉰다고 본다.
   데이터 입력 관행상 "평소와 같음"을 비워 두는 약국이 있다면 공휴일에 실제보다 적게 보인다.
8. **게이트웨이 오류 응답의 모양** — `OpenAPI_ServiceResponse/cmmMsgHeader` 형식을 가정했다(포털 공통).
   `fixtures/errors/` 의 두 파일은 문서의 코드 표를 보고 만든 것이지 녹화한 응답이 아니다.
