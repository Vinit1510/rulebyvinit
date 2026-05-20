import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { PlusCircle, Trash2 } from "lucide-react";
import {
  type Invoice, type CreditNote, type DebitNote, type GstComponents,
  formatINR, newInvoice as makeInvoice, newCreditNote, newDebitNote, type UsageType,
  totalGstRate, computeItcComponents,
} from "@/lib/rule43";

interface Props {
  open: boolean;
  initial?: Invoice | null;
  onClose: () => void;
  onSave: (inv: Invoice) => void;
}

type SupplyType = "interstate" | "intrastate";

function supplyTypeOf(g: GstComponents): SupplyType {
  return (Number(g.igstRate) || 0) > 0 ? "interstate" : "intrastate";
}

function GstRateFields({
  g,
  onChange,
}: {
  g: GstComponents;
  onChange: (p: Partial<GstComponents>) => void;
}) {
  const supplyType = supplyTypeOf(g);

  const switchSupply = (t: SupplyType) => {
    const rate = totalGstRate(g);
    if (t === "interstate") {
      onChange({ igstRate: rate, cgstRate: 0, sgstRate: 0 });
    } else {
      onChange({ igstRate: 0, cgstRate: rate / 2, sgstRate: rate / 2 });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => switchSupply("interstate")}
          className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${supplyType === "interstate" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/50"}`}
        >
          Interstate (IGST)
        </button>
        <button
          type="button"
          onClick={() => switchSupply("intrastate")}
          className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${supplyType === "intrastate" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/50"}`}
        >
          Intrastate (CGST + SGST)
        </button>
      </div>
      {supplyType === "interstate" ? (
        <div className="grid grid-cols-1">
          <Field label="IGST rate (%) *">
            <Input
              type="number" min={0} max={100} step={0.1} className="num"
              value={g.igstRate || ""}
              onChange={(e) => onChange({ igstRate: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Field label="CGST rate (%) *">
            <Input
              type="number" min={0} max={100} step={0.1} className="num"
              value={g.cgstRate || ""}
              onChange={(e) => onChange({ cgstRate: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="SGST/UTGST rate (%) *">
            <Input
              type="number" min={0} max={100} step={0.1} className="num"
              value={g.sgstRate || ""}
              onChange={(e) => onChange({ sgstRate: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

export function InvoiceForm({ open, initial, onClose, onSave }: Props) {
  const [inv, setInv] = useState<Invoice>(initial ?? makeInvoice());

  useEffect(() => {
    setInv(initial
      ? { ...initial, creditNotes: initial.creditNotes ?? [], debitNotes: initial.debitNotes ?? [] }
      : makeInvoice());
  }, [initial, open]);

  const { igstItc: grossIgstItc, cgstItc: grossCgstItc, sgstItc: grossSgstItc } = computeItcComponents(inv.taxableValue, inv);
  const grossTotalItc = grossIgstItc + grossCgstItc + grossSgstItc;

  const creditNotes = inv.creditNotes ?? [];
  const debitNotes = inv.debitNotes ?? [];

  const totalCnItc = creditNotes.reduce((s, cn) => {
    const { igstItc, cgstItc, sgstItc } = computeItcComponents(cn.taxableValue, cn);
    return s + igstItc + cgstItc + sgstItc;
  }, 0);
  const totalDnItc = debitNotes.reduce((s, dn) => {
    const { igstItc, cgstItc, sgstItc } = computeItcComponents(dn.taxableValue, dn);
    return s + igstItc + cgstItc + sgstItc;
  }, 0);

  const netTotalItc = Math.max(0, grossTotalItc - totalCnItc + totalDnItc);
  const monthlyItc = netTotalItc / 60;

  const update = (p: Partial<Invoice>) => setInv((s) => ({ ...s, ...p }));
  const updateGst = (p: Partial<GstComponents>) => setInv((s) => ({
    ...s, ...p,
    ...(p.igstRate !== undefined ? { cgstRate: 0, sgstRate: 0 } : {}),
  }));

  const handleGstChange = (p: Partial<GstComponents>) => {
    if (p.igstRate !== undefined && p.cgstRate === 0 && p.sgstRate === 0) {
      setInv((s) => ({ ...s, igstRate: p.igstRate!, cgstRate: 0, sgstRate: 0 }));
    } else {
      setInv((s) => ({ ...s, ...p }));
    }
  };

  const addCreditNote = () => update({ creditNotes: [...creditNotes, newCreditNote(inv)] });
  const updateCreditNote = (id: string, changes: Partial<CreditNote>) =>
    update({ creditNotes: creditNotes.map((cn) => cn.id === id ? { ...cn, ...changes } : cn) });
  const removeCreditNote = (id: string) =>
    update({ creditNotes: creditNotes.filter((cn) => cn.id !== id) });

  const addDebitNote = () => update({ debitNotes: [...debitNotes, newDebitNote(inv)] });
  const updateDebitNote = (id: string, changes: Partial<DebitNote>) =>
    update({ debitNotes: debitNotes.map((dn) => dn.id === id ? { ...dn, ...changes } : dn) });
  const removeDebitNote = (id: string) =>
    update({ debitNotes: debitNotes.filter((dn) => dn.id !== id) });

  const valid =
    inv.purchaseDate &&
    inv.taxableValue > 0 &&
    totalGstRate(inv) > 0 &&
    (!inv.disposal.enabled || !!inv.disposal.date) &&
    (!inv.usageChange.enabled || (!!inv.usageChange.date && !!inv.usageChange.newUsage)) &&
    creditNotes.every((cn) => cn.date && cn.taxableValue > 0 && totalGstRate(cn) > 0) &&
    debitNotes.every((dn) => dn.date && dn.taxableValue > 0 && totalGstRate(dn) > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit invoice" : "Add capital goods invoice"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Basic fields */}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Invoice number">
              <Input value={inv.invoiceNo} onChange={(e) => update({ invoiceNo: e.target.value })} placeholder="INV-001" />
            </Field>
            <Field label="Supplier name">
              <Input value={inv.supplier} onChange={(e) => update({ supplier: e.target.value })} placeholder="Supplier Pvt Ltd" />
            </Field>
            <Field label="Asset description">
              <Input value={inv.assetName} onChange={(e) => update({ assetName: e.target.value })} placeholder="e.g. CNC Machine" />
            </Field>
            <Field label="Purchase date *">
              <Input type="date" value={inv.purchaseDate} onChange={(e) => update({ purchaseDate: e.target.value })} />
            </Field>
            <Field label="Taxable value (₹) *">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                <Input
                  type="number" min={0} className="pl-7 num"
                  value={inv.taxableValue || ""}
                  onChange={(e) => update({ taxableValue: Number(e.target.value) || 0 })}
                />
              </div>
            </Field>
          </div>

          {/* GST rates */}
          <div>
            <Label className="text-xs mb-2 block">GST rate *</Label>
            <GstRateFields g={inv} onChange={(p) => setInv((s) => ({ ...s, ...p }))} />
          </div>

          {/* ITC summary */}
          <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1.5">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {grossIgstItc > 0 && <span>IGST ITC: <strong className="num text-foreground">{formatINR(grossIgstItc)}</strong></span>}
              {grossCgstItc > 0 && <span>CGST ITC: <strong className="num text-foreground">{formatINR(grossCgstItc)}</strong></span>}
              {grossSgstItc > 0 && <span>SGST ITC: <strong className="num text-foreground">{formatINR(grossSgstItc)}</strong></span>}
              <span>Gross ITC: <strong className="num text-foreground">{formatINR(grossTotalItc)}</strong></span>
            </div>
            {(totalCnItc > 0 || totalDnItc > 0) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                {totalCnItc > 0 && <span className="text-destructive">CN: −{formatINR(totalCnItc)}</span>}
                {totalDnItc > 0 && <span className="text-green-600 dark:text-green-400">DN: +{formatINR(totalDnItc)}</span>}
              </div>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-1 font-medium">
              <span>Net ITC (Tc): <strong className="num text-foreground">{formatINR(netTotalItc)}</strong></span>
              <span>Monthly Tm: <strong className="num text-foreground">{formatINR(monthlyItc)}</strong></span>
              <span className="text-muted-foreground font-normal">over 60 months</span>
            </div>
          </div>

          {/* Usage type */}
          <div className="space-y-2">
            <Label>Usage type</Label>
            <RadioGroup value={inv.usage} onValueChange={(v) => update({ usage: v as UsageType })} className="grid grid-cols-3 gap-2">
              {(["taxable", "exempt", "common"] as UsageType[]).map((u) => (
                <label key={u} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 hover-elevate text-sm">
                  <RadioGroupItem value={u} />
                  <span className="capitalize">{u === "common" ? "Common Use" : u === "taxable" ? "Taxable only" : "Exempt only"}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Block Credit (Section 17(5)) */}
          <div className={`rounded-md border p-3 ${inv.blockCredit ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Block credit u/s 17(5)</Label>
                <p className="text-xs text-muted-foreground">
                  Mark this if the ITC is blocked under Section 17(5) — e.g. motor vehicles, food &amp; beverages,
                  personal-use items. The full ITC will be shown as <span className="font-medium text-destructive">ineligible</span>.
                </p>
              </div>
              <Switch
                checked={!!inv.blockCredit}
                onCheckedChange={(v) => update({ blockCredit: v })}
              />
            </div>
          </div>

          <Separator />

          {/* Credit Notes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Credit notes against this invoice</Label>
                <p className="text-xs text-muted-foreground">Supplier credit notes that reduce the ITC of this invoice.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addCreditNote} className="flex items-center gap-1.5 text-xs">
                <PlusCircle className="h-3.5 w-3.5" /> Add Credit Note
              </Button>
            </div>
            {creditNotes.length === 0 && <p className="text-xs text-muted-foreground pl-1 italic">No credit notes added yet.</p>}
            {creditNotes.map((cn, idx) => {
              const { igstItc, cgstItc, sgstItc } = computeItcComponents(cn.taxableValue, cn);
              const cnItc = igstItc + cgstItc + sgstItc;
              return (
                <div key={cn.id} className="rounded-md border border-dashed border-border/70 bg-muted/20 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Credit Note #{idx + 1}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeCreditNote(cn.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Field label="Credit note number *">
                      <Input value={cn.creditNoteNo} onChange={(e) => updateCreditNote(cn.id, { creditNoteNo: e.target.value })} placeholder="CN-001" />
                    </Field>
                    <Field label="Credit note date *">
                      <Input type="date" value={cn.date} onChange={(e) => updateCreditNote(cn.id, { date: e.target.value })} />
                    </Field>
                    <Field label="Taxable value (₹) *">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                        <Input type="number" min={0} className="pl-7 num" value={cn.taxableValue || ""}
                          onChange={(e) => updateCreditNote(cn.id, { taxableValue: Number(e.target.value) || 0 })} />
                      </div>
                    </Field>
                  </div>
                  <div>
                    <Label className="text-xs mb-2 block">GST rate *</Label>
                    <GstRateFields g={cn} onChange={(p) => updateCreditNote(cn.id, p as Partial<CreditNote>)} />
                  </div>
                  {cnItc > 0 && (
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4">
                      {igstItc > 0 && <span>IGST: <strong className="num text-destructive">−{formatINR(igstItc)}</strong></span>}
                      {cgstItc > 0 && <span>CGST: <strong className="num text-destructive">−{formatINR(cgstItc)}</strong></span>}
                      {sgstItc > 0 && <span>SGST: <strong className="num text-destructive">−{formatINR(sgstItc)}</strong></span>}
                      <span>Total ITC reduction: <strong className="num text-destructive">−{formatINR(cnItc)}</strong></span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 pt-1">
                    <Checkbox id={`cn-reversal-${cn.id}`} checked={cn.includeMonthInReversal}
                      onCheckedChange={(v) => updateCreditNote(cn.id, { includeMonthInReversal: !!v })} className="mt-0.5" />
                    <div>
                      <label htmlFor={`cn-reversal-${cn.id}`} className="text-xs font-medium cursor-pointer">
                        Include credit note month in reversal calculation
                      </label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {cn.includeMonthInReversal
                          ? "The month this CN is received will have a reversal applied on the CN ITC based on the usage ratio."
                          : "No reversal for the month this CN is received — only the ITC reduction takes effect."}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Debit Notes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Debit notes against this invoice</Label>
                <p className="text-xs text-muted-foreground">Supplier debit notes that increase the ITC (e.g. price revision upwards).</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addDebitNote} className="flex items-center gap-1.5 text-xs">
                <PlusCircle className="h-3.5 w-3.5" /> Add Debit Note
              </Button>
            </div>
            {debitNotes.length === 0 && <p className="text-xs text-muted-foreground pl-1 italic">No debit notes added yet.</p>}
            {debitNotes.map((dn, idx) => {
              const { igstItc, cgstItc, sgstItc } = computeItcComponents(dn.taxableValue, dn);
              const dnItc = igstItc + cgstItc + sgstItc;
              return (
                <div key={dn.id} className="rounded-md border border-dashed border-green-500/30 bg-green-50/20 dark:bg-green-950/10 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">Debit Note #{idx + 1}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeDebitNote(dn.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Field label="Debit note number *">
                      <Input value={dn.debitNoteNo} onChange={(e) => updateDebitNote(dn.id, { debitNoteNo: e.target.value })} placeholder="DN-001" />
                    </Field>
                    <Field label="Debit note date *">
                      <Input type="date" value={dn.date} onChange={(e) => updateDebitNote(dn.id, { date: e.target.value })} />
                    </Field>
                    <Field label="Taxable value (₹) *">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                        <Input type="number" min={0} className="pl-7 num" value={dn.taxableValue || ""}
                          onChange={(e) => updateDebitNote(dn.id, { taxableValue: Number(e.target.value) || 0 })} />
                      </div>
                    </Field>
                  </div>
                  <div>
                    <Label className="text-xs mb-2 block">GST rate *</Label>
                    <GstRateFields g={dn} onChange={(p) => updateDebitNote(dn.id, p as Partial<DebitNote>)} />
                  </div>
                  {dnItc > 0 && (
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4">
                      {igstItc > 0 && <span>IGST: <strong className="num text-green-600 dark:text-green-400">+{formatINR(igstItc)}</strong></span>}
                      {cgstItc > 0 && <span>CGST: <strong className="num text-green-600 dark:text-green-400">+{formatINR(cgstItc)}</strong></span>}
                      {sgstItc > 0 && <span>SGST: <strong className="num text-green-600 dark:text-green-400">+{formatINR(sgstItc)}</strong></span>}
                      <span>Total ITC addition: <strong className="num text-green-600 dark:text-green-400">+{formatINR(dnItc)}</strong></span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 pt-1">
                    <Checkbox id={`dn-reversal-${dn.id}`} checked={dn.includeMonthInReversal}
                      onCheckedChange={(v) => updateDebitNote(dn.id, { includeMonthInReversal: !!v })} className="mt-0.5" />
                    <div>
                      <label htmlFor={`dn-reversal-${dn.id}`} className="text-xs font-medium cursor-pointer">
                        Include debit note month in reversal calculation
                      </label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dn.includeMonthInReversal
                          ? "The month this DN is received will use the increased Tm for reversal."
                          : "The Tm increase takes effect from the following month."}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Disposal */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Disposal before 60 months</Label>
                <p className="text-xs text-muted-foreground">Sold/scrapped/returned early — triggers full remaining-ITC reversal.</p>
              </div>
              <Switch checked={inv.disposal.enabled} onCheckedChange={(v) => update({ disposal: { ...inv.disposal, enabled: v } })} />
            </div>
            {inv.disposal.enabled && (
              <div className="grid gap-3 md:grid-cols-3 pl-1">
                <Field label="Disposal date *">
                  <Input type="date" value={inv.disposal.date ?? ""} onChange={(e) => update({ disposal: { ...inv.disposal, date: e.target.value } })} />
                </Field>
                <Field label="Sale value (₹)">
                  <Input type="number" min={0} className="num" placeholder="Optional"
                    value={inv.disposal.saleValue ?? ""}
                    onChange={(e) => update({ disposal: { ...inv.disposal, saleValue: Number(e.target.value) || 0 } })} />
                </Field>
                <Field label="GST on sale (%)">
                  <Input type="number" min={0} max={100} step={0.1} className="num" placeholder="Optional"
                    value={inv.disposal.saleGstRate ?? ""}
                    onChange={(e) => update({ disposal: { ...inv.disposal, saleGstRate: Number(e.target.value) || 0 } })} />
                </Field>
              </div>
            )}
          </div>

          <Separator />

          {/* Usage change */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Change in usage type</Label>
                <p className="text-xs text-muted-foreground">Mid-life switch between taxable / exempt / common.</p>
              </div>
              <Switch checked={inv.usageChange.enabled} onCheckedChange={(v) => update({ usageChange: { ...inv.usageChange, enabled: v } })} />
            </div>
            {inv.usageChange.enabled && (
              <div className="grid gap-3 md:grid-cols-2 pl-1">
                <Field label="Change date *">
                  <Input type="date" value={inv.usageChange.date ?? ""} onChange={(e) => update({ usageChange: { ...inv.usageChange, date: e.target.value } })} />
                </Field>
                <Field label="New usage *">
                  <Select value={inv.usageChange.newUsage ?? ""} onValueChange={(v) => update({ usageChange: { ...inv.usageChange, newUsage: v as UsageType } })}>
                    <SelectTrigger><SelectValue placeholder="Select new usage" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="taxable">Exclusively Taxable</SelectItem>
                      <SelectItem value="exempt">Exclusively Exempt</SelectItem>
                      <SelectItem value="common">Common Use</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}
          </div>

          <Field label="Notes">
            <Input value={inv.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} placeholder="Optional notes" />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid} onClick={() => { onSave(inv); onClose(); }}>
            {initial ? "Save changes" : "Add invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
