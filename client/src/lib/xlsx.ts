import * as XLSX from "xlsx";

export interface XlsxExportOptions {
  columnWidthChars?: number;
  /** Column indices where consecutive rows sharing the same value are visually merged into one cell (e.g. a repeated "Section" label). */
  mergeColumns?: number[];
}

/**
 * Downloads rows (first row = header) as a real .xlsx file with every column
 * set to the same width, so the sheet looks tidy in Excel/Google Sheets —
 * unlike CSV, column width isn't something a spreadsheet app can infer.
 */
export function downloadXlsx(
  filename: string,
  sheetName: string,
  rows: (string | number)[][],
  options: XlsxExportOptions = {},
) {
  const { columnWidthChars = 20, mergeColumns = [] } = options;
  // Work on a copy so blanking merged-away cells doesn't affect the caller's data.
  const sheetRows = rows.map((row) => [...row]);
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

  for (const col of mergeColumns) {
    let groupStart = 1; // row 0 is the header, so grouping starts at the first data row
    for (let r = 1; r <= sheetRows.length; r++) {
      const stillInGroup = r < sheetRows.length && sheetRows[r][col] === sheetRows[groupStart][col];
      if (stillInGroup) continue;
      if (r - 1 > groupStart) {
        merges.push({ s: { r: groupStart, c: col }, e: { r: r - 1, c: col } });
        for (let i = groupStart + 1; i < r; i++) sheetRows[i][col] = "";
      }
      groupStart = r;
    }
  }

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  const columnCount = sheetRows[0]?.length ?? 0;
  worksheet["!cols"] = Array.from({ length: columnCount }, () => ({ wch: columnWidthChars }));
  if (merges.length > 0) worksheet["!merges"] = merges;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}
