import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip as RTooltip, CartesianGrid, Legend,
} from "recharts";
import { Download, Printer, AlertCircle, ShieldAlert, Check, ChevronsUpDown } from "lucide-react";
import {
  type Invoice, type MonthlyTurnover, type Rule43Result,
  computeInvoice, consolidate, formatINR, formatINRPrecise, totalGstRate,
  type GstAmounts, type Rule42MonthResult, type Rule42AnnualReconciliation,
  computeRule42Month, reconcileRule42Annual,
} from "@/lib/rule43";
import {
  exportRule43Xlsx, exportInvoiceXlsx, exportRegisterXlsx, exportBlockedCreditXlsx,
  exportRule42Xlsx, exportRule42ReconXlsx,
  periodLabel, type DetailedRow, type BlockedRow,
} from "@/lib/excel";
import {
  exportRule43Pdf, exportInvoicePdf, exportRegisterPdf, exportBlockedCreditPdf,
  exportRule42Pdf, exportRule42ReconPdf
} from "@/lib/pdf";
import { ExportOptionsDialog } from "@/components/ExportOptionsDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Props {
  invoices: Invoice[];
  turnover: Record<string, MonthlyTurnover>;
}

/** Build a default filter from the latest invoice/turnover data (most recent FY). */
function defaultFilter(invoices: Invoice[]): ReportFilter {
  const dates = invoices.map((i) => i.purchaseDate).filter(Boolean).map((d) => new Date(d!));
  const latest = dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : new Date();
  return { mode: "year", fy: fyStartYear(latest), month: "Apr" };
}

const STATUS_LABEL: Record<Rule43Result["status"], { label: string; tone: string }> = {
  active: { label: "Active", tone: "bg-primary/15 text-primary border-primary/30" },
  disposed: { label: "Disposed", tone: "bg-destructive/15 text-destructive border-destructive/30" },
  "fully-amortized": { label: "Fully amortized", tone: "bg-muted text-muted-foreground border" },
  "exempt-only": { label: "Exempt — no ITC", tone: "bg-destructive/15 text-destructive border-destructive/30" },
  "taxable-only": { label: "Taxable — full ITC", tone: "bg-primary/15 text-primary border-primary/30" },
  incomplete: { label: "Incomplete", tone: "bg-muted text-muted-foreground border" },
  "block-credit": { label: "Block credit u/s 17(5)", tone: "bg-destructive/15 text-destructive border-destructive/30" },
};

// ---------- Filter / Financial Year helpers --------------------------
const MONTH_NAMES = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
const MONTH_INDEX: Record<string, number> = { Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11, Jan:0, Feb:1, Mar:2 };

/** Returns the Indian financial year start year for a given Date (Apr–Mar). */
function fyStartYear(d: Date): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}
function fyLabel(y: number): string { return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; }

type FilterMode = "year" | "month" | "range";
interface ReportFilter {
  mode: FilterMode;
  fy: number;        // FY start year (e.g. 2024 = FY 2024-25)
  month: string;     // "Apr".."Mar"
  from?: string;     // YYYY-MM-DD
  to?: string;       // YYYY-MM-DD
}

function inFilter(rowDate: Date, f: ReportFilter): boolean {
  if (f.mode === "year") return fyStartYear(rowDate) === f.fy;
  if (f.mode === "month") {
    if (fyStartYear(rowDate) !== f.fy) return false;
    return rowDate.getMonth() === MONTH_INDEX[f.month];
  }
  // range
  if (!f.from || !f.to) return true;
  const rk = `${rowDate.getFullYear()}-${String(rowDate.getMonth()+1).padStart(2,"0")}`;
  const fk = f.from.slice(0,7);
  const tk = f.to.slice(0,7);
  return rk >= fk && rk <= tk;
}

function filterTitle(f: ReportFilter): string {
  if (f.mode === "year") return `Full Financial Year ${fyLabel(f.fy)}`;
  if (f.mode === "month") return `${f.month} ${f.fy + (MONTH_INDEX[f.month] >= 3 ? 0 : 1)}, FY ${fyLabel(f.fy)}`;
  return `Custom Range ${f.from ?? "?"} → ${f.to ?? "?"}`;
}

function filterFilenameSuffix(f: ReportFilter): string {
  if (f.mode === "year") return `FY-${fyLabel(f.fy)}`;
  if (f.mode === "month") return `${f.month}-FY-${fyLabel(f.fy)}`;
  return `range-${(f.from ?? "").slice(0,7)}_to_${(f.to ?? "").slice(0,7)}`;
}

/** Last calendar date covered by the current filter window. */
function filterEndDate(f: ReportFilter): Date {
  if (f.mode === "year") return new Date(f.fy + 1, 2, 31, 23, 59, 59);
  if (f.mode === "month") {
    const idx = MONTH_INDEX[f.month];
    const y = idx >= 3 ? f.fy : f.fy + 1;
    return new Date(y, idx + 1, 0, 23, 59, 59); // last day of that month
  }
  if (f.to) return new Date(f.to);
  return new Date(8640000000000000);
}

