import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const BRAND_BLUE = "FF0F766E";
const SUBHEAD_GREY = "FFE2E8F0";
const HEADER_GREY = "FF1F2937";
const ROW_ALT = "FFF8FAFC";
const REVERSAL_RED = "FFFEE2E2";
const RETAINED_GREEN = "FFDCFCE7";

const MONTH_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function periodLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  if (!y || !m) return yyyymm;
  return `${MONTH_FULL[m - 1]} ${y}`;
}

export interface DetailedRow {
  period: string;
  invoiceNo: string;
  partyName: string;
  asset: string;
  taxableValue: number;
  gstPercent: number;
  exemptPercent: number;
  eligibleItc: number;
  reversal: number;
  netClaim: number;
  igstReversal?: number;
  cgstReversal?: number;
  sgstReversal?: number;
}

export interface BlockedRow {
  date: string;
  invoiceNo: string;
  partyName: string;
  asset: string;
  taxableValue: number;
  gstPercent: number;
  blockedItc: number;
  reason?: string;
}

export interface Rule43XlsxOptions {
  filterTitle: string;
  totalEntries: number;
  totalCapitalGoodsValue: number;
  totalActualItc: number;
  totalReversal: number;
  netItcClaimed: number;
  detailedRows: DetailedRow[];
  blockedRows?: BlockedRow[];
  totalBlockedItc?: number;
}

function applyHeader(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_GREY } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = {
    top:    { style: "thin", color: { argb: "FF94A3B8" } },
    left:   { style: "thin", color: { argb: "FF94A3B8" } },
    bottom: { style: "thin", color: { argb: "FF94A3B8" } },
    right:  { style: "thin", color: { argb: "FF94A3B8" } },
  };
}

function applyTitleRow(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
}

function applySubhead(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 11, color: { argb: HEADER_GREY } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUBHEAD_GREY } };
  cell.alignment = { horizontal: "left", vertical: "middle" };
}

function applyMoneyFormat(cell: ExcelJS.Cell) {
  cell.numFmt = '#,##0.00';
  cell.alignment = { horizontal: "right", vertical: "middle" };
}

function applyZebra(row: ExcelJS.Row, isAlt: boolean) {
  if (!isAlt) return;
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROW_ALT } };
  });
}

function rowBorders(ws: ExcelJS.Worksheet, r: number, cols: number) {
  for (let c = 1; c <= cols; c++) {
    ws.getCell(r, c).border = {
      top:    { style: "hair", color: { argb: "FFCBD5E1" } },
      left:   { style: "hair", color: { argb: "FFCBD5E1" } },
      bottom: { style: "hair", color: { argb: "FFCBD5E1" } },
      right:  { style: "hair", color: { argb: "FFCBD5E1" } },
    };
  }
}

function addBlockedSheet(wb: ExcelJS.Workbook, blockedRows: BlockedRow[], totalBlockedItc: number) {
  const bws = wb.addWorksheet("Blocked Credit (17(5))", { views: [{ state: "frozen", ySplit: 4 }] });
  bws.columns = [
    { width: 14 }, { width: 18 }, { width: 26 }, { width: 28 },
    { width: 16 }, { width: 10 }, { width: 16 }, { width: 32 },
  ];
  bws.mergeCells("A1:H1");
  const bt = bws.getCell("A1"); bt.value = "BLOCKED CREDIT — Section 17(5) of GST Act"; applyTitleRow(bt);
  bws.getRow(1).height = 26;
  bws.mergeCells("A2:H2");
  const bsub = bws.getCell("A2"); bsub.value = `Total Blocked ITC: Rs. ${totalBlockedItc.toFixed(2)}`;
  bsub.font = { italic: true, bold: true, color: { argb: "FFB91C1C" } };
  bsub.alignment = { horizontal: "center" };
  bws.getRow(2).height = 20;

  const bh = ["Date", "Invoice No", "Party Name", "Asset", "Taxable Value", "GST %", "Blocked ITC", "Reason / Notes"];
  bh.forEach((h, i) => { const c = bws.getCell(4, i + 1); c.value = h; applyHeader(c); });
  bws.getRow(4).height = 30;

  blockedRows.forEach((row, i) => {
    const rr = 5 + i;
    bws.getCell(rr, 1).value = row.date;
    bws.getCell(rr, 2).value = row.invoiceNo;
    bws.getCell(rr, 3).value = row.partyName;
    bws.getCell(rr, 4).value = row.asset;
    bws.getCell(rr, 5).value = row.taxableValue;
    bws.getCell(rr, 6).value = row.gstPercent;
    bws.getCell(rr, 7).value = row.blockedItc;
    bws.getCell(rr, 8).value = row.reason ?? "";
    [5, 7].forEach((col) => applyMoneyFormat(bws.getCell(rr, col)));
    bws.getCell(rr, 6).numFmt = '0.00"%"';
    bws.getCell(rr, 7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: REVERSAL_RED } };
    bws.getCell(rr, 7).font = { color: { argb: "FFB91C1C" }, bold: true };
    applyZebra(bws.getRow(rr), i % 2 === 1);
    rowBorders(bws, rr, 8);
  });
}

