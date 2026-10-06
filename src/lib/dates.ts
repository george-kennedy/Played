const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Calendar date in America/Halifax, YYYY-MM-DD. */
export function halifaxToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Halifax",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function halifaxYear(now: Date = new Date()): number {
  return Number(halifaxToday(now).slice(0, 4));
}

export function isIsoDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

export function yearOfPlayedOn(playedOn: string): number {
  return Number(playedOn.slice(0, 4));
}
