/** Escape a CSV cell (Excel-friendly). */
export function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build CSV text with UTF-8 BOM so Excel opens Unicode correctly. */
export function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((r) => r.map(csvCell).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
