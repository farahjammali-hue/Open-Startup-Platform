import * as XLSX from "xlsx";

/**
 * Downloads rows (first row = header) as a real .xlsx file with every column
 * set to the same width, so the sheet looks tidy in Excel/Google Sheets —
 * unlike CSV, column width isn't something a spreadsheet app can infer.
 */
export function downloadXlsx(
  filename: string,
  sheetName: string,
  rows: (string | number)[][],
  columnWidthChars = 20,
) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const columnCount = rows[0]?.length ?? 0;
  worksheet["!cols"] = Array.from({ length: columnCount }, () => ({ wch: columnWidthChars }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}