function Rule42MonthlyReport({
  invoices, turnover, filter, setFilter,
}: {
  invoices: Invoice[];
  turnover: Record<string, MonthlyTurnover>;
  filter: ReportFilter;
  setFilter: (f: ReportFilter) => void;
}) {
  const allMonths = useMemo(() => {
    const set = new Map<string, Date>();
    for (const inv of invoices) {
      if ((inv.itemType ?? "capital_good") === "capital_good") continue;
      if (!inv.purchaseDate) continue;
      const d = new Date(inv.purchaseDate);
      if (!isNaN(d.getTime())) {
        const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        set.set(mk, new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }
    for (const k of Object.keys(turnover)) {
      const [y, m] = k.split("-").map(Number);
      if (y && m) set.set(k, new Date(y, m - 1, 1));
    }
    return Array.from(set.values()).sort((a, b) => a.getTime() - b.getTime());
  }, [invoices, turnover]);

  const rows = useMemo(() => {
    return allMonths
      .filter((d) => inFilter(d, filter))
      .map((d) => {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const t = turnover[key] ?? { exempt: 0, taxable: 0 };
        return computeRule42Month(invoices, key, t);
      });
  }, [allMonths, invoices, turnover, filter]);

  const availableYears = useMemo(() => {
    const ys = new Set<number>();
    for (const d of allMonths) ys.add(fyStartYear(d));
    if (ys.size === 0) ys.add(fyStartYear(new Date()));
    return Array.from(ys).sort((a, b) => a - b);
  }, [allMonths]);

  // Aggregate totals across months in the filter
  const totT = { igst: 0, cgst: 0, sgst: 0 };
  const totT1 = { igst: 0, cgst: 0, sgst: 0 };
  const totT2 = { igst: 0, cgst: 0, sgst: 0 };
  const totT3 = { igst: 0, cgst: 0, sgst: 0 };
  const totC1 = { igst: 0, cgst: 0, sgst: 0 };
  const totT4 = { igst: 0, cgst: 0, sgst: 0 };
  const totC2 = { igst: 0, cgst: 0, sgst: 0 };
  const totD1 = { igst: 0, cgst: 0, sgst: 0 };
  const totD2 = { igst: 0, cgst: 0, sgst: 0 };
  const totC3 = { igst: 0, cgst: 0, sgst: 0 };
  const totEligible = { igst: 0, cgst: 0, sgst: 0 };
  const totReversal = { igst: 0, cgst: 0, sgst: 0 };

  for (const r of rows) {
    for (const c of ["igst", "cgst", "sgst"] as const) {
      totT[c] += r.totalItc[c];
      totT1[c] += r.t1[c];
      totT2[c] += r.t2[c];
      totT3[c] += r.t3[c];
      totC1[c] += r.c1[c];
      totT4[c] += r.t4[c];
      totC2[c] += r.c2[c];
      totD1[c] += r.d1[c];
      totD2[c] += r.d2[c];
      totC3[c] += r.c3[c];
      totEligible[c] += r.eligibleItc[c];
      totReversal[c] += r.totalReversal[c];
    }
  }

  const sumT = totT.igst + totT.cgst + totT.sgst;
  const sumReversal = totReversal.igst + totReversal.cgst + totReversal.sgst;
  const sumEligible = totEligible.igst + totEligible.cgst + totEligible.sgst;

  const handlePdf = () => {
    const filename = `Rule-42-Apportionment-${filterFilenameSuffix(filter)}.pdf`;
    exportRule42Pdf({
      filterTitle: filterTitle(filter),
      totalT: sumT,
      totalReversal: sumReversal,
      totalEligible: sumEligible,
      rows: rows,
    }, filename);
  };

  const handleExcel = () => {
    const filename = `Rule-42-Apportionment-${filterFilenameSuffix(filter)}.xlsx`;
    exportRule42Xlsx({
      filterTitle: filterTitle(filter),
      totalT: sumT,
      totalReversal: sumReversal,
      totalEligible: sumEligible,
      rows: rows,
    }, filename);
  };

  return (
    <div className="space-y-5">
      <FilterBar filter={filter} setFilter={setFilter} availableYears={availableYears} />

      {/* Summary totals block */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground">Total Inward ITC (T)</div>
            <div className="num text-xl font-bold text-primary mt-1">{formatINR(sumT)}</div>
            <div className="text-[10px] text-muted-foreground mt-1 flex gap-2">
              <span>I:{formatINR(totT.igst)}</span>
              <span>C:{formatINR(totT.cgst)}</span>
              <span>S:{formatINR(totT.sgst)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground">Total ITC Reversal (D1 + D2)</div>
            <div className="num text-xl font-bold text-destructive mt-1">{formatINR(sumReversal)}</div>
            <div className="text-[10px] text-muted-foreground mt-1 flex gap-2">
              <span>I:{formatINR(totReversal.igst)}</span>
              <span>C:{formatINR(totReversal.cgst)}</span>
              <span>S:{formatINR(totReversal.sgst)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20 dark:bg-green-950/10">
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground">Net Eligible ITC Claimed</div>
            <div className="num text-xl font-bold text-green-700 dark:text-green-400 mt-1">{formatINR(sumEligible)}</div>
            <div className="text-[10px] text-muted-foreground mt-1 flex gap-2">
              <span>I:{formatINR(totEligible.igst)}</span>
              <span>C:{formatINR(totEligible.cgst)}</span>
              <span>S:{formatINR(totEligible.sgst)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Apportionment breakdown table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base">Rule 42 Apportionment Schedule</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Monthly calculations on Inputs &amp; Input Services</p>
          </div>
          <div className="flex gap-2 no-print">
            <Button variant="outline" size="sm" onClick={handleExcel}><Download className="h-3.5 w-3.5 mr-1.5" />Excel</Button>
            <Button variant="outline" size="sm" onClick={handlePdf}><Printer className="h-3.5 w-3.5 mr-1.5" />PDF</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[460px] overflow-y-auto w-full">
            <Table className="min-w-[1200px]">
              <TableHeader className="sticky top-0 bg-card z-20 shadow-sm">
                <TableRow>
                  <TableHead className="w-[110px]">Month</TableHead>
                  <TableHead className="text-right">Total ITC (T)</TableHead>
                  <TableHead className="text-right text-destructive">Non-Bus (T1)</TableHead>
                  <TableHead className="text-right text-destructive">Exempt (T2)</TableHead>
                  <TableHead className="text-right text-destructive">Blocked (T3)</TableHead>
                  <TableHead className="text-right font-medium">Ledger (C1)</TableHead>
                  <TableHead className="text-right text-green-600">Taxable (T4)</TableHead>
                  <TableHead className="text-right font-medium">Common (C2)</TableHead>
                  <TableHead className="text-right">Ratio (E/F)</TableHead>
                  <TableHead className="text-right text-destructive bg-destructive/5">Exempt Rev (D1)</TableHead>
                  <TableHead className="text-right text-destructive bg-destructive/5">Non-Bus Rev (D2)</TableHead>
                  <TableHead className="text-right text-green-600 font-semibold bg-green-500/5">Net Eligible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-12 text-center text-sm text-muted-foreground italic">
                      No Inputs &amp; Services found in this reporting window.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const tVal = r.totalItc.igst + r.totalItc.cgst + r.totalItc.sgst;
                    const t1Val = r.t1.igst + r.t1.cgst + r.t1.sgst;
                    const t2Val = r.t2.igst + r.t2.cgst + r.t2.sgst;
                    const t3Val = r.t3.igst + r.t3.cgst + r.t3.sgst;
                    const c1Val = r.c1.igst + r.c1.cgst + r.c1.sgst;
                    const t4Val = r.t4.igst + r.t4.cgst + r.t4.sgst;
                    const c2Val = r.c2.igst + r.c2.cgst + r.c2.sgst;
                    const d1Val = r.d1.igst + r.d1.cgst + r.d1.sgst;
                    const d2Val = r.d2.igst + r.d2.cgst + r.d2.sgst;
                    const eligVal = r.eligibleItc.igst + r.eligibleItc.cgst + r.eligibleItc.sgst;

                    return (
                      <TableRow key={r.monthKey} className="hover:bg-muted/40 text-xs">
                        <TableCell className="font-medium">{r.monthLabel}</TableCell>
                        <TableCell className="text-right num font-semibold">{formatINR(tVal)}</TableCell>
                        <TableCell className="text-right num text-destructive">{t1Val > 0 ? formatINR(t1Val) : "—"}</TableCell>
                        <TableCell className="text-right num text-destructive">{t2Val > 0 ? formatINR(t2Val) : "—"}</TableCell>
                        <TableCell className="text-right num text-destructive">{t3Val > 0 ? formatINR(t3Val) : "—"}</TableCell>
                        <TableCell className="text-right num font-medium">{formatINR(c1Val)}</TableCell>
                        <TableCell className="text-right num text-green-700 dark:text-green-400">{t4Val > 0 ? formatINR(t4Val) : "—"}</TableCell>
                        <TableCell className="text-right num font-medium">{formatINR(c2Val)}</TableCell>
                        <TableCell className="text-right num">{(r.exemptRatio * 100).toFixed(1)}%</TableCell>
                        <TableCell className="text-right num text-destructive bg-destructive/5 font-medium">{formatINRPrecise(d1Val)}</TableCell>
                        <TableCell className="text-right num text-destructive bg-destructive/5 font-medium">{formatINRPrecise(d2Val)}</TableCell>
                        <TableCell className="text-right num text-green-700 dark:text-green-400 bg-green-500/5 font-bold text-sm">{formatINRPrecise(eligVal)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Rule42AnnualReconciliationReport({
  invoices, turnover,
}: {
  invoices: Invoice[];
  turnover: Record<string, MonthlyTurnover>;
}) {
  const allMonths = useMemo(() => {
    const set = new Map<string, Date>();
    for (const inv of invoices) {
      if ((inv.itemType ?? "capital_good") === "capital_good") continue;
      if (!inv.purchaseDate) continue;
      const d = new Date(inv.purchaseDate);
      if (!isNaN(d.getTime())) {
        const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        set.set(mk, new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }
    return Array.from(set.values()).sort((a, b) => a.getTime() - b.getTime());
  }, [invoices]);

  const availableYears = useMemo(() => {
    const ys = new Set<number>();
    for (const d of allMonths) ys.add(fyStartYear(d));
    if (ys.size === 0) ys.add(fyStartYear(new Date()));
    return Array.from(ys).sort((a, b) => a - b);
  }, [allMonths]);

  const [selectedFy, setSelectedFy] = useState<number>(() => {
    return availableYears[availableYears.length - 1] ?? fyStartYear(new Date());
  });

  const recon = useMemo(() => {
    return reconcileRule42Annual(invoices, turnover, selectedFy);
  }, [invoices, turnover, selectedFy]);

  const sumC2 = recon.annualC2.igst + recon.annualC2.cgst + recon.annualC2.sgst;
  const sumReqD1 = recon.requiredD1.igst + recon.requiredD1.cgst + recon.requiredD1.sgst;
  const sumReqD2 = recon.requiredD2.igst + recon.requiredD2.cgst + recon.requiredD2.sgst;
  const sumReqReversal = recon.requiredTotalReversal.igst + recon.requiredTotalReversal.cgst + recon.requiredTotalReversal.sgst;
  const sumActualReversed = recon.sumMonthlyReversed.igst + recon.sumMonthlyReversed.cgst + recon.sumMonthlyReversed.sgst;
  const sumVariance = recon.variance.igst + recon.variance.cgst + recon.variance.sgst;

  const isShortfall = sumVariance > 0.01;
  const isRefund = sumVariance < -0.01;

  const handleExcel = () => {
    const filename = `Rule-42-Annual-Reconciliation-FY-${recon.fyLabel}.xlsx`;
    exportRule42ReconXlsx({
      fyLabel: recon.fyLabel,
      recon: recon,
    }, filename);
  };

  const handlePdf = () => {
    const filename = `Rule-42-Annual-Reconciliation-FY-${recon.fyLabel}.pdf`;
    exportRule42ReconPdf({
      fyLabel: recon.fyLabel,
      recon: recon,
    }, filename);
  };

  return (
    <div className="space-y-5">
      <Card className="no-print">
        <CardContent className="py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-semibold">Select Financial Year</span>
            <Select value={String(selectedFy)} onValueChange={(v) => setSelectedFy(Number(v))}>
              <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>FY {fyLabel(y)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExcel}><Download className="h-3.5 w-3.5 mr-1.5" />Excel</Button>
            <Button variant="outline" size="sm" onClick={handlePdf}><Printer className="h-3.5 w-3.5 mr-1.5" />PDF</Button>
          </div>
        </CardContent>
      </Card>

      {/* Variance Alert Panel */}
      {isShortfall && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-5 flex flex-wrap items-start gap-4 justify-between">
            <div className="flex-1 space-y-1">
              <h3 className="text-base font-semibold text-destructive flex items-center gap-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                Shortfall Identified: Reversal Required (Claw-back)
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                Your aggregate annual exempt ratio is higher than the sum of monthly reversals. 
                You must **reverse the shortfall of {formatINR(sumVariance)}** in your GSTR-3B return. 
                Under Section 50(1) of the CGST Act, interest @ 18% p.a. is applicable on this shortfall from 1st April of the next FY until the date of payment.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Shortfall Amount</span>
              <div className="num text-2xl font-black text-destructive mt-1">{formatINR(sumVariance)}</div>
              <span className="text-[10px] text-destructive-foreground/70 bg-destructive/10 px-2 py-0.5 border rounded-full mt-2 inline-block font-semibold">Payable with 18% Interest</span>
            </div>
          </CardContent>
        </Card>
      )}

      {isRefund && (
        <Card className="border-green-500/40 bg-green-50/40 dark:bg-green-950/5">
          <CardContent className="py-5 flex flex-wrap items-start gap-4 justify-between">
            <div className="flex-1 space-y-1">
              <h3 className="text-base font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                <Check className="h-5 w-5 shrink-0 bg-green-100 dark:bg-green-900 rounded-full p-0.5" />
                Excess Reversals Identified: ITC Reclaimable
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                Your monthly reversals exceeded the required annual aggregate. 
                You are **eligible to reclaim {formatINR(Math.abs(sumVariance))}** as input tax credit in any GSTR-3B return filed up to September of the following financial year.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Reclaimable ITC</span>
              <div className="num text-2xl font-black text-green-700 dark:text-green-400 mt-1">{formatINR(Math.abs(sumVariance))}</div>
              <span className="text-[10px] text-green-700 dark:text-green-400 bg-green-500/10 px-2 py-0.5 border rounded-full mt-2 inline-block font-semibold">Reclaim in GSTR-3B Table 4(A)(5)</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Core Reconciliation Card */}
      <Card>
        <CardHeader><CardTitle className="text-base">Annual Apportionment Recalculation (Rule 42(2))</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {/* Component-wise breakdown table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Calculation Item</TableHead>
                  <TableHead className="text-right w-[150px]">IGST (₹)</TableHead>
                  <TableHead className="text-right w-[150px]">CGST (₹)</TableHead>
                  <TableHead className="text-right w-[150px]">SGST (₹)</TableHead>
                  <TableHead className="text-right w-[180px] font-bold">Total (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="hover:bg-muted/40 text-xs">
                  <TableCell className="font-medium">Annual Common Credit (C2)</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.annualC2.igst)}</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.annualC2.cgst)}</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.annualC2.sgst)}</TableCell>
                  <TableCell className="text-right num font-semibold">{formatINRPrecise(sumC2)}</TableCell>
                </TableRow>
                <TableRow className="hover:bg-muted/40 text-xs">
                  <TableCell className="font-medium">Annual Exempt Supplies Turnover (E)</TableCell>
                  <TableCell colSpan={3} className="text-right font-medium italic text-[11px] text-muted-foreground">FY Exempt Turnover</TableCell>
                  <TableCell className="text-right num font-semibold">{formatINR(recon.annualExemptTurnover)}</TableCell>
                </TableRow>
                <TableRow className="hover:bg-muted/40 text-xs">
                  <TableCell className="font-medium">Annual Total supplies Turnover (F)</TableCell>
                  <TableCell colSpan={3} className="text-right font-medium italic text-[11px] text-muted-foreground">FY Total Turnover</TableCell>
                  <TableCell className="text-right num font-semibold">{formatINR(recon.annualTotalTurnover)}</TableCell>
                </TableRow>
                <TableRow className="hover:bg-muted/40 text-xs">
                  <TableCell className="font-medium text-primary">Annual Exempt turnover Ratio (E/F)</TableCell>
                  <TableCell colSpan={3} className="text-right font-medium italic text-[11px] text-muted-foreground">FY Ratio</TableCell>
                  <TableCell className="text-right num font-semibold text-primary">{(recon.annualExemptRatio * 100).toFixed(2)}%</TableCell>
                </TableRow>
                <TableRow className="hover:bg-muted/40 text-destructive bg-destructive/5 text-xs">
                  <TableCell className="font-medium text-destructive">Annual Required Exempt Reversal (D1)</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.requiredD1.igst)}</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.requiredD1.cgst)}</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.requiredD1.sgst)}</TableCell>
                  <TableCell className="text-right num font-bold">{formatINRPrecise(sumReqD1)}</TableCell>
                </TableRow>
                <TableRow className="hover:bg-muted/40 text-destructive bg-destructive/5 text-xs">
                  <TableCell className="font-medium text-destructive">Annual Required Personal Reversal (D2 - 5%)</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.requiredD2.igst)}</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.requiredD2.cgst)}</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.requiredD2.sgst)}</TableCell>
                  <TableCell className="text-right num font-bold">{formatINRPrecise(sumReqD2)}</TableCell>
                </TableRow>
                <TableRow className="hover:bg-muted/40 bg-muted/20 font-semibold border-y text-xs">
                  <TableCell>Annual Required Total Reversal (D1+D2)</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.requiredTotalReversal.igst)}</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.requiredTotalReversal.cgst)}</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.requiredTotalReversal.sgst)}</TableCell>
                  <TableCell className="text-right num font-bold text-base">{formatINRPrecise(sumReqReversal)}</TableCell>
                </TableRow>
                <TableRow className="hover:bg-muted/40 bg-muted/10 text-muted-foreground text-xs">
                  <TableCell>Actual Monthly Reversals Sum</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.sumMonthlyReversed.igst)}</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.sumMonthlyReversed.cgst)}</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.sumMonthlyReversed.sgst)}</TableCell>
                  <TableCell className="text-right num font-semibold">{formatINRPrecise(sumActualReversed)}</TableCell>
                </TableRow>
                <TableRow className={`hover:bg-muted/40 font-black border-t-2 text-xs ${isShortfall ? "text-destructive bg-destructive/5" : "text-green-700 dark:text-green-400 bg-green-500/5"}`}>
                  <TableCell>Final Reversal Variance (Shortfall / Excess)</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.variance.igst)}</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.variance.cgst)}</TableCell>
                  <TableCell className="text-right num">{formatINRPrecise(recon.variance.sgst)}</TableCell>
                  <TableCell className="text-right num font-black text-base">{formatINRPrecise(sumVariance)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ResultsPanel({ invoices, turnover }: Props) {
  const [reportType, setReportType] = useState<"rule43" | "rule42">("rule43");
  const [view, setView] = useState<string>("consolidated");
  const [r42View, setR42View] = useState<string>("r42-monthly");
  const [filter, setFilter] = useState<ReportFilter>(() => defaultFilter(invoices));
  const consol = useMemo(() => consolidate(invoices, turnover), [invoices, turnover]);

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium">No invoices yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Add supply invoices in the <strong>Invoices</strong> tab to generate reports.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5 print-page">
      {/* Top Level Rule Toggle */}
      <div className="flex bg-muted/40 p-1.5 rounded-xl border gap-2 self-start w-full sm:w-auto no-print">
        {(["rule43", "rule42"] as const).map((rt) => (
          <button
            key={rt}
            type="button"
            onClick={() => setReportType(rt)}
            className={`text-xs px-5 py-2.5 rounded-lg font-semibold transition-all flex-1 sm:flex-none flex items-center gap-2 ${
              reportType === rt
                ? "bg-background text-foreground shadow-md border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {rt === "rule43" ? "Rule 43 (Capital Goods)" : "Rule 42 (Inputs & Services)"}
          </button>
        ))}
      </div>

      {reportType === "rule43" ? (
        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="consolidated">Rule 43 — Consolidated</TabsTrigger>
            <TabsTrigger value="per-invoice">Rule 43 — Per-invoice</TabsTrigger>
            <TabsTrigger value="register">Rule 43 — Register</TabsTrigger>
            <TabsTrigger value="block-credit">Sec 17(5) Blocked Credit</TabsTrigger>
          </TabsList>

          <TabsContent value="consolidated" className="mt-4">
            <ConsolidatedReport
              consol={consol}
              invoices={invoices}
              turnover={turnover}
              filter={filter}
              setFilter={setFilter}
            />
          </TabsContent>
          <TabsContent value="per-invoice" className="mt-4">
            <PerInvoiceReport invoices={invoices} turnover={turnover} />
          </TabsContent>
          <TabsContent value="register" className="mt-4">
            <RegisterSummary invoices={invoices} turnover={turnover} />
          </TabsContent>
          <TabsContent value="block-credit" className="mt-4">
            <BlockCreditReport invoices={invoices} />
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs value={r42View} onValueChange={setR42View}>
          <TabsList>
            <TabsTrigger value="r42-monthly">Rule 42 — Monthly Apportionment</TabsTrigger>
            <TabsTrigger value="r42-annual">Rule 42 — Annual Reconciliation</TabsTrigger>
          </TabsList>

          <TabsContent value="r42-monthly" className="mt-4">
            <Rule42MonthlyReport
              invoices={invoices}
              turnover={turnover}
              filter={filter}
              setFilter={setFilter}
            />
          </TabsContent>
          <TabsContent value="r42-annual" className="mt-4">
            <Rule42AnnualReconciliationReport
              invoices={invoices}
              turnover={turnover}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function FilterBar({
  filter, setFilter, availableYears,
}: {
  filter: ReportFilter;
  setFilter: (f: ReportFilter) => void;
  availableYears: number[];
}) {
  return (
    <Card className="no-print">
      <CardContent className="py-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Filter type</Label>
            <Select value={filter.mode} onValueChange={(v) => setFilter({ ...filter, mode: v as FilterMode })}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="year">Full Financial Year</SelectItem>
                <SelectItem value="month">Single Month</SelectItem>
                <SelectItem value="range">Custom Date Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(filter.mode === "year" || filter.mode === "month") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Financial Year</Label>
              <Select value={String(filter.fy)} onValueChange={(v) => setFilter({ ...filter, fy: Number(v) })}>
                <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>FY {fyLabel(y)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {filter.mode === "month" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Month</Label>
              <Select value={filter.month} onValueChange={(v) => setFilter({ ...filter, month: v })}>
                <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {filter.mode === "range" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">From</Label>
                <Input type="month" className="h-9 w-[160px]"
                  value={(filter.from ?? "").slice(0,7)}
                  onChange={(e) => setFilter({ ...filter, from: e.target.value ? `${e.target.value}-01` : undefined })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To</Label>
                <Input type="month" className="h-9 w-[160px]"
                  value={(filter.to ?? "").slice(0,7)}
                  onChange={(e) => setFilter({ ...filter, to: e.target.value ? `${e.target.value}-01` : undefined })} />
              </div>
            </>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            Showing: <span className="font-medium text-foreground">{filterTitle(filter)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Build the list of "YYYY-MM" month buckets covered by the current filter. */
function monthsInFilter(f: ReportFilter, fallbackRows: { date: Date }[]): string[] {
  const out: string[] = [];
  const push = (y: number, m0: number) => out.push(`${y}-${String(m0 + 1).padStart(2, "0")}`);
  if (f.mode === "year") {
    for (const m of MONTH_NAMES) {
      const idx = MONTH_INDEX[m];
      const y = idx >= 3 ? f.fy : f.fy + 1;
      push(y, idx);
    }
  } else if (f.mode === "month") {
    const idx = MONTH_INDEX[f.month];
    const y = idx >= 3 ? f.fy : f.fy + 1;
    push(y, idx);
  } else {
    if (f.from && f.to) {
      const [fy, fm] = f.from.slice(0, 7).split("-").map(Number);
      const [ty, tm] = f.to.slice(0, 7).split("-").map(Number);
      let y = fy, m = fm;
      while (y < ty || (y === ty && m <= tm)) {
        push(y, m - 1);
        m++; if (m > 12) { m = 1; y++; }
      }
    } else {
      // Fallback: months that actually have data
      const set = new Set(fallbackRows.map((r) => `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,"0")}`));
      out.push(...Array.from(set).sort());
    }
  }
  return out;
}

function ConsolidatedReport({
  consol, invoices, turnover, filter, setFilter,
}: {
  consol: ReturnType<typeof consolidate>;
  invoices: Invoice[];
  turnover: Record<string, MonthlyTurnover>;
  filter: ReportFilter;
  setFilter: (f: ReportFilter) => void;
}) {
  const { rows: allRows } = consol;
  const rows = useMemo(() => allRows.filter((r) => inFilter(r.date, filter)), [allRows, filter]);

  const totalReversal = rows.reduce((s, r) => s + r.totalReversal, 0);
  const igstReversal  = rows.reduce((s, r) => s + r.igstReversal, 0);
  const cgstReversal  = rows.reduce((s, r) => s + r.cgstReversal, 0);
  const sgstReversal  = rows.reduce((s, r) => s + r.sgstReversal, 0);

  const availableYears = useMemo(() => {
    const ys = new Set<number>();
    for (const r of allRows) ys.add(fyStartYear(r.date));
    for (const inv of invoices) if (inv.purchaseDate) ys.add(fyStartYear(new Date(inv.purchaseDate)));
    if (ys.size === 0) ys.add(fyStartYear(new Date()));
    return Array.from(ys).sort((a, b) => a - b);
  }, [allRows, invoices]);

  // Per-invoice schedule rows restricted to the filter window
  const perInvoice = useMemo(
    () => invoices.map((inv) => ({ inv, res: computeInvoice(inv, turnover) })),
    [invoices, turnover],
  );
  const filteredInvoiceRows = useMemo(() => {
    const out: DetailedRow[] = [];
    for (const { inv, res } of perInvoice) {
      for (const r of res.rows) {
        if (!inFilter(r.date, filter)) continue;
        out.push({
          period: `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,"0")}`,
          invoiceNo: inv.invoiceNo,
          partyName: inv.supplier,
          asset: inv.assetName,
          taxableValue: inv.taxableValue,
          gstPercent: totalGstRate(inv),
          exemptPercent: r.ratio * 100,
          eligibleItc: r.monthlyItc,
          igstReversal: r.igstReversal,
          cgstReversal: r.cgstReversal,
          sgstReversal: r.sgstReversal,
          reversal: r.reversal,
          netClaim: r.retained,
        });
      }
    }
    return out;
  }, [perInvoice, filter]);

  // Distinct invoices (non-blocked) that have any schedule row in the filter window.
  const affectedInvoices = useMemo(() => {
    const out: Array<{ inv: Invoice; res: Rule43Result }> = [];
    const fend = filterEndDate(filter);
    for (const pi of perInvoice) {
      if (pi.inv.blockCredit) continue;
      const hit = pi.res.rows.some((r) => inFilter(r.date, filter));
      if (hit) {
        out.push({ inv: pi.inv, res: pi.res });
      }
      void fend;
    }
    return out;
  }, [perInvoice, filter]);

  // Block-credit invoices whose purchase date falls in the filter window
  const blockedRows: BlockedRow[] = useMemo(() => {
    const out: BlockedRow[] = [];
    for (const inv of invoices) {
      if (!inv.blockCredit || !inv.purchaseDate) continue;
      const d = new Date(inv.purchaseDate);
      if (!inFilter(d, filter)) continue;
      const blockedItc = (inv.taxableValue || 0) * (totalGstRate(inv) / 100);
      out.push({
        date: inv.purchaseDate,
        invoiceNo: inv.invoiceNo,
        partyName: inv.supplier,
        asset: inv.assetName,
        taxableValue: inv.taxableValue,
        gstPercent: totalGstRate(inv),
        blockedItc,
        reason: inv.notes ?? "Section 17(5)",
      });
    }
    return out;
  }, [invoices, filter]);
  const totalBlockedItc = blockedRows.reduce((s, r) => s + r.blockedItc, 0);

  // Summary numbers — based on full per-invoice ITC and cumulative reversal up to the filter end.
  const totalEntries = affectedInvoices.length;
  const totalCapitalValue = affectedInvoices.reduce((s, x) => s + (x.inv.taxableValue || 0), 0);
  const totalActualItc = affectedInvoices.reduce((s, x) => s + x.res.netTotalItc, 0);
  const fEnd = filterEndDate(filter);
  const totalReversalCumulative = affectedInvoices.reduce(
    (s, x) => s + x.res.rows.filter((r) => r.date <= fEnd).reduce((a, r) => a + r.reversal, 0),
    0,
  );
  const netItcClaimed = totalActualItc - totalReversalCumulative;

  // Bar chart: ALL months in the filter window (zero-padded)
  const monthBuckets = useMemo(() => monthsInFilter(filter, rows), [filter, rows]);
  const byMonth = useMemo(() => {
    const m = new Map<string, { igst: number; cgst: number; sgst: number; reversal: number }>();
    for (const r of rows) {
      const k = `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,"0")}`;
      const e = m.get(k) ?? { igst: 0, cgst: 0, sgst: 0, reversal: 0 };
      e.igst += r.igstReversal; e.cgst += r.cgstReversal; e.sgst += r.sgstReversal; e.reversal += r.totalReversal;
      m.set(k, e);
    }
    return m;
  }, [rows]);
  const chartData = monthBuckets.map((k) => {
    const v = byMonth.get(k) ?? { igst: 0, cgst: 0, sgst: 0, reversal: 0 };
    return {
      month: periodLabel(k).split(" ")[0].slice(0, 3) + " " + periodLabel(k).split(" ")[1].slice(2),
      igst: Math.round(v.igst), cgst: Math.round(v.cgst), sgst: Math.round(v.sgst), reversal: Math.round(v.reversal),
    };
  });
  const hasIgst = igstReversal > 0;
  const hasCgst = cgstReversal > 0;
  const hasSgst = sgstReversal > 0;

  const [exportDialog, setExportDialog] = useState<null | "excel" | "pdf">(null);

  const exportOpts = (includeBlocked: boolean) => ({
    filterTitle: filterTitle(filter),
    totalEntries,
    totalCapitalGoodsValue: totalCapitalValue,
    totalActualItc,
    totalReversal: totalReversalCumulative,
    netItcClaimed,
    detailedRows: filteredInvoiceRows,
    blockedRows: includeBlocked ? blockedRows : undefined,
    totalBlockedItc: includeBlocked ? totalBlockedItc : undefined,
  });

  const handleConfirmExport = async (fmt: "excel" | "pdf", opts: { includeBlockedCredit: boolean }) => {
    const o = exportOpts(opts.includeBlockedCredit);
    if (fmt === "excel") {
      await exportRule43Xlsx(o, `rule43-${filterFilenameSuffix(filter)}.xlsx`);
    } else {
      exportRule43Pdf(o, `rule43-${filterFilenameSuffix(filter)}.pdf`);
    }
  };

  return (
    <div className="space-y-5">
      <FilterBar filter={filter} setFilter={setFilter} availableYears={availableYears} />

      {/* Reversal summary strip */}
      {totalReversal > 0 && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="text-xs font-medium mb-2 text-muted-foreground">Reversal breakdown (GSTR-3B Table 4(B)(1))</div>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <div className="text-[10px] text-muted-foreground">IGST</div>
              <div className="num font-semibold text-destructive text-base">{formatINR(igstReversal)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">CGST</div>
              <div className="num font-semibold text-orange-600 dark:text-orange-400 text-base">{formatINR(cgstReversal)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">SGST / UTGST</div>
              <div className="num font-semibold text-amber-600 dark:text-amber-400 text-base">{formatINR(sgstReversal)}</div>
            </div>
            <div className="border-l pl-8">
              <div className="text-[10px] text-muted-foreground">Total reversal</div>
              <div className="num font-semibold text-base">{formatINR(totalReversal)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Block-credit summary strip */}
      {blockedRows.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-destructive">Blocked credit u/s 17(5) — ineligible ITC</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {blockedRows.length} invoice{blockedRows.length === 1 ? "" : "s"} in this period are flagged as blocked credit. The full ITC is ineligible.
                </p>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground">Total blocked ITC</div>
                <div className="num font-semibold text-destructive text-lg">{formatINR(totalBlockedItc)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Single bar chart — all months in the filter window */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly reversal by tax type</CardTitle>
            <CardDescription className="text-xs">All months in {filterTitle(filter)}</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatINR(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {hasIgst && <Bar dataKey="igst" name="IGST" stackId="a" fill="hsl(var(--destructive))" />}
                {hasCgst && <Bar dataKey="cgst" name="CGST" stackId="a" fill="#f97316" />}
                {hasSgst && <Bar dataKey="sgst" name="SGST" stackId="a" fill="#eab308" />}
                {!hasIgst && !hasCgst && !hasSgst && <Bar dataKey="reversal" name="Reversal" fill="hsl(var(--destructive))" />}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Consolidated monthly schedule</CardTitle>
            <CardDescription className="text-xs">Rule 43 reversal by IGST / CGST / SGST — sum of all invoices</CardDescription>
          </div>
          <div className="flex gap-2 no-print">
            <Button variant="outline" size="sm" onClick={() => setExportDialog("excel")}><Download className="h-3.5 w-3.5 mr-1.5" />Excel</Button>
            <Button variant="outline" size="sm" onClick={() => setExportDialog("pdf")}><Printer className="h-3.5 w-3.5 mr-1.5" />PDF</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[420px] overflow-y-auto w-full">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-20 shadow-sm">
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Ratio</TableHead>
                  <TableHead className="text-right">Total Tm</TableHead>
                  <TableHead className="text-right text-destructive">IGST Reversal</TableHead>
                  <TableHead className="text-right text-orange-600">CGST Reversal</TableHead>
                  <TableHead className="text-right text-amber-600">SGST Reversal</TableHead>
                  <TableHead className="text-right">Total Reversal</TableHead>
                  <TableHead className="text-right">Cum. Reversal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.monthKey} className="hover:bg-muted/40">
                    <TableCell className="text-sm">{r.monthLabel}</TableCell>
                    <TableCell className="text-right num text-xs">{(r.ratio * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-right num text-xs">{formatINR(r.totalMonthlyItc)}</TableCell>
                    <TableCell className="text-right num text-xs text-destructive">{formatINRPrecise(r.igstReversal)}</TableCell>
                    <TableCell className="text-right num text-xs text-orange-600 dark:text-orange-400">{formatINRPrecise(r.cgstReversal)}</TableCell>
                    <TableCell className="text-right num text-xs text-amber-600 dark:text-amber-400">{formatINRPrecise(r.sgstReversal)}</TableCell>
                    <TableCell className="text-right num text-xs font-medium">{formatINRPrecise(r.totalReversal)}</TableCell>
                    <TableCell className="text-right num text-xs">{formatINR(r.cumReversal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ExportOptionsDialog
        open={exportDialog !== null}
        onOpenChange={(o) => { if (!o) setExportDialog(null); }}
        format={exportDialog ?? "excel"}
        hasBlockedCredits={blockedRows.length > 0}
        blockedCount={blockedRows.length}
        onConfirm={async (opts) => { if (exportDialog) await handleConfirmExport(exportDialog, opts); setExportDialog(null); }}
      />
    </div>
  );
}

function PerInvoiceReport({ invoices, turnover }: { invoices: Invoice[]; turnover: Record<string, MonthlyTurnover> }) {
  const [selected, setSelected] = useState<string>(invoices[0]?.id ?? "");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [fyFilter, setFyFilter] = useState<string>("all");
  const inv = invoices.find((i) => i.id === selected) ?? invoices[0];
  const result = useMemo(() => computeInvoice(inv, turnover), [inv, turnover]);

  if (!inv) return null;
  const status = STATUS_LABEL[result.status];

  const availableFys = useMemo(() => {
    const ys = new Set<number>();
    for (const r of result.rows) ys.add(fyStartYear(r.date));
    return Array.from(ys).sort((a, b) => a - b);
  }, [result.rows]);

  const visibleRows = useMemo(() => {
    if (fyFilter === "all") return result.rows;
    const fy = Number(fyFilter);
    return result.rows.filter((r) => fyStartYear(r.date) === fy);
  }, [result.rows, fyFilter]);

  const totalReversalShown = visibleRows.reduce((s, r) => s + r.reversal, 0);
  const totalRetainedShown = result.netTotalItc - totalReversalShown;
  const filterTitleStr = fyFilter === "all" ? "All months" : `FY ${fyLabel(Number(fyFilter))}`;

  const handlePdf = () => {
    exportInvoicePdf({
      invoiceNo: inv.invoiceNo,
      asset: inv.assetName,
      supplier: inv.supplier,
      totalItc: result.netTotalItc,
      totalReversal: totalReversalShown,
      totalRetained: totalRetainedShown,
      filterTitle: filterTitleStr,
      rows: visibleRows.map((r) => ({
        period: `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,"0")}`,
        ratio: r.ratio,
        monthlyItc: r.monthlyItc,
        igst: r.igstReversal, cgst: r.cgstReversal, sgst: r.sgstReversal,
        reversal: r.reversal, retained: r.retained, cumReversal: r.cumulativeReversal,
      })),
    }, `rule43-${(inv.invoiceNo || inv.id).replace(/\s+/g, "-")}.pdf`);
  };

  const handleXlsx = async () => {
    await exportInvoiceXlsx({
      invoiceNo: inv.invoiceNo,
      asset: inv.assetName,
      supplier: inv.supplier,
      totalItc: result.netTotalItc,
      totalReversal: totalReversalShown,
      totalRetained: totalRetainedShown,
      filterTitle: filterTitleStr,
      rows: visibleRows.map((r) => ({
        period: `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,"0")}`,
        ratio: r.ratio,
        monthlyItc: r.monthlyItc,
        igst: r.igstReversal, cgst: r.cgstReversal, sgst: r.sgstReversal,
        reversal: r.reversal, retained: r.retained, cumReversal: r.cumulativeReversal,
        note: r.note,
      })),
    }, `rule43-${(inv.invoiceNo || inv.id).replace(/\s+/g, "-")}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground">Invoice</span>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className="min-w-[280px] max-w-[340px] justify-between text-xs h-9 font-normal bg-background"
                >
                  <span className="truncate">
                    {inv
                      ? `${inv.invoiceNo || "(no #)"} — ${inv.assetName || inv.supplier || "Untitled"}`
                      : "Select invoice..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[340px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search invoice number, asset, supplier..." className="h-9 text-xs" />
                  <CommandList className="max-h-[260px] overflow-y-auto">
                    <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">No invoice found.</CommandEmpty>
                    <CommandGroup>
                      {invoices.map((i) => (
                        <CommandItem
                          key={i.id}
                          value={`${i.invoiceNo || ""} ${i.assetName || ""} ${i.supplier || ""}`}
                          onSelect={() => {
                            setSelected(i.id);
                            setComboboxOpen(false);
                          }}
                          className="text-xs cursor-pointer flex items-center justify-between py-2.5 px-3"
                        >
                          <span className="truncate mr-2">
                            <span className="font-semibold text-foreground">{i.invoiceNo || "(no #)"}</span>
                            <span className="text-muted-foreground"> — {i.assetName || i.supplier || "Untitled"}</span>
                          </span>
                          <Check
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 text-primary",
                              selected === i.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">FY</span>
            <Select value={fyFilter} onValueChange={setFyFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {availableFys.map((y) => (
                  <SelectItem key={y} value={String(y)}>FY {fyLabel(y)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className={status.tone}>{status.label}</Badge>
          </div>
          <div className="flex gap-2 no-print">
            <Button variant="outline" size="sm" onClick={handleXlsx}><Download className="h-3.5 w-3.5 mr-1.5" />Excel</Button>
            <Button variant="outline" size="sm" onClick={handlePdf}><Printer className="h-3.5 w-3.5 mr-1.5" />PDF</Button>
          </div>
        </CardContent>
      </Card>

      {/* GST breakdown strip — for blocked credit, show full disallowance instead */}
      {inv.blockCredit && result.totalItc > 0 ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-destructive">Block credit u/s 17(5) — full ITC disallowed</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This invoice is flagged as blocked credit under Section 17(5). The entire ITC is ineligible — no Rule 43 schedule applies and nothing is retained.
                </p>
                <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
                  <div>
                    <div className="text-[10px] text-muted-foreground">IGST disallowed</div>
                    <div className="num text-destructive text-sm font-semibold">{formatINR(result.netIgstItc)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">CGST disallowed</div>
                    <div className="num text-destructive text-sm font-semibold">{formatINR(result.netCgstItc)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">SGST disallowed</div>
                    <div className="num text-destructive text-sm font-semibold">{formatINR(result.netSgstItc)}</div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground">Total disallowed ITC</div>
                <div className="num font-bold text-destructive text-xl">{formatINR(result.netTotalItc)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : result.totalItc > 0 && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="text-xs font-medium mb-2 text-muted-foreground">ITC breakdown by tax type</div>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <div className="text-[10px] text-muted-foreground">IGST ITC</div>
              <div className="num font-semibold text-sm">{formatINR(result.netIgstItc)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">CGST ITC</div>
              <div className="num font-semibold text-sm">{formatINR(result.netCgstItc)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">SGST ITC</div>
              <div className="num font-semibold text-sm">{formatINR(result.netSgstItc)}</div>
            </div>
            <div className="border-l pl-8 space-y-1">
              <div className="text-[10px] text-muted-foreground">IGST reversed so far</div>
              <div className="num text-destructive text-sm font-semibold">{formatINR(result.igstReversal)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">CGST reversed so far</div>
              <div className="num text-orange-600 dark:text-orange-400 text-sm font-semibold">{formatINR(result.cgstReversal)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">SGST reversed so far</div>
              <div className="num text-amber-600 dark:text-amber-400 text-sm font-semibold">{formatINR(result.sgstReversal)}</div>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Monthly Rule 43 working</CardTitle></CardHeader>
        <CardContent className="p-0">
          {visibleRows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {result.status === "exempt-only" && "Asset is exclusively for exempt supplies — no ITC available; full Tc reversed."}
              {result.status === "taxable-only" && "Asset is exclusively for taxable supplies — full ITC available; no monthly reversal."}
              {result.status === "incomplete" && "Fill in the invoice details to see the working."}
              {result.status === "block-credit" && "Block credit u/s 17(5) — full ITC is disallowed. No Rule 43 monthly schedule applies."}
            </div>
          ) : (
            <ScrollArea className="h-[420px] w-full">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-[48px]">#</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Ratio</TableHead>
                    <TableHead className="text-right">Tm</TableHead>
                    <TableHead className="text-right text-destructive">IGST Rev.</TableHead>
                    <TableHead className="text-right text-orange-600">CGST Rev.</TableHead>
                    <TableHead className="text-right text-amber-600">SGST Rev.</TableHead>
                    <TableHead className="text-right">Total Rev.</TableHead>
                    <TableHead className="text-right">Retained</TableHead>
                    <TableHead className="text-right">Cum. Rev.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((r) => (
                    <TableRow key={r.monthKey} className={r.isDisposalMonth || r.isUsageChangeMonth ? "bg-accent/10" : r.debitNoteItcInMonth > 0 ? "bg-green-500/5" : r.creditNoteItcInMonth > 0 ? "bg-amber-500/5" : "hover:bg-muted/40"}>
                      <TableCell className="num text-xs text-muted-foreground">{r.index + 1}</TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {r.monthLabel}
                          {r.isDisposalMonth && <Badge variant="outline" className="text-[10px] py-0 h-4 bg-accent/20 border-accent/40">Disposal</Badge>}
                          {r.isUsageChangeMonth && <Badge variant="outline" className="text-[10px] py-0 h-4">Usage change</Badge>}
                          {r.creditNoteItcInMonth > 0 && <Badge variant="outline" className="text-[10px] py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-400/30">CN received</Badge>}
                          {r.debitNoteItcInMonth > 0 && <Badge variant="outline" className="text-[10px] py-0 h-4 bg-green-500/10 text-green-700 dark:text-green-400 border-green-400/30">DN received</Badge>}
                        </div>
                        {r.note && <div className="text-[10px] text-muted-foreground mt-0.5 max-w-[180px] truncate" title={r.note}>{r.note}</div>}
                      </TableCell>
                      <TableCell className="text-right num text-xs">{(r.ratio * 100).toFixed(1)}%</TableCell>
                      <TableCell className="text-right num text-xs">
                        {formatINRPrecise(r.monthlyItc)}
                        {r.creditNoteItcInMonth > 0 && <div className="text-[10px] text-amber-600">CN adj.</div>}
                        {r.debitNoteItcInMonth > 0 && <div className="text-[10px] text-green-600">DN adj.</div>}
                      </TableCell>
                      <TableCell className="text-right num text-xs text-destructive">{formatINRPrecise(r.igstReversal)}</TableCell>
                      <TableCell className="text-right num text-xs text-orange-600 dark:text-orange-400">{formatINRPrecise(r.cgstReversal)}</TableCell>
                      <TableCell className="text-right num text-xs text-amber-600 dark:text-amber-400">{formatINRPrecise(r.sgstReversal)}</TableCell>
                      <TableCell className="text-right num text-xs font-medium">{formatINRPrecise(r.reversal)}</TableCell>
                      <TableCell className="text-right num text-xs">{formatINRPrecise(r.retained)}</TableCell>
                      <TableCell className="text-right num text-xs">{formatINR(r.cumulativeReversal)}</TableCell>
                    </TableRow>
                  ))}
                  {(() => {
                    const tot = visibleRows.reduce((a, r) => ({
                      tm: a.tm + r.monthlyItc,
                      igst: a.igst + r.igstReversal,
                      cgst: a.cgst + r.cgstReversal,
                      sgst: a.sgst + r.sgstReversal,
                      rev: a.rev + r.reversal,
                      ret: a.ret + r.retained,
                    }), { tm: 0, igst: 0, cgst: 0, sgst: 0, rev: 0, ret: 0 });
                    const lastCum = visibleRows[visibleRows.length - 1]?.cumulativeReversal ?? 0;
                    return (
                      <TableRow className="bg-muted/60 font-semibold border-t-2">
                        <TableCell className="num text-xs" colSpan={2}>Totals ({visibleRows.length} months)</TableCell>
                        <TableCell className="text-right num text-xs">—</TableCell>
                        <TableCell className="text-right num text-xs">{formatINRPrecise(tot.tm)}</TableCell>
                        <TableCell className="text-right num text-xs text-destructive">{formatINRPrecise(tot.igst)}</TableCell>
                        <TableCell className="text-right num text-xs text-orange-600 dark:text-orange-400">{formatINRPrecise(tot.cgst)}</TableCell>
                        <TableCell className="text-right num text-xs text-amber-600 dark:text-amber-400">{formatINRPrecise(tot.sgst)}</TableCell>
                        <TableCell className="text-right num text-xs">{formatINRPrecise(tot.rev)}</TableCell>
                        <TableCell className="text-right num text-xs">{formatINRPrecise(tot.ret)}</TableCell>
                        <TableCell className="text-right num text-xs">{formatINR(lastCum)}</TableCell>
                      </TableRow>
                    );
                  })()}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RegisterSummary({ invoices, turnover }: { invoices: Invoice[]; turnover: Record<string, MonthlyTurnover> }) {
  const allData = useMemo(
    () => invoices.map((inv) => ({ inv, res: computeInvoice(inv, turnover) })),
    [invoices, turnover],
  );
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [exportDialog, setExportDialog] = useState<null | "excel" | "pdf">(null);

  const presentStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const { res } of allData) set.add(res.status);
    return Array.from(set);
  }, [allData]);

  const data = useMemo(
    () => statusFilter === "all" ? allData : allData.filter(({ res }) => res.status === statusFilter),
    [allData, statusFilter],
  );

  const blockedRows: BlockedRow[] = useMemo(() => {
    const out: BlockedRow[] = [];
    for (const inv of invoices) {
      if (!inv.blockCredit) continue;
      const blockedItc = (inv.taxableValue || 0) * (totalGstRate(inv) / 100);
      out.push({
        date: inv.purchaseDate ?? "",
        invoiceNo: inv.invoiceNo,
        partyName: inv.supplier,
        asset: inv.assetName,
        taxableValue: inv.taxableValue,
        gstPercent: totalGstRate(inv),
        blockedItc,
        reason: inv.notes ?? "Section 17(5)",
      });
    }
    return out;
  }, [invoices]);
  const totalBlockedItc = blockedRows.reduce((s, r) => s + r.blockedItc, 0);

  const buildRegisterRows = () => data.map(({ inv, res }) => ({
    invoiceNo: inv.invoiceNo, date: inv.purchaseDate,
    asset: inv.assetName, supplier: inv.supplier,
    gstin: inv.gstin ?? "",
    taxableValue: inv.taxableValue, netItc: res.netTotalItc,
    igstRev: res.igstReversal, cgstRev: res.cgstReversal, sgstRev: res.sgstReversal,
    retained: res.totalRetained, status: STATUS_LABEL[res.status].label,
  }));

  const handleConfirmExport = async (fmt: "excel" | "pdf", opts: { includeBlockedCredit: boolean }) => {
    const rows = buildRegisterRows();
    const blocked = opts.includeBlockedCredit ? blockedRows : undefined;
    const totBlocked = opts.includeBlockedCredit ? totalBlockedItc : undefined;
    if (fmt === "excel") {
      await exportRegisterXlsx({ rows, blockedRows: blocked, totalBlockedItc: totBlocked }, "capital-goods-register.xlsx");
    } else {
      exportRegisterPdf({ rows, blockedRows: blocked, totalBlockedItc: totBlocked }, "capital-goods-register.pdf");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between gap-3 flex-wrap">
        <div>
          <CardTitle className="text-base">Capital goods register</CardTitle>
          <CardDescription className="text-xs">Per-invoice ITC and reversal summary with IGST / CGST / SGST breakdown</CardDescription>
        </div>
        <div className="flex items-center gap-2 no-print flex-wrap">
          <span className="text-xs text-muted-foreground">Status</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({allData.length})</SelectItem>
              {presentStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s as Rule43Result["status"]].label}
                  {" "}({allData.filter((d) => d.res.status === s).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setExportDialog("excel")}><Download className="h-3.5 w-3.5 mr-1.5" />Excel</Button>
          <Button variant="outline" size="sm" onClick={() => setExportDialog("pdf")}><Printer className="h-3.5 w-3.5 mr-1.5" />PDF</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {data.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No invoices match this status filter.</div>
        ) : (
        <div className="max-h-[520px] overflow-y-auto w-full">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-20 shadow-sm">
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead className="text-right">Taxable Value</TableHead>
              <TableHead className="text-right">ITC Breakdown</TableHead>
              <TableHead className="text-right text-destructive">IGST Rev.</TableHead>
              <TableHead className="text-right text-orange-600">CGST Rev.</TableHead>
              <TableHead className="text-right text-amber-600">SGST Rev.</TableHead>
              <TableHead className="text-right">Total Retained</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(({ inv, res }) => {
              const s = STATUS_LABEL[res.status];
              const cnCount = (inv.creditNotes ?? []).length;
              const dnCount = (inv.debitNotes ?? []).length;
              return (
                <TableRow key={inv.id} className="hover:bg-muted/40">
                  <TableCell className="text-sm font-medium">{inv.invoiceNo || "—"}</TableCell>
                  <TableCell className="text-sm">{inv.purchaseDate || "—"}</TableCell>
                  <TableCell className="text-sm">{inv.assetName || "—"}<div className="text-xs text-muted-foreground">{inv.supplier}</div></TableCell>
                  <TableCell className="text-right num text-sm">{formatINR(inv.taxableValue)}</TableCell>
                  <TableCell className="text-right num text-xs">
                    <div className="font-medium">{formatINR(res.netTotalItc)}</div>
                    {res.igstItc > 0 && <div className="text-muted-foreground">I:{formatINR(res.netIgstItc)}</div>}
                    {res.cgstItc > 0 && <div className="text-muted-foreground">C:{formatINR(res.netCgstItc)}</div>}
                    {res.sgstItc > 0 && <div className="text-muted-foreground">S:{formatINR(res.netSgstItc)}</div>}
                    {cnCount > 0 && <div className="text-amber-600">{cnCount} CN −{formatINR(res.totalCreditNoteItc)}</div>}
                    {dnCount > 0 && <div className="text-green-600 dark:text-green-400">{dnCount} DN +{formatINR(res.totalDebitNoteItc)}</div>}
                  </TableCell>
                  <TableCell className="text-right num text-xs text-destructive">{formatINR(res.igstReversal)}</TableCell>
                  <TableCell className="text-right num text-xs text-orange-600 dark:text-orange-400">{formatINR(res.cgstReversal)}</TableCell>
                  <TableCell className="text-right num text-xs text-amber-600 dark:text-amber-400">{formatINR(res.sgstReversal)}</TableCell>
                  <TableCell className="text-right num text-sm">{formatINR(res.totalRetained)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className={`text-[10px] ${s.tone}`}>{s.label}</Badge>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
        )}
      </CardContent>

      <ExportOptionsDialog
        open={exportDialog !== null}
        onOpenChange={(o) => { if (!o) setExportDialog(null); }}
        format={exportDialog ?? "excel"}
        hasBlockedCredits={blockedRows.length > 0}
        blockedCount={blockedRows.length}
        onConfirm={async (opts) => { if (exportDialog) await handleConfirmExport(exportDialog, opts); setExportDialog(null); }}
      />
    </Card>
  );
}

// ============================================================================
// Section 17(5) Blocked Credit Report — independent FY/month filter, Excel + PDF
// ============================================================================
function BlockCreditReport({ invoices }: { invoices: Invoice[] }) {
  const blockedAll = useMemo(() => invoices.filter((i) => i.blockCredit), [invoices]);
  const [filter, setFilter] = useState<ReportFilter>(() => defaultFilter(invoices));

  const availableYears = useMemo(() => {
    const ys = new Set<number>();
    for (const inv of blockedAll) if (inv.purchaseDate) ys.add(fyStartYear(new Date(inv.purchaseDate)));
    if (ys.size === 0) ys.add(fyStartYear(new Date()));
    return Array.from(ys).sort((a, b) => a - b);
  }, [blockedAll]);

  const visible = useMemo(() => {
    return blockedAll
      .filter((inv) => inv.purchaseDate && inFilter(new Date(inv.purchaseDate), filter))
      .map((inv) => {
        const blockedItc = (inv.taxableValue || 0) * (totalGstRate(inv) / 100);
        return {
          inv,
          row: {
            date: inv.purchaseDate ?? "",
            invoiceNo: inv.invoiceNo,
            partyName: inv.supplier,
            asset: inv.assetName,
            taxableValue: inv.taxableValue,
            gstPercent: totalGstRate(inv),
            blockedItc,
            reason: inv.notes ?? "Section 17(5)",
          } as BlockedRow,
        };
      });
  }, [blockedAll, filter]);

  const totalBlockedItc = visible.reduce((s, x) => s + x.row.blockedItc, 0);
  const totalTaxable = visible.reduce((s, x) => s + (x.inv.taxableValue || 0), 0);

  const handleXlsx = async () => {
    await exportBlockedCreditXlsx(
      { filterTitle: filterTitle(filter), rows: visible.map((v) => v.row), totalBlockedItc },
      `blocked-credit-${filterFilenameSuffix(filter)}.xlsx`,
    );
  };
  const handlePdf = () => {
    exportBlockedCreditPdf(
      { filterTitle: filterTitle(filter), rows: visible.map((v) => v.row), totalBlockedItc },
      `blocked-credit-${filterFilenameSuffix(filter)}.pdf`,
    );
  };

  if (blockedAll.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium">No blocked credit invoices</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Mark an invoice as <strong>Block Credit</strong> in the Invoices tab (for Section 17(5) items like motor vehicles, food, club memberships, etc.) and it will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <FilterBar filter={filter} setFilter={setFilter} availableYears={availableYears} />

      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Blocked invoices</div>
              <div className="num font-semibold text-base">{visible.length}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Total taxable value</div>
              <div className="num font-semibold text-base">{formatINR(totalTaxable)}</div>
            </div>
            <div className="md:col-span-2 md:text-right">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Total blocked ITC (ineligible)</div>
              <div className="num font-bold text-destructive text-2xl">{formatINR(totalBlockedItc)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">Section 17(5) — Blocked credit register</CardTitle>
            <CardDescription className="text-xs">Invoices where ITC is fully ineligible under Section 17(5) of the CGST Act</CardDescription>
          </div>
          <div className="flex gap-2 no-print">
            <Button variant="outline" size="sm" onClick={handleXlsx} disabled={visible.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1.5" />Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handlePdf} disabled={visible.length === 0}>
              <Printer className="h-3.5 w-3.5 mr-1.5" />PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No blocked credit invoices in {filterTitle(filter)}.</div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto w-full">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-20 shadow-sm">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead className="text-right">Taxable Value</TableHead>
                    <TableHead className="text-right">GST %</TableHead>
                    <TableHead className="text-right">Blocked ITC</TableHead>
                    <TableHead>Reason / Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map(({ inv, row }) => (
                    <TableRow key={inv.id} className="hover:bg-muted/40">
                      <TableCell className="text-sm">{row.date || "—"}</TableCell>
                      <TableCell className="text-sm font-medium">{row.invoiceNo || "—"}</TableCell>
                      <TableCell className="text-sm">{row.partyName || "—"}</TableCell>
                      <TableCell className="text-sm">{row.asset || "—"}</TableCell>
                      <TableCell className="text-right num text-sm">{formatINR(row.taxableValue)}</TableCell>
                      <TableCell className="text-right num text-xs">{row.gstPercent.toFixed(2)}%</TableCell>
                      <TableCell className="text-right num text-sm font-semibold text-destructive">{formatINR(row.blockedItc)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate" title={row.reason}>{row.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

