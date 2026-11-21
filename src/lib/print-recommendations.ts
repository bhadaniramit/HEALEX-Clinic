import type { Recommendation } from "@/lib/database.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function listItems(items: Recommendation[]): string {
  if (items.length === 0) {
    return `<p class="empty">None prescribed.</p>`;
  }
  return `<ul>${items
    .map(
      (r) =>
        `<li>${escapeHtml(r.content).replace(/\n/g, "<br/>")}</li>`,
    )
    .join("")}</ul>`;
}

/**
 * Opens a letterhead-style print window (matches HEALEX Letter Head.docx)
 * and triggers the system print dialog.
 */
export function printRecommendationsLetterhead(opts: {
  patientName: string;
  phone?: string;
  dob?: string;
  recommendations: Recommendation[];
}): void {
  const medicines = opts.recommendations.filter((r) => r.type === "medicine");
  const exercises = opts.recommendations.filter((r) => r.type === "exercise");
  const printedOn = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Recommendations — ${escapeHtml(opts.patientName)}</title>
  <style>
    @page { size: A4; margin: 18mm 18mm 22mm 18mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Times New Roman", Times, serif;
      color: #111;
      font-size: 12pt;
      line-height: 1.45;
    }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 2px solid #0f3d3e;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .doctor-name {
      font-size: 18pt;
      font-weight: 700;
      margin: 0;
      color: #0f3d3e;
    }
    .credentials {
      margin: 4px 0 0;
      font-size: 10.5pt;
      color: #333;
    }
    .contact {
      text-align: right;
      font-size: 10.5pt;
      min-width: 180px;
    }
    .contact strong { display: block; margin-bottom: 4px; }
    .meta {
      margin: 0 0 20px;
      font-size: 11pt;
    }
    .meta p { margin: 2px 0; }
    h2.section {
      font-size: 13pt;
      margin: 18px 0 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #ccc;
      color: #0f3d3e;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    ul { margin: 0; padding-left: 1.25rem; }
    li { margin: 0 0 8px; }
    .empty { margin: 0; color: #555; font-style: italic; }
    .footer {
      margin-top: 36px;
      padding-top: 10px;
      border-top: 2px solid #0f3d3e;
      text-align: center;
      font-size: 10.5pt;
    }
    .clinic-name {
      font-weight: 700;
      font-size: 12pt;
      color: #0f3d3e;
    }
    .printed { margin-top: 10px; font-size: 9pt; color: #666; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <header class="header">
    <div>
      <p class="doctor-name">Dr. Rajeev K Bhadani (PT)</p>
      <p class="credentials">MSPT, FICR, BPT, MIAP</p>
    </div>
    <div class="contact">
      <strong>Contact</strong>
      Mobile: 9836115000<br/>
      Email: rkbdoc@gmail.com
    </div>
  </header>

  <div class="meta">
    <p><strong>Patient:</strong> ${escapeHtml(opts.patientName)}</p>
    ${opts.phone ? `<p><strong>Mobile:</strong> ${escapeHtml(opts.phone)}</p>` : ""}
    ${opts.dob ? `<p><strong>DOB:</strong> ${escapeHtml(opts.dob)}</p>` : ""}
  </div>

  <h2 class="section">Medicine</h2>
  ${listItems(medicines)}

  <h2 class="section">Exercise</h2>
  ${listItems(exercises)}

  <footer class="footer">
    <div class="clinic-name">Healex Pain &amp; Lifestyle Clinic</div>
    <div>GD-126, Sector 3, Near GD Block PNB, Saltlake 700106</div>
    <div class="printed">Printed ${escapeHtml(printedOn)} (IST)</div>
  </footer>
</body>
</html>`;

  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (!win) {
    window.alert("Please allow pop-ups to print recommendations.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  // Wait for layout before print dialog
  win.setTimeout(() => {
    win.print();
  }, 250);
}
