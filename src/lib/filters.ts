import type { PharmacyView } from "./views";

export interface PharmacyFilter {
  openNow: boolean;
  night: boolean;
  holiday: boolean;
}

export const NO_FILTER: PharmacyFilter = { openNow: false, night: false, holiday: false };

/** 켜진 조건을 모두 만족하는 약국만 남긴다. */
export function filterPharmacies(
  items: readonly PharmacyView[],
  f: PharmacyFilter,
): PharmacyView[] {
  return items.filter(
    (p) =>
      (!f.openNow || p.openState === "open") && (!f.night || p.night) && (!f.holiday || p.holiday),
  );
}