export async function exportRule43Xlsx(opts: Rule43XlsxOptions, filename: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Rule 43 ITC Calculator";
  wb.created = new Date();

  // Columns A..M (13)
  const TOTAL_COLS = 13;
  const ws = wb.addWorksheet("Summary", { views: [{ state: "frozen", ySplit: 5 }] });
  ws.columns = [
    { width: 14 }, { width: 18 }, { width: 26 }, { width: 28 },
    { width: 16 }, { width: 10 }, { width: 12 }, { width: 14 },
    { width: 13 }, { width: 13 }, { width: 13 }, { width: 14 }, { width: 14 },
  ];

  ws.mergeCells("A1:M1");
  const t = ws.getCell("A1"); t.value = "RULE 43 REPORT SUMMARY"; applyTitleRow(t);
  ws.getRow(1).height = 26;

  ws.mergeCells("A2:M2");
  const sub = ws.getCell("A2"); sub.value = opts.filterTitle;
  sub.font = { italic: true, color: { argb: HEADER_GREY }, size: 11 };
  sub.alignment = { horizontal: "center" };
  ws.getRow(2).height = 20;

  const summary: Array<[string, number | string]> = [
    ["Total Entries", opts.totalEntries],
    ["Total Capital Goods Value", opts.totalCapitalGoodsValue],
    ["Total ITC (incl. CN/DN adj.)", opts.totalActualItc],
    ["Total Reversal", opts.totalReversal],
    ["Net ITC Claimed", opts.netItcClaimed],
  ];
  if ((opts.totalBlockedItc ?? 0) > 0) {
    summary.push(["Blocked Credit u/s 17(5)", opts.totalBlockedItc!]);
  }
  let r = 4;
  for (const [label, value] of summary) {
    const c1 = ws.getCell(`A${r}`); c1.value = label; applySubhead(c1);
    ws.mergeCells(`A${r}:D${r}`);
    const c2 = ws.getCell(`E${r}`); c2.value = value;
    if (typeof value === "number") {
      applyMoneyFormat(c2);
      c2.font = { bold: true, color: { argb: label.startsWith("Total Reversal") ? "FFB91C1C" : label.startsWith("Net ITC") ? "FF15803D" : HEADER_GREY } };
    }
    r++;
  }
  r++;

  ws.mergeCells(`A${r}:M${r}`);
  const dh = ws.getCell(`A${r}`); dh.value = "DETAILED RECORDS"; applyTitleRow(dh);
  ws.getRow(r).height = 22;
  r++;

  const headers = ["Period", "Invoice No", "Party Name", "Asset / Machine / Product",
    "Taxable Value", "GST %", "Exempt %", "Eligible ITC",
    "IGST Reversal", "CGST Reversal", "SGST Reversal", "Total Reversal", "Net Claim"];
  headers.forEach((h, i) => {
    const c = ws.getCell(r, i + 1); c.value = h; applyHeader(c);
  });
  ws.getRow(r).height = 30;
  r++;

  opts.detailedRows.forEach((row, i) => {
    ws.getCell(r, 1).value = periodLabel(row.period);
    ws.getCell(r, 2).value = row.invoiceNo;
    ws.getCell(r, 3).value = row.partyName;
    ws.getCell(r, 4).value = row.asset;
    ws.getCell(r, 5).value = row.taxableValue;
    ws.getCell(r, 6).value = row.gstPercent;
    ws.getCell(r, 7).value = row.exemptPercent;
    ws.getCell(r, 8).value = row.eligibleItc;
    ws.getCell(r, 9).value = row.igstReversal ?? 0;
    ws.getCell(r, 10).value = row.cgstReversal ?? 0;
    ws.getCell(r, 11).value = row.sgstReversal ?? 0;
    ws.getCell(r, 12).value = row.reversal;
    ws.getCell(r, 13).value = row.netClaim;
    [5, 8, 9, 10, 11, 12, 13].forEach((col) => applyMoneyFormat(ws.getCell(r, col)));
    [6, 7].forEach((col) => { ws.getCell(r, col).numFmt = '0.00"%"'; ws.getCell(r, col).alignment = { horizontal: "right" }; });
    [9, 10, 11, 12].forEach((col) => {
      ws.getCell(r, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: REVERSAL_RED } };
      ws.getCell(r, col).font = { color: { argb: "FFB91C1C" }, bold: col === 12 };
    });
    ws.getCell(r, 13).fill = { type: "pattern", pattern: "solid", fgColor: { argb: RETAINED_GREEN } };
    ws.getCell(r, 13).font = { color: { argb: "FF15803D" }, bold: true };
    applyZebra(ws.getRow(r), i % 2 === 1);
    rowBorders(ws, r, TOTAL_COLS);
    r++;
  });

  const totalRow = r;
  ws.getCell(totalRow, 1).value = "TOTAL";
  ws.mergeCells(`A${totalRow}:D${totalRow}`);
  const tot = (col: number, val: number) => {
    const c = ws.getCell(totalRow, col); c.value = val; applyMoneyFormat(c);
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUBHEAD_GREY } };
  };
  tot(5, opts.totalCapitalGoodsValue);
  tot(8, opts.detailedRows.reduce((s, x) => s + x.eligibleItc, 0));
  tot(9, opts.detailedRows.reduce((s, x) => s + (x.igstReversal ?? 0), 0));
  tot(10, opts.detailedRows.reduce((s, x) => s + (x.cgstReversal ?? 0), 0));
  tot(11, opts.detailedRows.reduce((s, x) => s + (x.sgstReversal ?? 0), 0));
  tot(12, opts.detailedRows.reduce((s, x) => s + x.reversal, 0));
  tot(13, opts.detailedRows.reduce((s, x) => s + x.netClaim, 0));
  const tcell = ws.getCell(totalRow, 1);
  tcell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  tcell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_GREY } };
  tcell.alignment = { horizontal: "right" };

  if (opts.blockedRows && opts.blockedRows.length > 0) {
    addBlockedSheet(wb, opts.blockedRows, opts.totalBlockedItc ?? 0);
  }

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

