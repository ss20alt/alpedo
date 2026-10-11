const PARAGUAY_TIME_ZONE = "America/Asuncion";

/** Returns today's date in Paraguay, independent of the device or server timezone. */
export function getParaguayDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: PARAGUAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function getParaguayMonthString(date: Date = new Date()): string {
  return getParaguayDateString(date).slice(0, 7);
}

/** Formats a YYYY-MM value as a compact, readable label such as "oct 26". */
export function formatParaguayMonthLabel(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return monthKey;

  return new Intl.DateTimeFormat("es-PY", {
    timeZone: PARAGUAY_TIME_ZONE,
    month: "short",
    year: "2-digit",
  })
    .format(new Date(Date.UTC(year, month - 1, 15, 12)))
    .replace(/\./g, "");
}

/** Formats a YYYY-MM-DD date for compact transaction rows, e.g. "11 oct 26". */
export function formatParaguayDateLabel(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return dateKey;

  return new Intl.DateTimeFormat("es-PY", {
    timeZone: PARAGUAY_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "2-digit",
  })
    .format(new Date(Date.UTC(year, month - 1, day, 12)))
    .replace(/\./g, "");
}

/** Adds calendar days to a Paraguay date without inheriting the host's timezone. */
export function getParaguayDateOffsetString(days: number, date: Date = new Date()): string {
  const [year, month, day] = getParaguayDateString(date).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
