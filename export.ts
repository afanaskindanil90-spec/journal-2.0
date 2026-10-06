import type { JournalLesson, Student } from "@/lib/models";
import { formatDateLong, GRADES } from "@/lib/journal";

export type ExportFormat = "csv" | "xlsx";

export interface ExportClassData {
  className: string;
  students: Student[];
  lessons: JournalLesson[];
}

export const CSV_SEPARATOR = ";";

function escapeCsvCell(value: string): string {
  if (/[";,\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildExportMatrix(data: ExportClassData): string[][] {
  const lessonsByDate = new Map<string, JournalLesson>();
  for (const lesson of data.lessons) lessonsByDate.set(lesson.date, lesson);
  const dates = data.lessons
    .map((lesson) => lesson.date)
    .sort((a, b) => a.localeCompare(b));

  const header = ["Ученик", ...dates.map(formatDateLong)];
  const rows = data.students.map((student) => [
    `${student.lastName} ${student.firstName}`,
    ...dates.map((date) => lessonsByDate.get(date)?.entries[student.id] ?? ""),
  ]);

  return [header, ...rows];
}

export function buildCsv(data: ExportClassData): string {
  const matrix = buildExportMatrix(data);
  const lines = matrix.map((row) =>
    row.map((cell) => escapeCsvCell(cell)).join(CSV_SEPARATOR)
  );
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function columnName(index: number): string {
  let name = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function buildSheetXml(matrix: string[][]): string {
  const cellParts: string[] = [];
  const maxColumn = Math.max(1, matrix[0]?.length ?? 1);

  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
    const rowCells: string[] = [];
    for (let colIndex = 0; colIndex < matrix[rowIndex].length; colIndex++) {
      const value = matrix[rowIndex][colIndex];
      if (value === "") continue;
      const ref = `${columnName(colIndex)}${rowIndex + 1}`;
      if ((GRADES as readonly string[]).includes(value)) {
        rowCells.push(`<c r="${ref}"><v>${value}</v></c>`);
      } else {
        rowCells.push(
          `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
        );
      }
    }
    cellParts.push(`<row r="${rowIndex + 1}">${rowCells.join("")}</row>`);
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols>
<col min="1" max="1" width="28" customWidth="1"/>
<col min="2" max="${maxColumn}" width="13" customWidth="1"/>
</cols>
<sheetData>${cellParts.join("")}</sheetData>
</worksheet>`;
}

function buildWorkbookXml(sheetName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
</sheets>
</workbook>`;
}

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, "").trim();
  return (cleaned || "Журнал").slice(0, 31);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    (date.getSeconds() >> 1);
  const day =
    ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: day };
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function buildZip(entries: ZipEntry[]): Buffer {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.data;
    const checksum = crc32(data);
    const { time, date } = dosDateTime(new Date());

    const localHeader = new ArrayBuffer(30 + nameBytes.length);
    const localView = new DataView(localHeader);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    const localBytes = new Uint8Array(localHeader);
    localBytes.set(nameBytes, 30);
    localParts.push(localBytes, data);

    const centralHeader = new ArrayBuffer(46 + nameBytes.length);
    const centralView = new DataView(centralHeader);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    const centralBytes = new Uint8Array(centralHeader);
    centralBytes.set(nameBytes, 46);
    centralParts.push(centralBytes);

    offset += localBytes.length + data.length;
  }

  const centralDirectorySize = centralParts.reduce(
    (sum, part) => sum + part.length,
    0
  );
  const endRecord = new ArrayBuffer(22);
  const endView = new DataView(endRecord);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectorySize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  const parts = [...localParts, ...centralParts, new Uint8Array(endRecord)];
  const totalSize = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalSize);
  let position = 0;
  for (const part of parts) {
    output.set(part, position);
    position += part.length;
  }
  return Buffer.from(output.buffer, output.byteOffset, output.byteLength);
}

export function buildXlsx(data: ExportClassData): Buffer {
  const matrix = buildExportMatrix(data);
  const sheetName = sanitizeSheetName(data.className);

  const contentTypeXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [
    { name: "[Content_Types].xml", data: encoder.encode(contentTypeXml) },
    { name: "_rels/.rels", data: encoder.encode(rootRelsXml) },
    {
      name: "xl/workbook.xml",
      data: encoder.encode(buildWorkbookXml(sheetName)),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: encoder.encode(workbookRelsXml),
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: encoder.encode(buildSheetXml(matrix)),
    },
  ];

  return buildZip(entries);
}

export function buildContentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7e]/g, "_");
  const encoded = encodeURIComponent(filename).replace(/'/g, "%27");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
