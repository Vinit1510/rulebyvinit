import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { type Invoice, type UsageType, type ItemType, type NonBusinessUseType, newInvoice } from "@/lib/rule43";
import { downloadImportTemplate } from "@/lib/excel";

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (invoices: Invoice[]) => void;
}

interface ParsedRow {
  invoiceNo?: string;
  originalInvoiceNo?: string;
  docType?: "invoice" | "credit_note" | "debit_note";
  supplier?: string;
  gstin?: string;
  assetName?: string;
  purchaseDate?: string;
  taxableValue?: number;
  igstRate?: number;
  cgstRate?: number;
  sgstRate?: number;
  igstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  gstRate?: number;  // legacy / convenience alias — treated as IGST
  usage?: UsageType;
  nonBusinessUse?: NonBusinessUseType;
  itemType?: ItemType;
  notes?: string;
  blockCredit?: boolean;
}

const FIELD_ALIASES: Record<string, keyof ParsedRow> = {
  "invoice number": "invoiceNo",
  "invoice no": "invoiceNo",
  "invoice": "invoiceNo",
  "invoice#": "invoiceNo",
  "inv no": "invoiceNo",
  "inv#": "invoiceNo",
  "bill no": "invoiceNo",
  "bill number": "invoiceNo",
  "credit note no": "invoiceNo",
  "credit note": "invoiceNo",
  "debit note no": "invoiceNo",
  "debit note": "invoiceNo",
  "original invoice no": "originalInvoiceNo",
  "original invoice": "originalInvoiceNo",
  "parent invoice no": "originalInvoiceNo",
  "against invoice no": "originalInvoiceNo",
  "against invoice": "originalInvoiceNo",
  "doc type": "docType",
  "document type": "docType",
  "note type": "docType",
  supplier: "supplier",
  "supplier name": "supplier",
  "supplier party": "supplier",
  "party": "supplier",
  "party name": "supplier",
  "vendor": "supplier",
  "vendor name": "supplier",
  "seller": "supplier",
  "gstin": "gstin",
  "gst number": "gstin",
  "gst no": "gstin",
  "supplier gstin": "gstin",
  "supplier gst": "gstin",
  "asset": "assetName",
  "asset name": "assetName",
  "asset description": "assetName",
  "asset machine": "assetName",
  "asset machine product": "assetName",
  "machine": "assetName",
  "product": "assetName",
  "item": "assetName",
  "item description": "assetName",
  "description": "assetName",
  "purchase date": "purchaseDate",
  "date": "purchaseDate",
  "date yyyy mm dd": "purchaseDate",
  "invoice date": "purchaseDate",
  "bill date": "purchaseDate",
  "note date": "purchaseDate",
  "taxable value": "taxableValue",
  "taxable amount": "taxableValue",
  "value": "taxableValue",
  "amount": "taxableValue",
  "basic value": "taxableValue",
  "net amount": "taxableValue",
  // Specific tax type columns (% and "rate" both stripped during normalization)
  "igst rate": "igstRate",
  "igst": "igstRate",
  "igst amount": "igstAmount",
  "igst amt": "igstAmount",
  "cgst rate": "cgstRate",
  "cgst": "cgstRate",
  "cgst amount": "cgstAmount",
  "cgst amt": "cgstAmount",
  "sgst rate": "sgstRate",
  "sgst": "sgstRate",
  "sgst amount": "sgstAmount",
  "sgst amt": "sgstAmount",
  "utgst rate": "sgstRate",
  "utgst": "sgstRate",
  "utgst amount": "sgstAmount",
  "utgst amt": "sgstAmount",
  // Legacy / convenience: treats as IGST
  "gst rate": "gstRate",
  "tax rate": "gstRate",
  "rate": "gstRate",
  "usage": "usage",
  "usage type": "usage",
  "personal use": "nonBusinessUse",
  "personal use type": "nonBusinessUse",
  "non business use": "nonBusinessUse",
  "non business": "nonBusinessUse",
  "d2 trigger": "nonBusinessUse",
  "d2": "nonBusinessUse",
  "item type": "itemType",
  "type": "itemType",
  "category": "itemType",
  "notes": "notes",
  "remarks": "notes",
  "note": "notes",
  "block credit": "blockCredit",
  "blocked credit": "blockCredit",
  "block credit yes no": "blockCredit",
  "section 17 5": "blockCredit",
  "sec 17 5": "blockCredit",
  "17 5": "blockCredit",
};