// ---------- Per-invoice working sheet ----------
export interface InvoiceXlsxRow {
  period: string;
  ratio: number;
  monthlyItc: number;
  igst: number;
  cgst: number;
  sgst: number;
  reversal: number;
  retained: number;
  cumReversal: number;
  note?: string;
}
export interface InvoiceXlsxOptions {
  invoiceNo: string;
  asset: string;
  supplier: string;
  filterTitle: string;
  totalItc: number;
  totalReversal: number;
  totalRetained: number;
  rows: InvoiceXlsxRow[];
}
export async function exportInvoiceXlsx(opts: InvoiceXlsxOptions, filename: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Invoice Working", { views: [{ state: "frozen", ySplit: 6 }] });
  ws.columns = [
    { width: 16 }, { width: 10 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 24 },
  ];

  ws.mergeCells("A1:J1");
  const t = ws.getCell("A1"); t.value = `RULE 43 WORKING — ${opts.invoiceNo || "(no #)"}`; applyTitleRow(t);
  ws.getRow(1).height = 26;
  ws.mergeCells("A2:J2");
  const sub = ws.getCell("A2");
  sub.value = `${opts.asset || ""} · ${opts.supplier || ""} · ${opts.filterTitle}`;
  sub.font = { italic: true, color: { argb: HEADER_GREY }, size: 11 };
  sub.alignment = { horizontal: "center" };
  ws.getRow(2).height = 20;

  const sumRows: Array<[string, number]> = [
    ["Total ITC (incl. CN/DN adj.)", opts.totalItc],
    ["Total Reversal", opts.totalReversal],
    ["Net ITC Retained", opts.totalRetained],
  ];
  let r = 4;
  for (const [label, value] of sumRows) {
    const c1 = ws.getCell(`A${r}`); c1.value = label; applySubhead(c1);
    ws.mergeCells(`A${r}:D${r}`);
    const c2 = ws.getCell(`E${r}`); c2.value = value; applyMoneyFormat(c2);
    c2.font = { bold: true, color: { argb: label.startsWith("Total Reversal") ? "FFB91C1C" : label.startsWith("Net ITC") ? "FF15803D" : HEADER_GREY } };
    r++;
  }
  r++;

  const headers = ["Period", "Ratio %", "Tm (monthly)", "IGST Rev.", "CGST Rev.", "SGST Rev.", "Total Rev.", "Retained", "Cum. Rev.", "Note"];
  headers.forEach((h, i) => { const c = ws.getCell(r, i + 1); c.value = h; applyHeader(c); });
  ws.getRow(r).height = 30;
  r++;

  opts.rows.forEach((row, i) => {
    ws.getCell(r, 1).value = periodLabel(row.period);
    ws.getCell(r, 2).value = row.ratio * 100;
    ws.getCell(r, 3).value = row.monthlyItc;
    ws.getCell(r, 4).value = row.igst;
    ws.getCell(r, 5).value = row.cgst;
    ws.getCell(r, 6).value = row.sgst;
    ws.getCell(r, 7).value = row.reversal;
    ws.getCell(r, 8).value = row.retained;
    ws.getCell(r, 9).value = row.cumReversal;
    ws.getCell(r, 10).value = row.note ?? "";
    [3, 4, 5, 6, 7, 8, 9].forEach((col) => applyMoneyFormat(ws.getCell(r, col)));
    ws.getCell(r, 2).numFmt = '0.00"%"';
    ws.getCell(r, 2).alignment = { horizontal: "right" };
    ws.getCell(r, 7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: REVERSAL_RED } };
    ws.getCell(r, 7).font = { color: { argb: "FFB91C1C" }, bold: true };
    ws.getCell(r, 8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: RETAINED_GREEN } };
    ws.getCell(r, 8).font = { color: { argb: "FF15803D" }, bold: true };
    applyZebra(ws.getRow(r), i % 2 === 1);
    rowBorders(ws, r, 10);
    r++;
  });

  // Final TOTALS row across all months
  if (opts.rows.length > 0) {
    const sumTm   = opts.rows.reduce((s, x) => s + x.monthlyItc, 0);
    const sumIgst = opts.rows.reduce((s, x) => s + x.igst, 0);
    const sumCgst = opts.rows.reduce((s, x) => s + x.cgst, 0);
    const sumSgst = opts.rows.reduce((s, x) => s + x.sgst, 0);
    const sumRev  = opts.rows.reduce((s, x) => s + x.reversal, 0);
    const sumRet  = opts.rows.reduce((s, x) => s + x.retained, 0);
    const lastCum = opts.rows[opts.rows.length - 1].cumReversal;

    ws.mergeCells(`A${r}:B${r}`);
    const lbl = ws.getCell(r, 1);
    lbl.value = `TOTAL (${opts.rows.length} months)`;
    lbl.font = { bold: true, color: { argb: "FFFFFFFF" } };
    lbl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_GREY } };
    lbl.alignment = { horizontal: "right", vertical: "middle" };

    const writeTot = (col: number, val: number, color?: string) => {
      const c = ws.getCell(r, col); c.value = val; applyMoneyFormat(c);
      c.font = { bold: true, color: { argb: color ?? HEADER_GREY } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUBHEAD_GREY } };
    };
    writeTot(3, sumTm);
    writeTot(4, sumIgst, "FFB91C1C");
    writeTot(5, sumCgst, "FFB91C1C");
    writeTot(6, sumSgst, "FFB91C1C");
    writeTot(7, sumRev,  "FFB91C1C");
    writeTot(8, sumRet,  "FF15803D");
    writeTot(9, lastCum);
    ws.getCell(r, 10).value = "";
    ws.getCell(r, 10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUBHEAD_GREY } };
    rowBorders(ws, r, 10);
    r++;
  }

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

