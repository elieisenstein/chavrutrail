export const DEFAULT_TIMEZONE = "Asia/Jerusalem";

/**
 * Display ISO timestamptz in Israel time (or chosen TZ).
 * - Store UTC in DB
 * - Convert ONLY at display time
 */
export function formatDateTimeLocal(
  iso: string,
  locale = "he-IL",
  timeZone = DEFAULT_TIMEZONE
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleString(locale, {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
  });
}
