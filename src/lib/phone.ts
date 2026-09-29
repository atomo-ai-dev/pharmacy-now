/**
 * Converts a phone number string to a tel: URI format.
 * - Removes range indicators (~, /, ,) and keeps only the first number
 * - Removes non-digit characters except +
 * - Returns null if the resulting number has fewer than 5 digits (too short to be a phone number)
 *
 * Examples:
 * - "031-574-9118~9" -> "0315749118"
 * - "02-1588-5700" -> "0215885700"
 * - "02-119" -> "02119"
 * - "032)765-7070" -> "0327657070"
 */
export function phoneToTelUri(phone: string | null | undefined): string | null {
  if (!phone) {
    return null;
  }

  // First, split by range/additional number indicators and take the first part
  const firstPart = phone.split(/[~,/]/)[0] ?? "";

  // Remove all non-digit and non-+ characters
  const sanitized = firstPart.replace(/[^\d+]/g, "");

  // Return null if fewer than 5 digits (too short to be a phone number)
  if (sanitized.replace(/\D/g, "").length < 5) {
    return null;
  }

  return sanitized;
}

/**
 * Checks if a phone number string is valid for tel: links (has >= 5 digits)
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  return phoneToTelUri(phone) !== null;
}