function normalizeHeader(h: string): string {
  return String(h ?? "")
    .trim()
    // split camelCase / PascalCase: "TaxableValue" -> "Taxable Value", "iGST" -> "i GST"
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    // strip parentheses content: "Date (YYYY-MM-DD)" -> "Date "
    .replace(/\([^)]*\)/g, " ")
    // strip trailing % sign and the word "percent"/"percentage"
    .replace(/%/g, " ")
    .replace(/\bpercent(age)?\b/g, " ")
    // separators
    .replace(/[_\-\.\/\\,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Find the row index that contains the most known header names. Returns 0 if first row already looks like headers. */
function detectHeaderRow(rows: unknown[][]): number {
  if (rows.length === 0) return 0;
  let bestIdx = 0;
  let bestScore = -1;
  const limit = Math.min(rows.length, 10);
  for (let i = 0; i < limit; i++) {
    const r = rows[i] ?? [];
    let score = 0;
    let nonEmpty = 0;
    for (const cell of r) {
      const v = cellToString(cell);
      if (!v) continue;
      nonEmpty++;
      const norm = normalizeHeader(v);
      if (FIELD_ALIASES[norm]) score++;
      // Accept partial matches like "Taxable Value" appearing inside a cell
      else for (const key of Object.keys(FIELD_ALIASES)) {
        if (norm.includes(key)) { score++; break; }
      }
    }
    // Prefer rows that look like headers (multiple matches and not just one big merged title cell)
    if (score >= 2 && nonEmpty >= 3 && score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** Coerce any cell value (string | number | Date | boolean) to a trimmed string. */
function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return "";
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v).trim();
}

function parseBool(v: string): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "yes" || s === "y" || s === "true" || s === "1" || s === "blocked";
}

function parseUsage(v: string): UsageType {
  const val = v.trim().toLowerCase();
  if (val.includes("taxable") || val === "t") return "taxable";
  if (val.includes("exempt") || val === "e") return "exempt";
  if (val.includes("non-business") || val.includes("non business") || val === "nb" || val === "personal" || val === "p" || val.includes("personal")) return "non-business";
  return "common";
}

function parseNonBusinessUse(v: string): NonBusinessUseType {
  const val = (v ?? "").trim().toLowerCase();
  if (val.includes("partial") || val.includes("d2")) return "partial_personal";
  if (val.includes("100% personal") || val.includes("100_personal") || val === "personal" || val === "t1") return "100_personal";
  return "100_business";
}

function parseItemType(v: string): ItemType {
  const val = v.trim().toLowerCase();
  if (val.includes("service") || val === "s") return "service";
  if (val.includes("input") || val === "i") return "input";
  return "capital_good";
}

function parseDate(v: string): string {
  if (!v) return "";
  const s = v.trim();

  // Match dd-mm-yyyy, dd/mm/yyyy, or dd.mm.yyyy
  const ddmmyyyyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = ddmmyyyyMatch[1].padStart(2, "0");
    const month = ddmmyyyyMatch[2].padStart(2, "0");
    const year = ddmmyyyyMatch[3];
    return `${year}-${month}-${day}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return "";
}

const NUMERIC_FIELDS = new Set<keyof ParsedRow>([
  "taxableValue", "igstRate", "cgstRate", "sgstRate", "gstRate",
  "igstAmount", "cgstAmount", "sgstAmount"
]);

function rowToInvoice(row: ParsedRow): Invoice {
  const base = newInvoice();
  // Resolve final IGST/CGST/SGST rates.
  // Priority: explicit igstRate/cgstRate/sgstRate > legacy gstRate (treated as IGST) > default 18% IGST
  const hasExplicit = row.igstRate !== undefined || row.cgstRate !== undefined || row.sgstRate !== undefined;
  const igstRate = hasExplicit ? (row.igstRate ?? 0) : (row.gstRate ?? 18);
  const cgstRate = hasExplicit ? (row.cgstRate ?? 0) : 0;
  const sgstRate = hasExplicit ? (row.sgstRate ?? 0) : 0;

  let usage = row.usage ?? "taxable";
  let nonBusinessUse = row.nonBusinessUse ?? "100_business";

  if (usage === "non-business") {
    nonBusinessUse = "100_personal";
  }

  return {
    ...base,
    invoiceNo: row.invoiceNo ?? "",
    supplier: row.supplier ?? "",
    gstin: row.gstin ? row.gstin.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15) : "",
    assetName: row.assetName ?? "",
    purchaseDate: row.purchaseDate ?? "",
    taxableValue: row.taxableValue ?? 0,
    igstRate,
    cgstRate,
    sgstRate,
    igstAmount: row.igstAmount,
    cgstAmount: row.cgstAmount,
    sgstAmount: row.sgstAmount,
    usage,
    nonBusinessUse,
    itemType: row.itemType ?? "capital_good",
    notes: row.notes,
    blockCredit: row.blockCredit ?? false,
  };
}

function parseRawRows(rawRows: Record<string, string>[]): { invoices: Invoice[]; skipped: number } {
  if (rawRows.length === 0) return { invoices: [], skipped: 0 };

  const headers = Object.keys(rawRows[0]);
  const fieldMap: Partial<Record<keyof ParsedRow, string>> = {};

  for (const h of headers) {
    const norm = normalizeHeader(h);
    const mapped = FIELD_ALIASES[norm];
    if (mapped) fieldMap[mapped] = h;
  }

  const invoices: Invoice[] = [];
  let skipped = 0;

  for (const raw of rawRows) {
    const row: ParsedRow = {};
    for (const [field, origHeader] of Object.entries(fieldMap) as [keyof ParsedRow, string][]) {
      const rawVal = (raw as Record<string, unknown>)[origHeader];
      // Handle Date objects directly for purchaseDate (xlsx returns Date with cellDates:true)
      if (field === "purchaseDate" && rawVal instanceof Date && !isNaN(rawVal.getTime())) {
        row.purchaseDate = `${rawVal.getFullYear()}-${String(rawVal.getMonth() + 1).padStart(2, "0")}-${String(rawVal.getDate()).padStart(2, "0")}`;
        continue;
      }
      const val = cellToString(rawVal);
      if (!val) continue;
      if (NUMERIC_FIELDS.has(field)) {
        const n = parseFloat(val.replace(/[₹,\s]/g, ""));
        if (!isNaN(n)) (row as any)[field] = n;
      } else if (field === "purchaseDate") {
        row.purchaseDate = parseDate(val);
      } else if (field === "usage") {
        row.usage = parseUsage(val);
      } else if (field === "nonBusinessUse") {
        row.nonBusinessUse = parseNonBusinessUse(val);
      } else if (field === "itemType") {
        row.itemType = parseItemType(val);
      } else if (field === "blockCredit") {
        row.blockCredit = parseBool(val);
      } else {
        (row as any)[field] = val;
      }
    }

    if (!row.taxableValue || !row.purchaseDate) {
      skipped++;
      continue;
    }

    // Check if this row is a Credit Note linked to a parent invoice
    const isCreditNote = row.docType === "credit_note" || (row.originalInvoiceNo && row.originalInvoiceNo.trim() !== "");
    if (isCreditNote && row.originalInvoiceNo) {
      const origNoClean = row.originalInvoiceNo.trim().toLowerCase();
      const parentInv = invoices.find((i) => i.invoiceNo.trim().toLowerCase() === origNoClean);
      if (parentInv) {
        if (!parentInv.creditNotes) parentInv.creditNotes = [];
        parentInv.creditNotes.push({
          id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()),
          creditNoteNo: row.invoiceNo || "CN-" + (parentInv.creditNotes.length + 1),
          date: row.purchaseDate,
          taxableValue: Math.abs(row.taxableValue),
          igstRate: row.igstRate ?? parentInv.igstRate,
          cgstRate: row.cgstRate ?? parentInv.cgstRate,
          sgstRate: row.sgstRate ?? parentInv.sgstRate,
          igstAmount: row.igstAmount,
          cgstAmount: row.cgstAmount,
          sgstAmount: row.sgstAmount,
          includeMonthInReversal: true,
        });
        continue;
      }
    }

    invoices.push(rowToInvoice(row));
  }

  return { invoices, skipped };
}

async function parseFile(file: File): Promise<{ invoices: Invoice[]; skipped: number; error?: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv") {
    return new Promise((resolve) => {
      // Read CSV WITHOUT auto-headers so we can detect a real header row
      // (the exported template has a title row above the headers).
      Papa.parse<string[]>(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const aoa = (results.data || []) as unknown[][];
          if (aoa.length === 0) { resolve({ invoices: [], skipped: 0 }); return; }
          const headerRow = detectHeaderRow(aoa);
          const headers = (aoa[headerRow] ?? []).map((c) => cellToString(c));
          const rawRows: Record<string, unknown>[] = aoa.slice(headerRow + 1).map((r) => {
            const obj: Record<string, unknown> = {};
            headers.forEach((h, i) => { if (h) obj[h] = r[i]; });
            return obj;
          }).filter((obj) => Object.values(obj).some((v) => cellToString(v) !== ""));
          resolve(parseRawRows(rawRows as Record<string, string>[]));
        },
        error: (err) => resolve({ invoices: [], skipped: 0, error: err.message }),
      });
    });
  }

  if (ext === "xlsx" || ext === "xls") {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const allRawRows: Record<string, string>[] = [];
      
      // Collect raw rows across all sheets (Invoices, Credit Notes, etc.)
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", blankrows: false }) as unknown[][];
        if (aoa.length === 0) continue;
        const headerRow = detectHeaderRow(aoa);
        const headers = (aoa[headerRow] ?? []).map((c) => cellToString(c));
        
        // Skip legend/reference sheets that match zero known invoice headers
        let knownHeadersCount = 0;
        headers.forEach((h) => {
          const norm = normalizeHeader(h);
          if (FIELD_ALIASES[norm]) knownHeadersCount++;
        });
        if (knownHeadersCount === 0) continue;

        const dataRows = aoa.slice(headerRow + 1);
        const rawRows = dataRows.map((r) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { if (h) obj[h] = r[i]; });
          return obj;
        }).filter((obj) => Object.values(obj).some((v) => cellToString(v) !== ""));

        allRawRows.push(...(rawRows as Record<string, string>[]));
      }

      return parseRawRows(allRawRows);
    } catch (e) {
      return { invoices: [], skipped: 0, error: String(e) };
    }
  }

  return { invoices: [], skipped: 0, error: "Unsupported file type. Use .csv, .xlsx, or .xls" };
}

export function ImportModal({ open, onClose, onImport }: Props) {
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState<{ invoices: Invoice[]; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => { setParsed(null); setError(null); };

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setParsed(null);
    const result = await parseFile(file);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.invoices.length === 0 && result.skipped === 0) {
      setError("File appears to be empty. Please add at least one row of invoice data.");
    } else if (result.invoices.length === 0) {
      setError(`All ${result.skipped} row${result.skipped === 1 ? "" : "s"} were skipped because they are missing the required 'Taxable Value' and 'Purchase Date'. Column headers are matched flexibly (case-insensitive, with spaces, underscores, or camelCase).`);
    } else {
      setParsed(result);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleImport = () => {
    if (parsed) {
      onImport(parsed.invoices);
      reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle>Import invoices from CSV / Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 overflow-y-auto pr-1">
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3">
            <div className="text-xs">
              <p className="font-medium text-foreground">Need a starting point?</p>
              <p className="text-muted-foreground mt-0.5">Download our colour-coded Excel template with sample rows &amp; field reference.</p>
            </div>
            <Button type="button" variant="default" size="sm" onClick={() => downloadImportTemplate()} className="shrink-0">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Template
            </Button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Upload a CSV or Excel (.xlsx / .xls) file with your capital goods invoices.</p>
            <p>Required columns: <strong>Taxable Value</strong>, <strong>Purchase Date</strong></p>
            <p>Optional: Invoice Number, Supplier, Supplier GSTIN, Asset Description, <strong>IGST/CGST/SGST Rate</strong>, Usage, <strong>Block Credit</strong> (Yes/No), Notes</p>
          </div>

          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"} cursor-pointer`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById("import-file-input")?.click()}
          >
            <input id="import-file-input" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onInputChange} />
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-sm">Parsing file…</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-medium">Drop file here or click to browse</p>
                  <p className="text-xs mt-1">CSV, XLSX, XLS supported</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-1">
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Choose file
                </Button>
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {parsed && (
            <Alert className="border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-sm">
                <span className="font-medium text-green-700 dark:text-green-400">{parsed.invoices.length} invoice{parsed.invoices.length !== 1 ? "s" : ""} ready to import</span>
                {parsed.skipped > 0 && <span className="text-muted-foreground"> · {parsed.skipped} rows skipped (missing required fields)</span>}
                <div className="mt-2 flex flex-wrap gap-1">
                  {parsed.invoices.slice(0, 5).map((inv, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {inv.invoiceNo || inv.assetName || `Row ${i + 1}`}
                    </Badge>
                  ))}
                  {parsed.invoices.length > 5 && <Badge variant="outline" className="text-[10px]">+{parsed.invoices.length - 5} more</Badge>}
                </div>
              </AlertDescription>
            </Alert>
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button disabled={!parsed || loading} onClick={handleImport}>
            Import {parsed ? `${parsed.invoices.length} invoice${parsed.invoices.length !== 1 ? "s" : ""}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
