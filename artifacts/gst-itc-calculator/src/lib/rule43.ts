export type UsageType = "taxable" | "exempt" | "common";

/** Tax breakdown shared by invoices, credit notes, and debit notes */
export interface GstComponents {
  igstRate: number;
  cgstRate: number;
  sgstRate: number;
}

export interface CreditNote extends GstComponents {
  id: string;
  creditNoteNo: string;
  date: string;
  taxableValue: number;
  includeMonthInReversal: boolean;
}

export interface DebitNote extends GstComponents {
  id: string;
  debitNoteNo: string;
  date: string;
  taxableValue: number;
  includeMonthInReversal: boolean;
}

export interface DisposalInput {
  enabled: boolean;
  date?: string;
  saleValue?: number;
  saleGstRate?: number;
}

export interface UsageChangeInput {
  enabled: boolean;
  date?: string;
  newUsage?: UsageType;
}

export interface Invoice extends GstComponents {
  id: string;
  invoiceNo: string;
  supplier: string;
  assetName: string;
  purchaseDate: string;
  taxableValue: number;
  usage: UsageType;
  disposal: DisposalInput;
  usageChange: UsageChangeInput;
  creditNotes?: CreditNote[];
  debitNotes?: DebitNote[];
  notes?: string;
  /** Section 17(5) blocked credit — entire ITC is ineligible; Rule 43 is not applied */
  blockCredit?: boolean;
}

export interface MonthlyTurnover {
  exempt: number;
  taxable: number;
}

export interface MonthRow {
  index: number;
  monthLabel: string;
  monthKey: string;
  date: Date;
  exempt: number;
  total: number;
  ratio: number;
  monthlyItc: number;
  reversal: number;
  retained: number;
  igstReversal: number;
  cgstReversal: number;
  sgstReversal: number;
  cumulativeReversal: number;
  cumulativeRetained: number;
  isDisposalMonth: boolean;
  isUsageChangeMonth: boolean;
  effectiveUsage: UsageType;
  remainingUnamortizedReversal: number;
  creditNoteReversal: number;
  creditNoteItcInMonth: number;
  debitNoteItcInMonth: number;
  note?: string;
}

export interface Rule43Result {
  totalItc: number;
  igstItc: number;
  cgstItc: number;
  sgstItc: number;
  netTotalItc: number;
  netIgstItc: number;
  netCgstItc: number;
  netSgstItc: number;
  monthlyItc: number;
  rows: MonthRow[];
  totalReversal: number;
  totalRetained: number;
  igstReversal: number;
  cgstReversal: number;
  sgstReversal: number;
  remainingUnamortized: number;
  status: "active" | "disposed" | "fully-amortized" | "exempt-only" | "taxable-only" | "incomplete" | "block-credit";
  monthsElapsed: number;
  remainingMonths: number;
  totalCreditNoteItc: number;
  totalDebitNoteItc: number;
}

export const USEFUL_LIFE_MONTHS = 60;

/** Total GST rate = IGST + CGST + SGST */
export function totalGstRate(x: GstComponents): number {
  return (Number(x.igstRate) || 0) + (Number(x.cgstRate) || 0) + (Number(x.sgstRate) || 0);
}

/** Compute IGST, CGST, SGST ITC amounts from a taxable value + components */
export function computeItcComponents(taxableValue: number, g: GstComponents) {
  const tv = Number(taxableValue) || 0;
  return {
    igstItc: tv * (Number(g.igstRate) || 0) / 100,
    cgstItc: tv * (Number(g.cgstRate) || 0) / 100,
    sgstItc: tv * (Number(g.sgstRate) || 0) / 100,
  };
}

