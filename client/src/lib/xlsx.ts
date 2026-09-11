import ExcelJS from "exceljs";

export interface XlsxExportOptions {
  columnWidthChars?: number;
  /** Column indices where consecutive rows sharing the same value are visually merged into one cell (e.g. a repeated "Section" label). */
  mergeColumns?: number[];
}

const HEADER_FILL = "FF1E293B";
const HEADER_FONT_COLOR = "FFFFFFFF";
const SECTION_FILL = "FFF1F5F9";
const BORDER_COLOR = "FFE2E8F0";
const THIN_BORDER = { style: "thin" as const, color: { argb: BORDER_COLOR } };

/**
 * Downloads rows (first row = header) as a real, formatted .xlsx file:
 * a bold dark header row (frozen, with an autofilter), a light grid of
 * borders, uniform column widths, and — for columns in `mergeColumns` —
 * consecutive equal-value cells merged into one bolded, tinted cell.
 */
export async function downloadXlsx(
  filename: string,
  sheetName: string,
  rows: (string | number)[][],
  options: XlsxExportOptions = {},
) {
  const { columnWidthChars = 20, mergeColumns = [] } = options;
  const columnCount = rows[0]?.length ?? 0;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
  worksheet.columns = Array.from({ length: columnCount }, () => ({ width: columnWidthChars }));
  worksheet.addRows(rows);

  worksheet.eachRow((row, rowNumber) => {
    row.height = rowNumber === 1 ? 20 : 18;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };
      if (rowNumber === 1) {
        cell.font = { bold: true, color: { argb: HEADER_FONT_COLOR } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else {
        cell.alignment = { vertical: "middle" };
      }
    });
  });

  if (columnCount > 0) {
    worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnCount } };
  }

  // Merge consecutive equal-value cells in the given columns (e.g. "Section").
  for (const col of mergeColumns) {
    let groupStart = 1; // row 0 is the header, so grouping starts at the first data row
    for (let r = 1; r <= rows.length; r++) {
      const stillInGroup = r < rows.length && rows[r][col] === rows[groupStart][col];
      if (stillInGroup) continue;
      if (r - 1 > groupStart) {
        // Clear the values ExcelJS leaves behind in the cells being merged away.
        for (let i = groupStart + 2; i <= r; i++) worksheet.getCell(i, col + 1).value = null;
        worksheet.mergeCells(groupStart + 1, col + 1, r, col + 1);
        const cell = worksheet.getCell(groupStart + 1, col + 1);
        cell.font = { bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SECTION_FILL } };
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
      groupStart = r;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
