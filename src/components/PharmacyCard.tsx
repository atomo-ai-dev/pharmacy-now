import { formatDistance } from "@/lib/geo/distance";
import { phoneToTelUri } from "@/lib/phone";
import type { PharmacyView } from "@/lib/views";

function OpenBadge({ p }: { p: PharmacyView }) {
  switch (p.openState) {
    case "open":
      return (
        <span className="badge badge-open">
          영업 중 · {p.closesAt ? `${p.closesAt}까지` : "24시간"}
        </span>
      );
    case "closed":
      return <span className="badge badge-closed">영업 종료</span>;
    case "unknown":
      return <span className="badge badge-unknown">운영시간 확인 필요</span>;
  }
}

export function PharmacyCard({ p }: { p: PharmacyView }) {
  const telUri = phoneToTelUri(p.phone);

  return (
    <article className="card" aria-labelledby={`ph-${p.id}`}>
      <div className="card-head">
        <h3 id={`ph-${p.id}`}>{p.name}</h3>
        <OpenBadge p={p} />
      </div>
      <p className="card-meta">
        {p.distanceKm !== null && <span className="distance">{formatDistance(p.distanceKm)}</span>}
        <span>{p.address}</span>
      </p>
      <p className="card-hours">
        오늘 <strong>{p.todayHours ?? "정보 없음"}</strong>
      </p>
      {(p.night || p.holiday) && (
        <ul className="tags" aria-label="특징">
          {p.night && <li className="tag">밤 10시 이후 영업</li>}
          {p.holiday && <li className="tag">공휴일 영업</li>}
        </ul>
      )}
      <div className="card-actions">
        {telUri ? (
          <a className="btn btn-small" href={`tel:${telUri}`}>
            전화 {p.phone}
          </a>
        ) : p.phone ? (
          <span className="muted">전화 {p.phone}</span>
        ) : (
          <span className="muted">전화번호 없음</span>
        )}
        {p.lat !== null && p.lon !== null && (
          <a
            className="btn btn-small btn-ghost"
            href={`https://map.kakao.com/link/map/${encodeURIComponent(p.name)},${p.lat},${p.lon}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            지도<span className="visually-hidden"> (새 창)</span>
          </a>
        )}
      </div>
      {p.weeklyHours && (
        <details className="weekly">
          <summary>요일별 운영시간</summary>
          <dl>
            {p.weeklyHours.map(([day, hours]) => (
              <div key={day} className="weekly-row">
                <dt>{day}</dt>
                <dd>{hours ?? "확인 필요"}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </article>
  );
}