export function formatINR(n: number): string {
  if (!isFinite(n)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function formatINRPrecise(n: number): string {
  if (!isFinite(n)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function monthsBetween(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function safeRatio(exempt: number, total: number): number {
  if (!total || total <= 0) return 0;
  const r = exempt / total;
  if (!isFinite(r) || r < 0) return 0;
  return Math.min(r, 1);
}

export function generateMonthsFor(purchaseDate: string, count = USEFUL_LIFE_MONTHS): Date[] {
  if (!purchaseDate) return [];
  const start = new Date(purchaseDate);
  if (isNaN(start.getTime())) return [];
  const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  const out: Date[] = [];
  for (let i = 0; i < count; i++) out.push(addMonths(startMonth, i));
  return out;
}

/** Union of all months covered by all invoices (purchase month → +60 each). */
export function unionMonths(invoices: Invoice[]): Date[] {
  const set = new Map<string, Date>();
  for (const inv of invoices) {
    const months = generateMonthsFor(inv.purchaseDate);
    for (const d of months) set.set(monthKey(d), d);
  }
  return Array.from(set.values()).sort((a, b) => a.getTime() - b.getTime());
}

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random());

export function newCreditNote(inv?: Invoice): CreditNote {
  return {
    id: makeId(),
    creditNoteNo: "",
    date: "",
    taxableValue: 0,
    igstRate: inv?.igstRate ?? 18,
    cgstRate: inv?.cgstRate ?? 0,
    sgstRate: inv?.sgstRate ?? 0,
    includeMonthInReversal: true,
  };
}

export function newDebitNote(inv?: Invoice): DebitNote {
  return {
    id: makeId(),
    debitNoteNo: "",
    date: "",
    taxableValue: 0,
    igstRate: inv?.igstRate ?? 18,
    cgstRate: inv?.cgstRate ?? 0,
    sgstRate: inv?.sgstRate ?? 0,
    includeMonthInReversal: true,
  };
}

export function newInvoice(): Invoice {
  return {
    id: makeId(),
    invoiceNo: "",
    supplier: "",
    assetName: "",
    purchaseDate: "",
    taxableValue: 0,
    igstRate: 18,
    cgstRate: 0,
    sgstRate: 0,
    usage: "common",
    disposal: { enabled: false },
    usageChange: { enabled: false },
    creditNotes: [],
    debitNotes: [],
    blockCredit: false,
  };
}

/** Split a reversal amount into IGST/CGST/SGST using the invoice's tax component ratios */
function splitReversal(reversal: number, igstItc: number, cgstItc: number, sgstItc: number, totalItc: number) {
  if (totalItc <= 0) return { igst: 0, cgst: 0, sgst: 0 };
  return {
    igst: reversal * igstItc / totalItc,
    cgst: reversal * cgstItc / totalItc,
    sgst: reversal * sgstItc / totalItc,
  };
}

export function computeInvoice(
  inv: Invoice,
  turnover: Record<string, MonthlyTurnover>,
  asOfDate: Date = new Date(),
): Rule43Result {
  const tv = Number(inv.taxableValue) || 0;
  const { igstItc: grossIgstItc, cgstItc: grossCgstItc, sgstItc: grossSgstItc } = computeItcComponents(tv, inv);
  const grossTotalItc = grossIgstItc + grossCgstItc + grossSgstItc;
  const baseTm = grossTotalItc / USEFUL_LIFE_MONTHS;

  const creditNotes = inv.creditNotes ?? [];
  const totalCreditNoteItc = creditNotes.reduce((sum, cn) => {
    const { igstItc, cgstItc, sgstItc } = computeItcComponents(Number(cn.taxableValue) || 0, cn);
    return sum + igstItc + cgstItc + sgstItc;
  }, 0);

  const debitNotes = inv.debitNotes ?? [];
  const totalDebitNoteItc = debitNotes.reduce((sum, dn) => {
    const { igstItc, cgstItc, sgstItc } = computeItcComponents(Number(dn.taxableValue) || 0, dn);
    return sum + igstItc + cgstItc + sgstItc;
  }, 0);

  const netTotalItc = Math.max(0, grossTotalItc - totalCreditNoteItc + totalDebitNoteItc);
  // Net per component (proportional to gross component ratios)
  const netFactor = grossTotalItc > 0 ? netTotalItc / grossTotalItc : 0;
  const netIgstItc = grossIgstItc * netFactor;
  const netCgstItc = grossCgstItc * netFactor;
  const netSgstItc = grossSgstItc * netFactor;

  const emptyResult = (status: Rule43Result["status"], totalReversal = 0, totalRetained = 0): Rule43Result => ({
    totalItc: grossTotalItc,
    igstItc: grossIgstItc, cgstItc: grossCgstItc, sgstItc: grossSgstItc,
    netTotalItc, netIgstItc, netCgstItc, netSgstItc,
    monthlyItc: baseTm, rows: [],
    totalReversal, totalRetained,
    igstReversal: totalReversal * (grossTotalItc > 0 ? grossIgstItc / grossTotalItc : 0),
    cgstReversal: totalReversal * (grossTotalItc > 0 ? grossCgstItc / grossTotalItc : 0),
    sgstReversal: totalReversal * (grossTotalItc > 0 ? grossSgstItc / grossTotalItc : 0),
    remainingUnamortized: 0,
    status, monthsElapsed: 0, remainingMonths: USEFUL_LIFE_MONTHS,
    totalCreditNoteItc, totalDebitNoteItc,
  });

  if (!tv || !totalGstRate(inv) || !inv.purchaseDate) return emptyResult("incomplete");

  // Section 17(5) blocked credit — entire ITC is ineligible. No Rule 43 schedule.
  if (inv.blockCredit) return emptyResult("block-credit", 0, 0);

  if (inv.usage === "taxable" && !inv.usageChange.enabled) return emptyResult("taxable-only", 0, netTotalItc);
  if (inv.usage === "exempt" && !inv.usageChange.enabled) return emptyResult("exempt-only", netTotalItc, 0);

  const months = generateMonthsFor(inv.purchaseDate);
  const purchaseMonth = months[0];
  const asOfMonth = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 1);
  const monthsElapsed = Math.max(0, Math.min(USEFUL_LIFE_MONTHS, monthsBetween(purchaseMonth, asOfMonth) + 1));

  // Also extend the schedule to cover any month for which the user has
  // explicitly provided turnover data (forward-planning support). This
  // ensures projected reversals show up even before that month "arrives".
  let lastTurnoverIdx = -1;
  for (let i = 0; i < months.length; i++) {
    const k = monthKey(months[i]);
    if (turnover[k]) lastTurnoverIdx = i;
  }
  const effectiveMonthsElapsed = Math.max(monthsElapsed, lastTurnoverIdx + 1);

  let disposalMonthIdx = -1;
  if (inv.disposal.enabled && inv.disposal.date) {
    const dDate = new Date(inv.disposal.date);
    if (!isNaN(dDate.getTime())) {
      disposalMonthIdx = monthsBetween(purchaseMonth, new Date(dDate.getFullYear(), dDate.getMonth(), 1));
      if (disposalMonthIdx < 0 || disposalMonthIdx >= USEFUL_LIFE_MONTHS) disposalMonthIdx = -1;
    }
  }

  let usageChangeMonthIdx = -1;
  let newUsage: UsageType | undefined;
  if (inv.usageChange.enabled && inv.usageChange.date && inv.usageChange.newUsage) {
    const uDate = new Date(inv.usageChange.date);
    if (!isNaN(uDate.getTime())) {
      usageChangeMonthIdx = monthsBetween(purchaseMonth, new Date(uDate.getFullYear(), uDate.getMonth(), 1));
      if (usageChangeMonthIdx < 0 || usageChangeMonthIdx >= USEFUL_LIFE_MONTHS) usageChangeMonthIdx = -1;
      else newUsage = inv.usageChange.newUsage;
    }
  }

  interface CnEntry { cnItc: number; include: boolean; label: string; }
  const cnByIdx = new Map<number, CnEntry[]>();
  for (const cn of creditNotes) {
    if (!cn.date) continue;
    const cnDate = new Date(cn.date);
    if (isNaN(cnDate.getTime())) continue;
    const idx = monthsBetween(purchaseMonth, new Date(cnDate.getFullYear(), cnDate.getMonth(), 1));
    if (idx < 0 || idx >= USEFUL_LIFE_MONTHS) continue;
    const { igstItc, cgstItc, sgstItc } = computeItcComponents(Number(cn.taxableValue) || 0, cn);
    const cnItc = igstItc + cgstItc + sgstItc;
    if (!cnByIdx.has(idx)) cnByIdx.set(idx, []);
    cnByIdx.get(idx)!.push({ cnItc, include: cn.includeMonthInReversal, label: cn.creditNoteNo || "CN" });
  }

  interface DnEntry { dnItc: number; include: boolean; label: string; }
  const dnByIdx = new Map<number, DnEntry[]>();
  for (const dn of debitNotes) {
    if (!dn.date) continue;
    const dnDate = new Date(dn.date);
    if (isNaN(dnDate.getTime())) continue;
    const idx = monthsBetween(purchaseMonth, new Date(dnDate.getFullYear(), dnDate.getMonth(), 1));
    if (idx < 0 || idx >= USEFUL_LIFE_MONTHS) continue;
    const { igstItc, cgstItc, sgstItc } = computeItcComponents(Number(dn.taxableValue) || 0, dn);
    const dnItc = igstItc + cgstItc + sgstItc;
    if (!dnByIdx.has(idx)) dnByIdx.set(idx, []);
    dnByIdx.get(idx)!.push({ dnItc, include: dn.includeMonthInReversal, label: dn.debitNoteNo || "DN" });
  }

  const rows: MonthRow[] = [];
  let cumulativeReversal = 0;
  let cumulativeRetained = 0;
  let cumIgstReversal = 0;
  let cumCgstReversal = 0;
  let cumSgstReversal = 0;
  let stoppedAt: number | null = null;

  let effectiveTm = baseTm;
  const deferred: Array<{ delta: number; applyAtIdx: number }> = [];
  const loopLimit = Math.min(months.length, effectiveMonthsElapsed);

  for (let i = 0; i < loopLimit; i++) {
    for (const def of deferred) {
      if (def.applyAtIdx === i) {
        const rem = USEFUL_LIFE_MONTHS - i;
        effectiveTm = Math.max(0, effectiveTm * rem + def.delta) / rem;
      }
    }

    const d = months[i];
    const key = monthKey(d);
    const t = turnover[key] ?? { exempt: 0, taxable: 0 };
    const total = (Number(t.exempt) || 0) + (Number(t.taxable) || 0);
    const ratio = safeRatio(Number(t.exempt) || 0, total);

    let effectiveUsage: UsageType = inv.usage;
    if (usageChangeMonthIdx >= 0 && i >= usageChangeMonthIdx && newUsage) effectiveUsage = newUsage;

    const isDisposalMonth = disposalMonthIdx === i;
    const isUsageChangeMonth = usageChangeMonthIdx === i;

    const cnsHere = cnByIdx.get(i) ?? [];
    let creditNoteItcInMonth = 0;
    const cnLabels: string[] = [];
    for (const entry of cnsHere) {
      creditNoteItcInMonth += entry.cnItc;
      cnLabels.push(entry.label);
      if (entry.include) {
        const rem = USEFUL_LIFE_MONTHS - i;
        effectiveTm = Math.max(0, effectiveTm * rem - entry.cnItc) / rem;
      } else {
        deferred.push({ delta: -entry.cnItc, applyAtIdx: i + 1 });
      }
    }

    const dnsHere = dnByIdx.get(i) ?? [];
    let debitNoteItcInMonth = 0;
    const dnLabels: string[] = [];
    for (const entry of dnsHere) {
      debitNoteItcInMonth += entry.dnItc;
      dnLabels.push(entry.label);
      if (entry.include) {
        const rem = USEFUL_LIFE_MONTHS - i;
        effectiveTm = (effectiveTm * rem + entry.dnItc) / rem;
      } else {
        deferred.push({ delta: entry.dnItc, applyAtIdx: i + 1 });
      }
    }

    const monthlyItc = effectiveTm;
    let reversal = 0;
    let retained = 0;
    let remainingUnamortizedReversal = 0;
    let note: string | undefined;

    if (creditNoteItcInMonth > 0) {
      const incl = cnsHere.filter((c) => c.include).length;
      const def_ = cnsHere.filter((c) => !c.include).length;
      note = `CN received: ${cnLabels.join(", ")} — ITC ₹${Math.round(creditNoteItcInMonth).toLocaleString("en-IN")} reduces Tm` +
        (incl > 0 ? ` from this month` : ``) + (def_ > 0 ? ` from next month` : ``);
    }
    if (debitNoteItcInMonth > 0) {
      const incl = dnsHere.filter((d) => d.include).length;
      const def_ = dnsHere.filter((d) => !d.include).length;
      const dnNote = `DN received: ${dnLabels.join(", ")} — ITC ₹${Math.round(debitNoteItcInMonth).toLocaleString("en-IN")} increases Tm` +
        (incl > 0 ? ` from this month` : ``) + (def_ > 0 ? ` from next month` : ``);
      note = note ? note + " · " + dnNote : dnNote;
    }

    if (effectiveUsage === "exempt") {
      reversal = monthlyItc;
      retained = 0;
      if (isUsageChangeMonth) {
        const remAfter = USEFUL_LIFE_MONTHS - i - 1;
        remainingUnamortizedReversal = effectiveTm * remAfter;
        reversal += remainingUnamortizedReversal;
        note = (note ? note + " · " : "") + "Usage changed to exempt — remaining unamortized ITC reversed";
        const split = splitReversal(reversal, grossIgstItc, grossCgstItc, grossSgstItc, grossTotalItc);
        cumulativeReversal += reversal; cumulativeRetained += retained;
        cumIgstReversal += split.igst; cumCgstReversal += split.cgst; cumSgstReversal += split.sgst;
        rows.push({ index: i, monthLabel: monthLabel(d), monthKey: key, date: d, exempt: t.exempt, total, ratio: 1, monthlyItc, reversal, retained, igstReversal: split.igst, cgstReversal: split.cgst, sgstReversal: split.sgst, cumulativeReversal, cumulativeRetained, isDisposalMonth, isUsageChangeMonth, effectiveUsage, remainingUnamortizedReversal, creditNoteReversal: 0, creditNoteItcInMonth, debitNoteItcInMonth, note });
        stoppedAt = i; break;
      }
    } else if (effectiveUsage === "taxable") {
      reversal = 0; retained = monthlyItc;
      if (isUsageChangeMonth) note = (note ? note + " · " : "") + "Usage changed to exclusively taxable — no further reversal";
    } else {
      reversal = monthlyItc * ratio; retained = monthlyItc - reversal;
      if (isUsageChangeMonth) note = (note ? note + " · " : "") + "Usage changed — common-use reversal applies from this month";
    }

    if (isDisposalMonth) {
      const remAfter = USEFUL_LIFE_MONTHS - i - 1;
      remainingUnamortizedReversal = effectiveTm * remAfter;
      reversal += remainingUnamortizedReversal;
      retained = monthlyItc - (effectiveUsage === "common" ? monthlyItc * ratio : effectiveUsage === "exempt" ? monthlyItc : 0);
      note = (note ? note + " · " : "") + "Disposal — entire remaining unamortized ITC reversed";
      const split = splitReversal(reversal, grossIgstItc, grossCgstItc, grossSgstItc, grossTotalItc);
      cumulativeReversal += reversal; cumulativeRetained += retained;
      cumIgstReversal += split.igst; cumCgstReversal += split.cgst; cumSgstReversal += split.sgst;
      rows.push({ index: i, monthLabel: monthLabel(d), monthKey: key, date: d, exempt: t.exempt, total, ratio, monthlyItc, reversal, retained, igstReversal: split.igst, cgstReversal: split.cgst, sgstReversal: split.sgst, cumulativeReversal, cumulativeRetained, isDisposalMonth, isUsageChangeMonth, effectiveUsage, remainingUnamortizedReversal, creditNoteReversal: 0, creditNoteItcInMonth, debitNoteItcInMonth, note });
      stoppedAt = i; break;
    }

    const split = splitReversal(reversal, grossIgstItc, grossCgstItc, grossSgstItc, grossTotalItc);
    cumulativeReversal += reversal; cumulativeRetained += retained;
    cumIgstReversal += split.igst; cumCgstReversal += split.cgst; cumSgstReversal += split.sgst;
    rows.push({ index: i, monthLabel: monthLabel(d), monthKey: key, date: d, exempt: t.exempt, total, ratio, monthlyItc, reversal, retained, igstReversal: split.igst, cgstReversal: split.cgst, sgstReversal: split.sgst, cumulativeReversal, cumulativeRetained, isDisposalMonth, isUsageChangeMonth, effectiveUsage, remainingUnamortizedReversal, creditNoteReversal: 0, creditNoteItcInMonth, debitNoteItcInMonth, note });
  }

  let status: Rule43Result["status"] = "active";
  if (disposalMonthIdx >= 0 && stoppedAt !== null) status = "disposed";
  else if (rows.length === USEFUL_LIFE_MONTHS) status = "fully-amortized";

  const lastRow = rows[rows.length - 1];
  const consumedMonths = lastRow ? lastRow.index + 1 : 0;
  const remainingMonths = Math.max(0, USEFUL_LIFE_MONTHS - consumedMonths);
  const lastEffectiveTm = lastRow ? lastRow.monthlyItc : effectiveTm;
  const remainingUnamortized = status === "disposed" ? 0 : lastEffectiveTm * remainingMonths;

  return {
    totalItc: grossTotalItc,
    igstItc: grossIgstItc, cgstItc: grossCgstItc, sgstItc: grossSgstItc,
    netTotalItc, netIgstItc, netCgstItc, netSgstItc,
    monthlyItc: baseTm, rows,
    totalReversal: cumulativeReversal, totalRetained: cumulativeRetained,
    igstReversal: cumIgstReversal, cgstReversal: cumCgstReversal, sgstReversal: cumSgstReversal,
    remainingUnamortized, status, monthsElapsed, remainingMonths,
    totalCreditNoteItc, totalDebitNoteItc,
  };
}

export interface ConsolidatedRow {
  monthKey: string;
  monthLabel: string;
  date: Date;
  exempt: number;
  total: number;
  ratio: number;
  totalMonthlyItc: number;
  totalReversal: number;
  totalRetained: number;
  igstReversal: number;
  cgstReversal: number;
  sgstReversal: number;
  cumReversal: number;
  cumRetained: number;
  invoiceCount: number;
}

export function consolidate(
  invoices: Invoice[],
  turnover: Record<string, MonthlyTurnover>,
): { rows: ConsolidatedRow[]; totalReversal: number; totalRetained: number; totalItc: number; igstReversal: number; cgstReversal: number; sgstReversal: number } {
  const months = unionMonths(invoices);
  const perInv = invoices.map((inv) => ({ inv, res: computeInvoice(inv, turnover) }));
  const rowByKey = new Map<string, ConsolidatedRow>();

  for (const d of months) {
    const k = monthKey(d);
    const t = turnover[k] ?? { exempt: 0, taxable: 0 };
    const total = (Number(t.exempt) || 0) + (Number(t.taxable) || 0);
    rowByKey.set(k, {
      monthKey: k, monthLabel: monthLabel(d), date: d,
      exempt: t.exempt || 0, total, ratio: safeRatio(t.exempt || 0, total),
      totalMonthlyItc: 0, totalReversal: 0, totalRetained: 0,
      igstReversal: 0, cgstReversal: 0, sgstReversal: 0,
      cumReversal: 0, cumRetained: 0, invoiceCount: 0,
    });
  }

  for (const { res } of perInv) {
    for (const r of res.rows) {
      const row = rowByKey.get(r.monthKey);
      if (!row) continue;
      row.totalMonthlyItc += r.monthlyItc;
      row.totalReversal += r.reversal;
      row.totalRetained += r.retained;
      row.igstReversal += r.igstReversal;
      row.cgstReversal += r.cgstReversal;
      row.sgstReversal += r.sgstReversal;
      row.invoiceCount += 1;
    }
  }

  let cumR = 0, cumK = 0, totalReversal = 0, totalRetained = 0;
  let igstReversal = 0, cgstReversal = 0, sgstReversal = 0;
  const rows: ConsolidatedRow[] = [];
  for (const d of months) {
    const row = rowByKey.get(monthKey(d))!;
    cumR += row.totalReversal; cumK += row.totalRetained;
    row.cumReversal = cumR; row.cumRetained = cumK;
    totalReversal += row.totalReversal; totalRetained += row.totalRetained;
    igstReversal += row.igstReversal; cgstReversal += row.cgstReversal; sgstReversal += row.sgstReversal;
    rows.push(row);
  }

  const totalItc = perInv.reduce((s, x) => s + x.res.netTotalItc, 0);
  return { rows, totalReversal, totalRetained, totalItc, igstReversal, cgstReversal, sgstReversal };
}
