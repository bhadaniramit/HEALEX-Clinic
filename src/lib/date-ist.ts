/** Today's calendar date in Asia/Kolkata as YYYY-MM-DD. */
export function todayDateIst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Start of "today" in Asia/Kolkata, as UTC ISO string for DB queries. */
export function startOfTodayIstIso(): string {
  return new Date(`${todayDateIst()}T00:00:00+05:30`).toISOString();
}

/** Start of a calendar day (YYYY-MM-DD) in IST → UTC ISO. */
export function startOfIstDateIso(dateYmd: string): string {
  return new Date(`${dateYmd}T00:00:00+05:30`).toISOString();
}

/** Exclusive end (= start of next calendar day in IST) for a YYYY-MM-DD. */
export function endExclusiveOfIstDateIso(dateYmd: string): string {
  const start = new Date(`${dateYmd}T00:00:00+05:30`);
  start.setTime(start.getTime() + 24 * 60 * 60 * 1000);
  return start.toISOString();
}

export function todayLabelIst(): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());
}