// ---------- Register summary ----------
export interface RegisterXlsxRow {
  invoiceNo: string;
  date: string;
  asset: string;
  supplier: string;
  gstin?: string;
  taxableValue: number;
  netItc: number;
  igstRev: number;
  cgstRev: number;
  sgstRev: number;
  retained: number;
  status: string;
}
export async function exportRegisterXlsx(
  opts: { rows: RegisterXlsxRow[]; blockedRows?: BlockedRow[]; totalBlockedItc?: number },
  filename: string,
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Capital Goods Register", { views: [{ state: "frozen", ySplit: 3 }] });
  ws.columns = [
    { width: 16 }, { width: 14 }, { width: 26 }, { width: 24 }, { width: 18 }, { width: 16 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 22 },
  ];
  ws.mergeCells("A1:L1");
  const t = ws.getCell("A1"); t.value = "CAPITAL GOODS REGISTER"; applyTitleRow(t);
  ws.getRow(1).height = 26;

  const headers = ["Invoice No", "Date", "Asset", "Supplier", "GSTIN", "Taxable Value",
    "Net ITC", "IGST Rev.", "CGST Rev.", "SGST Rev.", "Retained", "Status"];
  headers.forEach((h, i) => { const c = ws.getCell(3, i + 1); c.value = h; applyHeader(c); });
  ws.getRow(3).height = 30;

  opts.rows.forEach((row, i) => {
    const rr = 4 + i;
    ws.getCell(rr, 1).value = row.invoiceNo || "—";
    ws.getCell(rr, 2).value = row.date || "—";
    ws.getCell(rr, 3).value = row.asset;
    ws.getCell(rr, 4).value = row.supplier;
    ws.getCell(rr, 5).value = row.gstin || "—";
    ws.getCell(rr, 6).value = row.taxableValue;
    ws.getCell(rr, 7).value = row.netItc;
    ws.getCell(rr, 8).value = row.igstRev;
    ws.getCell(rr, 9).value = row.cgstRev;
    ws.getCell(rr, 10).value = row.sgstRev;
    ws.getCell(rr, 11).value = row.retained;
    ws.getCell(rr, 12).value = row.status;
    [6, 7, 8, 9, 10, 11].forEach((col) => applyMoneyFormat(ws.getCell(rr, col)));
    ws.getCell(rr, 7).font = { bold: true };
    ws.getCell(rr, 11).fill = { type: "pattern", pattern: "solid", fgColor: { argb: RETAINED_GREEN } };
    ws.getCell(rr, 11).font = { color: { argb: "FF15803D" }, bold: true };
    applyZebra(ws.getRow(rr), i % 2 === 1);
    rowBorders(ws, rr, 12);
  });

  if (opts.blockedRows && opts.blockedRows.length > 0) {
    addBlockedSheet(wb, opts.blockedRows, opts.totalBlockedItc ?? 0);
  }

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

// ---------- Standalone Blocked Credit (Section 17(5)) report ----------
export async function exportBlockedCreditXlsx(
  opts: { filterTitle: string; rows: BlockedRow[]; totalBlockedItc: number },
  filename: string,
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Blocked Credit (17(5))", { views: [{ state: "frozen", ySplit: 5 }] });
  ws.columns = [
    { width: 14 }, { width: 18 }, { width: 26 }, { width: 28 },
    { width: 16 }, { width: 10 }, { width: 16 }, { width: 32 },
  ];
  ws.mergeCells("A1:H1");
  const t = ws.getCell("A1"); t.value = "BLOCKED CREDIT — Section 17(5)"; applyTitleRow(t);
  ws.getRow(1).height = 26;
  ws.mergeCells("A2:H2");
  const sub = ws.getCell("A2"); sub.value = opts.filterTitle;
  sub.font = { italic: true, color: { argb: HEADER_GREY }, size: 11 };
  sub.alignment = { horizontal: "center" };
  ws.getRow(2).height = 20;

  const sumLabel = ws.getCell("A4"); sumLabel.value = "Total Blocked ITC (ineligible)"; applySubhead(sumLabel);
  ws.mergeCells("A4:D4");
  const sumVal = ws.getCell("E4"); sumVal.value = opts.totalBlockedItc; applyMoneyFormat(sumVal);
  sumVal.font = { bold: true, color: { argb: "FFB91C1C" } };

  const headers = ["Date", "Invoice No", "Party Name", "Asset", "Taxable Value", "GST %", "Blocked ITC", "Reason / Notes"];
  headers.forEach((h, i) => { const c = ws.getCell(6, i + 1); c.value = h; applyHeader(c); });
  ws.getRow(6).height = 30;

  opts.rows.forEach((row, i) => {
    const rr = 7 + i;
    ws.getCell(rr, 1).value = row.date;
    ws.getCell(rr, 2).value = row.invoiceNo;
    ws.getCell(rr, 3).value = row.partyName;
    ws.getCell(rr, 4).value = row.asset;
    ws.getCell(rr, 5).value = row.taxableValue;
    ws.getCell(rr, 6).value = row.gstPercent;
    ws.getCell(rr, 7).value = row.blockedItc;
    ws.getCell(rr, 8).value = row.reason ?? "";
    [5, 7].forEach((col) => applyMoneyFormat(ws.getCell(rr, col)));
    ws.getCell(rr, 6).numFmt = '0.00"%"';
    ws.getCell(rr, 7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: REVERSAL_RED } };
    ws.getCell(rr, 7).font = { color: { argb: "FFB91C1C" }, bold: true };
    applyZebra(ws.getRow(rr), i % 2 === 1);
    rowBorders(ws, rr, 8);
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

// ---------- Import template ----------
// Headers are placed in ROW 1 (no merged title rows above) so the file can be
// re-imported as either .xlsx OR .csv (Excel "Save As CSV") without the parser
// confusing a title for the header row. Field names match the in-app form
// labels exactly, and the parser also accepts many synonyms.
export async function downloadImportTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Rule 43 ITC Calculator";
  wb.created = new Date();

  // ---- Sheet 1: Field Reference (guidance only — now first!) ----
  const legend = wb.addWorksheet("Field Reference");
  legend.columns = [{ width: 22 }, { width: 16 }, { width: 78 }];
  legend.mergeCells("A1:C1");
  const lt = legend.getCell("A1");
  lt.value = "FIELD REFERENCE — Rule 43 ITC Import Template";
  applyTitleRow(lt);
  legend.getRow(1).height = 26;

  ["Field", "Required?", "Description / accepted values"].forEach((h, i) => {
    const c = legend.getCell(2, i + 1); c.value = h; applyHeader(c);
  });
  legend.getRow(2).height = 24;

  const notes: Array<[string, string, string]> = [
    ["Invoice Number",  "Optional", "Supplier's invoice number (free text). Leave blank if unknown."],
    ["Purchase Date",   "REQUIRED", "Use DD-MM-YYYY format (e.g. 15-04-2025). Excel date cells are also accepted."],
    ["Supplier",        "Optional", "Vendor / party name. Aliases accepted: Party, Vendor, Seller."],
    ["Supplier GSTIN",  "Optional", "GSTIN of the supplier (15-character alphanumeric uppercase standard format)."],
    ["Item Type",       "Optional", "Either 'input' (Rule 42), 'service' (Rule 42), or 'capital_good' (Rule 43). Default = capital_good."],
    ["Asset / Description", "Optional", "Description of the good/service. Aliases accepted: Asset, Machine, Item, Description."],
    ["Taxable Value",   "REQUIRED", "Value before GST, in rupees. Numbers only (commas / ₹ are stripped automatically)."],
    ["IGST Rate",       "Optional", "Inter-state purchases. Use a percentage number (e.g. 18). If using IGST, set CGST=0 and SGST=0."],
    ["CGST Rate",       "Optional", "Intra-state purchases (Central GST). Typically half of the total GST."],
    ["SGST Rate",       "Optional", "Intra-state purchases (State / UT GST). The other half. If using CGST+SGST, set IGST=0."],
    ["Usage",           "Optional", "For Rule 43: 'common', 'taxable', 'exempt'. For Rule 42: 'common', 'taxable', 'exempt', or 'non-business' (personal/non-business use). Default = common."],
    ["Block Credit",    "Optional", 'Yes/No. Set "Yes" for Section 17(5) ineligible credit (motor vehicles, food, club memberships, etc.).'],
    ["Notes",           "Optional", "Any additional remarks."],
  ];
  notes.forEach(([k, req, v], i) => {
    const r = 3 + i;
    const a = legend.getCell(r, 1); a.value = k; applySubhead(a);
    const b = legend.getCell(r, 2); b.value = req;
    if (req === "REQUIRED") {
      b.font = { bold: true, color: { argb: "FFEF4444" } }; // red text
    } else {
      b.font = { color: { argb: "FF6B7280" } }; // grey text
    }
    b.alignment = { horizontal: "center" };
    const c = legend.getCell(r, 3); c.value = v; c.alignment = { wrapText: true };
    applyZebra(legend.getRow(r), i % 2 === 1);
    rowBorders(legend, r, 3);
  });

  // ---- Sheet 2: Invoices (the actual template — now second!) ----
  const ws = wb.addWorksheet("Invoices", { views: [{ state: "frozen", ySplit: 1 }] });
  const cols = [
    { header: "Invoice Number",   key: "invoiceNo",     width: 18 },
    { header: "Purchase Date",    key: "purchaseDate",  width: 16 },
    { header: "Supplier",         key: "supplier",      width: 26 },
    { header: "Supplier GSTIN",   key: "gstin",         width: 18 },
    { header: "Item Type",        key: "itemType",      width: 16 },
    { header: "Asset / Description", key: "assetName",  width: 28 },
    { header: "Taxable Value",    key: "taxableValue",  width: 16 },
    { header: "IGST Rate",        key: "igstRate",      width: 12 },
    { header: "CGST Rate",        key: "cgstRate",      width: 12 },
    { header: "SGST Rate",        key: "sgstRate",      width: 12 },
    { header: "Usage",            key: "usage",         width: 14 },
    { header: "Block Credit",     key: "blockCredit",   width: 14 },
    { header: "Notes",            key: "notes",         width: 30 },
  ];
  ws.columns = cols.map((c) => ({ width: c.width }));

  // Header row at ROW 1 — no title above, so CSV exports stay parseable
  cols.forEach((col, i) => {
    const c = ws.getCell(1, i + 1);
    c.value = col.header;
    applyHeader(c);
  });
  ws.getRow(1).height = 30;

  const samples: Array<Record<string, string | number>> = [
    { invoiceNo: "INV-001", purchaseDate: "15-04-2025", supplier: "Acme Industries", gstin: "27AAAAA1111A1Z1", itemType: "capital_good", assetName: "CNC Machine",   taxableValue: 500000, igstRate: 0,  cgstRate: 9,  sgstRate: 9,  usage: "common",  blockCredit: "No",  notes: "" },
    { invoiceNo: "INV-002", purchaseDate: "10-05-2025", supplier: "Steel Mart",      gstin: "27BBBBB2222B2Z2", itemType: "capital_good", assetName: "Forklift",      taxableValue: 250000, igstRate: 18, cgstRate: 0,  sgstRate: 0,  usage: "common",  blockCredit: "No",  notes: "Inter-state" },
    { invoiceNo: "INV-003", purchaseDate: "01-06-2025", supplier: "Auto World",      gstin: "27CCCCC3333C3Z3", itemType: "capital_good", assetName: "Company Car",   taxableValue: 800000, igstRate: 0,  cgstRate: 14, sgstRate: 14, usage: "common",  blockCredit: "Yes", notes: "Sec 17(5)(a) — motor vehicle" },
    { invoiceNo: "INV-004", purchaseDate: "22-07-2025", supplier: "Global Consulting", gstin: "",                itemType: "service",      assetName: "Legal Services",  taxableValue: 75000,  igstRate: 0,  cgstRate: 9,  sgstRate: 9,  usage: "common",  blockCredit: "No",  notes: "Rule 42 item" },
    { invoiceNo: "INV-005", purchaseDate: "25-07-2025", supplier: "Raw Materials Inc", gstin: "",                itemType: "input",        assetName: "Aluminium Sheets", taxableValue: 120000, igstRate: 18, cgstRate: 0,  sgstRate: 0,  usage: "taxable", blockCredit: "No",  notes: "Rule 42 item" },
  ];
  samples.forEach((s, i) => {
    const rr = 2 + i;
    cols.forEach((col, ci) => {
      const cell = ws.getCell(rr, ci + 1);
      cell.value = (s as Record<string, string | number>)[col.key] ?? "";
      if (col.key === "taxableValue") applyMoneyFormat(cell);
      if (["igstRate","cgstRate","sgstRate"].includes(col.key)) {
        cell.numFmt = '0.00';
        cell.alignment = { horizontal: "right" };
      }
    });
    applyZebra(ws.getRow(rr), i % 2 === 1);
    rowBorders(ws, rr, cols.length);
  });

  // Tip row
  const tipRow = 3 + notes.length + 1;
  legend.mergeCells(`A${tipRow}:C${tipRow}`);
  const tip = legend.getCell(`A${tipRow}`);
  tip.value = 'Tip: only "Purchase Date" and "Taxable Value" are mandatory. The importer auto-detects the header row, so extra title / blank rows above the headers are tolerated. The header row is matched case-insensitively and ignores punctuation, so variants like "Invoice No", "Inv #", "Date (YYYY-MM-DD)", "IGST Rate %", "Supplier / Party" all work.';
  tip.font = { italic: true, color: { argb: HEADER_GREY }, size: 10 };
  tip.alignment = { wrapText: true, vertical: "top" };
  legend.getRow(tipRow).height = 60;

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "rule43-import-template.xlsx");
}

export async function exportRule42Xlsx(
  opts: {
    filterTitle: string;
    totalT: number;
    totalReversal: number;
    totalEligible: number;
    rows: any[];
  },
  filename: string,
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Rule 42 ITC Calculator";
  wb.created = new Date();

  const TOTAL_COLS = 12;
  const ws = wb.addWorksheet("Rule 42 Monthly Apportionment", { views: [{ state: "frozen", ySplit: 6 }] });
  ws.columns = [
    { width: 14 }, // Month
    { width: 16 }, // T
    { width: 14 }, // T1
    { width: 14 }, // T2
    { width: 14 }, // T3
    { width: 16 }, // C1
    { width: 14 }, // T4
    { width: 16 }, // C2
    { width: 12 }, // Ratio
    { width: 16 }, // D1
    { width: 16 }, // D2
    { width: 18 }, // Net Eligible
  ];

  ws.mergeCells("A1:L1");
  const t = ws.getCell("A1"); t.value = "RULE 42 REPORT SUMMARY (INPUTS & SERVICES)"; applyTitleRow(t);
  ws.getRow(1).height = 26;

  ws.mergeCells("A2:L2");
  const sub = ws.getCell("A2"); sub.value = opts.filterTitle;
  sub.font = { italic: true, color: { argb: HEADER_GREY }, size: 11 };
  sub.alignment = { horizontal: "center" };
  ws.getRow(2).height = 20;

  const summary = [
    ["Total Inward ITC (T)", opts.totalT],
    ["Total ITC Reversal (D1 + D2)", opts.totalReversal],
    ["Net Eligible ITC Claimed", opts.totalEligible],
  ];
  let r = 4;
  for (const [label, value] of summary) {
    const c1 = ws.getCell(`A${r}`); c1.value = label; applySubhead(c1);
    ws.mergeCells(`A${r}:D${r}`);
    const c2 = ws.getCell(`E${r}`); c2.value = value;
    if (typeof value === "number") {
      applyMoneyFormat(c2);
      c2.font = {
        bold: true,
        color: {
          argb: label.includes("Reversal") ? "FFB91C1C" : label.includes("Net") ? "FF15803D" : HEADER_GREY
        }
      };
    }
    r++;
  }
  r++;

  const headers = [
    "Month", "Total ITC (T)", "Non-Bus (T1)", "Exempt (T2)", "Blocked (T3)",
    "Ledger (C1)", "Taxable (T4)", "Common (C2)", "Ratio (E/F)",
    "Exempt Rev (D1)", "Non-Bus Rev (D2)", "Net Eligible"
  ];
  headers.forEach((h, i) => {
    const c = ws.getCell(r, i + 1); c.value = h; applyHeader(c);
  });
  ws.getRow(r).height = 30;
  r++;

  opts.rows.forEach((row, i) => {
    const tVal = (row.totalItc.igst + row.totalItc.cgst + row.totalItc.sgst) || 0;
    const t1Val = (row.t1.igst + row.t1.cgst + row.t1.sgst) || 0;
    const t2Val = (row.t2.igst + row.t2.cgst + row.t2.sgst) || 0;
    const t3Val = (row.t3.igst + row.t3.cgst + row.t3.sgst) || 0;
    const c1Val = (row.c1.igst + row.c1.cgst + row.c1.sgst) || 0;
    const t4Val = (row.t4.igst + row.t4.cgst + row.t4.sgst) || 0;
    const c2Val = (row.c2.igst + row.c2.cgst + row.c2.sgst) || 0;
    const d1Val = (row.d1.igst + row.d1.cgst + row.d1.sgst) || 0;
    const d2Val = (row.d2.igst + row.d2.cgst + row.d2.sgst) || 0;
    const eligVal = (row.eligibleItc.igst + row.eligibleItc.cgst + row.eligibleItc.sgst) || 0;

    ws.getCell(r, 1).value = row.monthLabel;
    ws.getCell(r, 2).value = tVal;
    ws.getCell(r, 3).value = t1Val || null;
    ws.getCell(r, 4).value = t2Val || null;
    ws.getCell(r, 5).value = t3Val || null;
    ws.getCell(r, 6).value = c1Val;
    ws.getCell(r, 7).value = t4Val || null;
    ws.getCell(r, 8).value = c2Val;
    ws.getCell(r, 9).value = row.exemptRatio;
    ws.getCell(r, 10).value = d1Val;
    ws.getCell(r, 11).value = d2Val;
    ws.getCell(r, 12).value = eligVal;

    [2, 3, 4, 5, 6, 7, 8, 10, 11, 12].forEach((col) => applyMoneyFormat(ws.getCell(r, col)));
    ws.getCell(r, 9).numFmt = '0.00"%"';
    ws.getCell(r, 9).alignment = { horizontal: "right" };

    [10, 11].forEach((col) => {
      ws.getCell(r, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: REVERSAL_RED } };
      ws.getCell(r, col).font = { color: { argb: "FFB91C1C" }, bold: true };
    });
    ws.getCell(r, 12).fill = { type: "pattern", pattern: "solid", fgColor: { argb: RETAINED_GREEN } };
    ws.getCell(r, 12).font = { color: { argb: "FF15803D" }, bold: true };

    applyZebra(ws.getRow(r), i % 2 === 1);
    rowBorders(ws, r, TOTAL_COLS);
    r++;
  });

  const totalRow = r;
  ws.getCell(totalRow, 1).value = "TOTAL";
  const tot = (col: number, val: number, color?: string) => {
    const c = ws.getCell(totalRow, col); c.value = val; applyMoneyFormat(c);
    c.font = { bold: true, color: color ? { argb: color } : undefined };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUBHEAD_GREY } };
  };

  const getSum = (field: string) => {
    return opts.rows.reduce((sum, row) => {
      const f = row[field];
      return sum + (f.igst + f.cgst + f.sgst || 0);
    }, 0);
  };

  tot(2, getSum("totalItc"));
  tot(3, getSum("t1"), "FFB91C1C");
  tot(4, getSum("t2"), "FFB91C1C");
  tot(5, getSum("t3"), "FFB91C1C");
  tot(6, getSum("c1"));
  tot(7, getSum("t4"), "FF15803D");
  tot(8, getSum("c2"));
  
  ws.getCell(totalRow, 9).value = "";
  ws.getCell(totalRow, 9).fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUBHEAD_GREY } };

  tot(10, getSum("d1"), "FFB91C1C");
  tot(11, getSum("d2"), "FFB91C1C");
  tot(12, getSum("eligibleItc"), "FF15803D");

  const tcell = ws.getCell(totalRow, 1);
  tcell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  tcell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_GREY } };
  tcell.alignment = { horizontal: "right" };

  rowBorders(ws, totalRow, TOTAL_COLS);

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

