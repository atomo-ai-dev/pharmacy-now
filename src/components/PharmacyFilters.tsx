"use client";

import type { PharmacyFilter } from "@/lib/filters";

interface Props {
  value: PharmacyFilter;
  onChange: (next: PharmacyFilter) => void;
}

const OPTIONS: Array<{ key: keyof PharmacyFilter; label: string }> = [
  { key: "openNow", label: "지금 영업 중" },
  { key: "night", label: "밤 10시 이후 영업" },
  { key: "holiday", label: "공휴일 영업" },
];

export function PharmacyFilters({ value, onChange }: Props) {
  return (
    <fieldset className="filters">
      <legend>조건</legend>
      {OPTIONS.map(({ key, label }) => (
        <label key={key} className="chip">
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />
          <span>{label}</span>
        </label>
      ))}
    </fieldset>
  );
}
