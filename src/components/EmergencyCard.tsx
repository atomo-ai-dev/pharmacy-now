import { formatDistance } from "@/lib/geo/distance";
import { phoneToTelUri } from "@/lib/phone";
import { formatMinutes, isoDate, toKst } from "@/lib/time/kst";
import type { BedView, EmergencyRoomView } from "@/lib/views";

function bedText(b: BedView): string {
  switch (b.state) {
    case "unknown":
      return "정보 없음";
    case "over":
      return `포화 (정원 초과 ${Math.abs(b.available ?? 0)}명)`;
    case "full":
      return "여유 병상 없음";
    case "available":
      return b.capacity !== null ? `${b.available} / ${b.capacity}` : `${b.available}`;
  }
}

function Beds({ label, b }: { label: string; b: BedView }) {
  return (
    <div className={`beds beds-${b.state}`}>
      <dt>{label}</dt>
      <dd>{bedText(b)}</dd>
    </div>
  );
}

/** "10:30 기준 · 5분 전" (기준 시각이 오늘이 아니면 날짜도 붙인다) */
export function updatedLabel(updatedAt: string, reference: Date): string {
  const at = new Date(updatedAt);
  const k = toKst(at);
  const sameDay = isoDate(k) === isoDate(toKst(reference));
  const clock = `${sameDay ? "" : `${k.month}/${k.day} `}${formatMinutes(k.minutes)} 기준`;
  const mins = Math.round((reference.getTime() - at.getTime()) / 60_000);
  if (mins < 0) return clock;
  if (mins < 1) return `${clock} · 방금`;
  if (mins < 60) return `${clock} · ${mins}분 전`;
  if (mins < 60 * 24) return `${clock} · ${Math.floor(mins / 60)}시간 전`;
  return `${clock} · ${Math.floor(mins / 1440)}일 전`;
}

export function EmergencyCard({ er, reference }: { er: EmergencyRoomView; reference: Date }) {
  const telUri = phoneToTelUri(er.phone);

  return (
    <article className="card" aria-labelledby={`er-${er.id}`}>
      <div className="card-head">
        <h3 id={`er-${er.id}`}>{er.name}</h3>
        {er.category && <span className="badge badge-neutral">{er.category}</span>}
      </div>
      <p className="card-meta">
        {er.distanceKm !== null && (
          <span className="distance">{formatDistance(er.distanceKm)}</span>
        )}
        {er.address && <span>{er.address}</span>}
      </p>
      <dl className="bed-grid" aria-label="응급실 가용 병상">
        <Beds label="응급실 일반" b={er.general} />
        <Beds label="소아" b={er.pediatric} />
      </dl>
      <p className={er.stale ? "updated updated-stale" : "updated"}>
        {er.updatedAt ? updatedLabel(er.updatedAt, reference) : "병상 정보 입력 시각 없음"}
        {er.stale && " — 오래된 정보일 수 있습니다"}
      </p>
      <div className="card-actions">
        {telUri ? (
          <a className="btn btn-small" href={`tel:${telUri}`}>
            응급실 전화 {er.phone}
          </a>
        ) : er.phone ? (
          <span className="muted">응급실 전화 {er.phone}</span>
        ) : (
          <span className="muted">전화번호 없음</span>
        )}
        {er.lat !== null && er.lon !== null && (
          <a
            className="btn btn-small btn-ghost"
            href={`https://map.kakao.com/link/map/${encodeURIComponent(er.name)},${er.lat},${er.lon}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            지도<span className="visually-hidden"> (새 창)</span>
          </a>
        )}
      </div>
    </article>
  );
}
