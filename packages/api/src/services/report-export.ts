/**
 * Week 19.4 — report export helpers (pure, no dependencies).
 *
 * CSV: RFC 4180 quoting + UTF-8 BOM so Excel opens it natively with correct
 * encoding. PDF: a minimal but standards-valid PDF 1.4 writer — Helvetica
 * text lines on US-Letter portrait pages, paginated, with a correct xref
 * table. (The repo carries no pdf/xlsx libraries; keeping exports
 * dependency-free matches the house style, and both formats are covered by
 * structure tests in tests/analytics.spec.ts.)
 */

export interface ExportColumn {
  key: string;
  label: string;
  /** Column width in PDF points (default 90). */
  width?: number;
}

const BOM = '\uFEFF';

/** Escapes a CSV field per RFC 4180: quote when it contains , " \n or \r. */
function csvField(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/** Serializes rows into an Excel-friendly CSV string (BOM included). */
export function toCsv(columns: ExportColumn[], rows: Array<Record<string, unknown>>): string {
  const header = columns.map((c) => csvField(c.label)).join(',');
  const body = rows
    .map((row) => columns.map((c) => csvField(row[c.key])).join(','))
    .join('\r\n');
  return `${BOM}${header}\r\n${body}${rows.length > 0 ? '\r\n' : ''}`;
}

// ── Minimal PDF writer ───────────────────────────────────────────────────────

const PAGE_WIDTH = 612; // US Letter, portrait
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const TITLE_SIZE = 16;
const BODY_SIZE = 10;
const LEADING = 14;

/** Escapes PDF string literals ( ) and \ ; drops non-Latin1 chars. */
function pdfEscape(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

interface PageOps {
  lines: string[];
}

/** Builds one page's content stream ops (title on the first page only). */
function pageOps(
  title: string,
  columns: ExportColumn[],
  rows: Array<Record<string, unknown>>,
  pageIndex: number,
): PageOps {
  const ops: string[] = [];
  const widths = columns.map((c) => c.width ?? 90);

  let y = PAGE_HEIGHT - MARGIN;
  const text = (x: number, size: number, value: string, bold = false) => {
    const font = bold ? '/F2' : '/F1';
    ops.push(`BT ${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfEscape(value)}) Tj ET`);
  };

  if (pageIndex === 0) {
    text(MARGIN, TITLE_SIZE, title, true);
    y -= TITLE_SIZE + 8;
  } else {
    text(MARGIN, BODY_SIZE, `${title} (cont.)`, true);
    y -= LEADING;
  }

  // Header row (bold) + body rows, clipping columns into their widths.
  let x = MARGIN;
  columns.forEach((c, i) => text(x, BODY_SIZE, c.label.slice(0, Math.floor(widths[i] / 5)), true));
  y -= LEADING;
  for (const row of rows) {
    x = MARGIN;
    columns.forEach((c, i) => {
      const value = row[c.key] === null || row[c.key] === undefined ? '' : String(row[c.key]);
      text(x, BODY_SIZE, value.slice(0, Math.floor(widths[i] / 5)));
      x += widths[i];
    });
    y -= LEADING;
    if (y < MARGIN + LEADING) break; // caller paginates; safety clip
  }

  return { lines: ops };
}

const streamFor = (ops: PageOps): string =>
  `q\n${ops.lines.join('\n')}\nQ`;

/**
 * Renders a tabular report as a valid single-file PDF (one or more pages).
 * Returns a Latin-1 encodable string — write it with `res.send` / Buffer
 * from 'latin1' so byte offsets in the xref stay exact.
 */
export function toPdf(
  title: string,
  columns: ExportColumn[],
  rows: Array<Record<string, unknown>>,
): string {
  const rowsPerPage = Math.floor(
    (PAGE_HEIGHT - 2 * MARGIN - (TITLE_SIZE + 8) - LEADING) / LEADING,
  );
  const pages: Array<Record<string, unknown>[]> = [];
  for (let i = 0; i < rows.length; i += rowsPerPage) {
    pages.push(rows.slice(i, i + rowsPerPage));
  }
  if (pages.length === 0) pages.push([]);

  const contentStreams = pages.map((pageRows, idx) =>
    streamFor(pageOps(title, columns, pageRows, idx)),
  );

  // Object assembly — offsets computed over the exact latin1 byte stream.
  const objects: Record<number, string> = {};
  // Fixed layout: 1 catalog, 2 pages, 3 F1, 4 F2, then page/content pairs
  // (first page 5/6, second 7/8, …) so ids stay contiguous with no holes.
  const kids = pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ');
  const ids = [1, 2, 3, 4, ...pages.flatMap((_, i) => [5 + i * 2, 5 + i * 2 + 1])];

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  pages.forEach((_, i) => {
    const pageId = 5 + i * 2;
    const contentId = pageId + 1;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    const stream = contentStreams[i];
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
  });

  // Serialize with a running byte offset for the xref table.
  let pdf = '%PDF-1.4\n';
  const offsets: Record<number, number> = {};
  for (const id of ids) {
    offsets[id] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  const count = ids.length + 1; // ids + the free-table entry
  pdf += `xref\n0 ${count}\n`;
  pdf += '0000000000 65535 f \n';
  for (const id of ids) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}