export async function exportRule42ReconXlsx(
  opts: {
    fyLabel: string;
    recon: any;
  },
  filename: string,
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Rule 42 ITC Calculator";
  wb.created = new Date();

  const ws = wb.addWorksheet("Rule 42 Annual Reconciliation", { views: [{ state: "frozen", ySplit: 4 }] });
  ws.columns = [
    { width: 36 }, // Calculation Item
    { width: 16 }, // IGST
    { width: 16 }, // CGST
    { width: 16 }, // SGST
    { width: 18 }, // Total
  ];

  ws.mergeCells("A1:E1");
  const t = ws.getCell("A1"); t.value = `RULE 42 ANNUAL APPORTIONMENT RECALCULATION — FY ${opts.fyLabel}`; t.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } }; t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } }; t.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 26;

  ws.mergeCells("A2:E2");
  const sub = ws.getCell("A2");
  const variance = opts.recon.variance.igst + opts.recon.variance.cgst + opts.recon.variance.sgst;
  if (variance > 0.01) {
    sub.value = `Shortfall identified: Reversal required of Rs. ${variance.toFixed(2)} (Payable with 18% interest)`;
    sub.font = { italic: true, bold: true, color: { argb: "FFB91C1C" } };
  } else if (variance < -0.01) {
    sub.value = `Excess reversals identified: ITC reclaimable of Rs. ${Math.abs(variance).toFixed(2)}`;
    sub.font = { italic: true, bold: true, color: { argb: "FF15803D" } };
  } else {
    sub.value = "Perfect reconciliation — no variance found";
    sub.font = { italic: true, bold: true, color: { argb: "FF1F2937" } };
  }
  sub.alignment = { horizontal: "center" };
  ws.getRow(2).height = 20;

  const headers = ["Calculation Item", "IGST (Rs.)", "CGST (Rs.)", "SGST (Rs.)", "Total (Rs.)"];
  headers.forEach((h, i) => { const c = ws.getCell(4, i + 1); c.value = h; applyHeader(c); });
  ws.getRow(4).height = 30;

  const r = opts.recon;
  const sumC2 = r.annualC2.igst + r.annualC2.cgst + r.annualC2.sgst;
  const sumReqD1 = r.requiredD1.igst + r.requiredD1.cgst + r.requiredD1.sgst;
  const sumReqD2 = r.requiredD2.igst + r.requiredD2.cgst + r.requiredD2.sgst;
  const sumReqReversal = r.requiredTotalReversal.igst + r.requiredTotalReversal.cgst + r.requiredTotalReversal.sgst;
  const sumActualReversed = r.sumMonthlyReversed.igst + r.sumMonthlyReversed.cgst + r.sumMonthlyReversed.sgst;
  const sumVariance = r.variance.igst + r.variance.cgst + r.variance.sgst;

  const rowsData = [
    { label: "Annual Common Credit (C2)", igst: r.annualC2.igst, cgst: r.annualC2.cgst, sgst: r.annualC2.sgst, total: sumC2 },
    { label: "Annual Exempt Supplies Turnover (E)", igst: null, cgst: null, sgst: null, total: r.annualExemptTurnover, isText: true, text: "FY Exempt Turnover" },
    { label: "Annual Total Supplies Turnover (F)", igst: null, cgst: null, sgst: null, total: r.annualTotalTurnover, isText: true, text: "FY Total Turnover" },
    { label: "Annual Exempt Turnover Ratio (E/F)", igst: null, cgst: null, sgst: null, total: r.annualExemptRatio * 100, isPercent: true, isText: true, text: "FY Ratio" },
    { label: "Annual Required Exempt Reversal (D1)", igst: r.requiredD1.igst, cgst: r.requiredD1.cgst, sgst: r.requiredD1.sgst, total: sumReqD1, isReversal: true },
    { label: "Annual Required Personal Reversal (D2 - 5%)", igst: r.requiredD2.igst, cgst: r.requiredD2.cgst, sgst: r.requiredD2.sgst, total: sumReqD2, isReversal: true },
    { label: "Annual Required Total Reversal (D1+D2)", igst: r.requiredTotalReversal.igst, cgst: r.requiredTotalReversal.cgst, sgst: r.requiredTotalReversal.sgst, total: sumReqReversal, isBold: true },
    { label: "Actual Monthly Reversals Sum", igst: r.sumMonthlyReversed.igst, cgst: r.sumMonthlyReversed.cgst, sgst: r.sumMonthlyReversed.sgst, total: sumActualReversed, isMuted: true },
    { label: "Final Reversal Variance (Shortfall / Excess)", igst: r.variance.igst, cgst: r.variance.cgst, sgst: r.variance.sgst, total: sumVariance, isVariance: true },
  ];

  rowsData.forEach((row, i) => {
    const rr = 5 + i;
    ws.getCell(rr, 1).value = row.label;
    
    if (row.isText) {
      ws.mergeCells(`B${rr}:D${rr}`);
      const txtCell = ws.getCell(rr, 2);
      txtCell.value = row.text;
      txtCell.font = { italic: true, color: { argb: "FF6B7280" } };
      txtCell.alignment = { horizontal: "center", vertical: "middle" };
      
      const totCell = ws.getCell(rr, 5);
      totCell.value = row.total;
      if (row.isPercent) {
        totCell.numFmt = '0.00"%"';
        totCell.font = { bold: true, color: { argb: "FF0F766E" } };
      } else {
        applyMoneyFormat(totCell);
        totCell.font = { bold: true };
      }
    } else {
      ws.getCell(rr, 2).value = row.igst;
      ws.getCell(rr, 3).value = row.cgst;
      ws.getCell(rr, 4).value = row.sgst;
      ws.getCell(rr, 5).value = row.total;
      
      [2, 3, 4, 5].forEach((col) => applyMoneyFormat(ws.getCell(rr, col)));
      
      if (row.isReversal) {
        [2, 3, 4, 5].forEach((col) => {
          ws.getCell(rr, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: REVERSAL_RED } };
          ws.getCell(rr, col).font = { color: { argb: "FFB91C1C" }, bold: col === 5 };
        });
      } else if (row.isBold) {
        [2, 3, 4, 5].forEach((col) => {
          ws.getCell(rr, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUBHEAD_GREY } };
          ws.getCell(rr, col).font = { bold: true };
        });
      } else if (row.isMuted) {
        [2, 3, 4, 5].forEach((col) => {
          ws.getCell(rr, col).font = { color: { argb: "FF6B7280" } };
        });
      } else if (row.isVariance) {
        const isShort = row.total > 0.01;
        const color = isShort ? "FFB91C1C" : "FF15803D";
        const bgColor = isShort ? REVERSAL_RED : RETAINED_GREEN;
        [2, 3, 4, 5].forEach((col) => {
          ws.getCell(rr, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
          ws.getCell(rr, col).font = { bold: true, color: { argb: color } };
        });
      }
    }

    if (row.isVariance) {
      ws.getCell(rr, 1).font = { bold: true };
    }
    
    applyZebra(ws.getRow(rr), i % 2 === 1);
    rowBorders(ws, rr, 5);
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

