import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, FileText, Upload, Search } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { type Invoice, formatINR, computeItcComponents, totalGstRate } from "@/lib/rule43";
import { InvoiceForm } from "./InvoiceForm";
import { ImportModal } from "./ImportModal";

interface Props {
  invoices: Invoice[];
  onSave: (inv: Invoice) => void;
  onDelete: (id: string) => void;
  onImport: (invoices: Invoice[]) => void;
}

export function InvoiceRegister({ invoices, onSave, onDelete, onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const totalCount = invoices.length;
  const totalItc = invoices.reduce((s, inv) => {
    const { igstItc, cgstItc, sgstItc } = computeItcComponents(inv.taxableValue, inv);
    return s + igstItc + cgstItc + sgstItc;
  }, 0);

  const filteredInvoices = invoices.filter((inv) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (inv.invoiceNo || "").toLowerCase().includes(query) ||
      (inv.assetName || "").toLowerCase().includes(query) ||
      (inv.supplier || "").toLowerCase().includes(query) ||
      (inv.notes || "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-5">
      <Accordion type="single" collapsible>
        <AccordionItem value="rule43" className="border rounded-lg px-4 bg-muted/30">
          <AccordionTrigger className="text-sm font-medium">What is Rule 43?</AccordionTrigger>
          <AccordionContent className="text-sm leading-relaxed text-muted-foreground space-y-2">
            <p>Rule 43 (CGST Rules) governs ITC on capital goods used partly for taxable and partly for exempt supplies. ITC is amortized over 60 months.</p>
            <p>Each month, the portion attributable to exempt supplies must be reversed in GSTR-3B Table 4(B)(1). IGST, CGST, and SGST reversals are reported separately.</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Capital Goods Register</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {totalCount} invoice{totalCount === 1 ? "" : "s"} · Total ITC <span className="num font-medium text-foreground">{formatINR(totalItc)}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Import
            </Button>
            <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add invoice
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No invoices yet. Add your first capital goods invoice to get started.</p>
              <Button variant="outline" size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add invoice
              </Button>
            </div>
          ) : (
            <>
              <div className="p-4 border-b bg-muted/10">
                <div className="relative max-w-md w-full">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search invoices by number, asset, supplier, or notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 text-xs pl-9 bg-background w-full"
                  />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier / Asset</TableHead>
                    <TableHead className="text-right">Taxable Value</TableHead>
                    <TableHead className="text-right">GST Type</TableHead>
                    <TableHead className="text-right">ITC (IGST / CGST / SGST)</TableHead>
                    <TableHead className="text-right">Monthly Tm</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                        No invoices match your search query "{searchQuery}".
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const { igstItc: grossIgst, cgstItc: grossCgst, sgstItc: grossSgst } = computeItcComponents(inv.taxableValue, inv);
                      const grossTc = grossIgst + grossCgst + grossSgst;
                      const cnItc = (inv.creditNotes ?? []).reduce((s, cn) => {
                        const { igstItc, cgstItc, sgstItc } = computeItcComponents(cn.taxableValue, cn);
                        return s + igstItc + cgstItc + sgstItc;
                      }, 0);
                      const dnItc = (inv.debitNotes ?? []).reduce((s, dn) => {
                        const { igstItc, cgstItc, sgstItc } = computeItcComponents(dn.taxableValue, dn);
                        return s + igstItc + cgstItc + sgstItc;
                      }, 0);
                      const netTc = Math.max(0, grossTc - cnItc + dnItc);
                      const tm = netTc / 60;
                      const cnCount = (inv.creditNotes ?? []).length;
                      const dnCount = (inv.debitNotes ?? []).length;
                      const isInterstate = (inv.igstRate || 0) > 0;
                      const gstTotal = totalGstRate(inv);

                      return (
                        <TableRow key={inv.id} className="hover:bg-muted/40">
                          <TableCell className="font-medium text-sm">{inv.invoiceNo || "—"}</TableCell>
                          <TableCell className="text-sm">{inv.purchaseDate || "—"}</TableCell>
                          <TableCell>
                            <div className="text-sm">{inv.assetName || "—"}</div>
                            <div className="text-xs text-muted-foreground">{inv.supplier || "—"}</div>
                          </TableCell>
                          <TableCell className="text-right num text-sm">{formatINR(inv.taxableValue)}</TableCell>
                          <TableCell className="text-right text-xs">
                            <div className="font-medium">{gstTotal}%</div>
                            <div className="text-muted-foreground">{isInterstate ? "IGST" : `C${inv.cgstRate}+S${inv.sgstRate}`}</div>
                          </TableCell>
                          <TableCell className="text-right num text-sm font-medium">
                            <div>{formatINR(netTc)}</div>
                            <div className="text-[10px] text-muted-foreground leading-tight">
                              {grossIgst > 0 && <span>I:{formatINR(grossIgst)} </span>}
                              {grossCgst > 0 && <span>C:{formatINR(grossCgst)} </span>}
                              {grossSgst > 0 && <span>S:{formatINR(grossSgst)}</span>}
                            </div>
                            {cnCount > 0 && <div className="text-[10px] text-destructive">−{formatINR(cnItc)} CN</div>}
                            {dnCount > 0 && <div className="text-[10px] text-green-600 dark:text-green-400">+{formatINR(dnItc)} DN</div>}
                          </TableCell>
                          <TableCell className="text-right num text-sm">{formatINR(tm)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline" className="text-[10px] capitalize">{inv.usage}</Badge>
                              {inv.disposal.enabled && <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">Disposed</Badge>}
                              {inv.usageChange.enabled && <Badge variant="outline" className="text-[10px]">Usage chg</Badge>}
                              {cnCount > 0 && <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-400/30">{cnCount} CN</Badge>}
                              {dnCount > 0 && <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 dark:text-green-400 border-green-400/30">{dnCount} DN</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(inv); setOpen(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setConfirmDelete(inv.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <InvoiceForm open={open} initial={editing} onClose={() => setOpen(false)} onSave={onSave} />

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImport={onImport} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the invoice and its Rule 43 calculation. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmDelete) onDelete(confirmDelete); setConfirmDelete(null); }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
