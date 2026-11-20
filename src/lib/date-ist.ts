/** Start of "today" in Asia/Kolkata, as UTC ISO string for DB queries. */
export function startOfTodayIstIso(): string {
  const dateInIst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${dateInIst}T00:00:00+05:30`).toISOString();
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
