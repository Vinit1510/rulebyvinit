import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, ChevronDown, Info } from "lucide-react";
import { type MonthlyTurnover, formatINR, monthKey, monthLabel } from "@/lib/rule43";

interface Props {
  months: Date[];
  turnover: Record<string, MonthlyTurnover>;
  setTurnover: (key: string, t: MonthlyTurnover) => void;
  applyToAll: (keys: string[], t: MonthlyTurnover) => void;
}

function fyOf(d: Date): { key: string; label: string; startYear: number } {
  const y = d.getFullYear();
  const m = d.getMonth();
  const startYear = m >= 3 ? y : y - 1;
  return {
    key: `FY${startYear}`,
    label: `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`,
    startYear,
  };
}

interface PendingEdit {
  monthKey: string;
  monthLabel: string;
  next: MonthlyTurnover;
}

export function TurnoverTable({ months, turnover, setTurnover }: Props) {
  const [drafts, setDrafts] = useState<Record<string, { exempt: string; taxable: string }>>({});
  const [pending, setPending] = useState<PendingEdit | null>(null);

  const allFyGroups = useMemo(() => {
    const map = new Map<string, { label: string; startYear: number; months: Date[] }>();
    for (const d of months) {
      const fy = fyOf(d);
      if (!map.has(fy.key)) map.set(fy.key, { label: fy.label, startYear: fy.startYear, months: [] });
      map.get(fy.key)!.months.push(d);
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => a.startYear - b.startYear);
  }, [months]);

  // Multi-select FY filter with explicit Save: `applied` is what the table shows;
  // `draft` is what's being toggled in the popover until user hits Save.
  const allKeys = useMemo(() => allFyGroups.map((g) => g.key), [allFyGroups]);
  const FILTER_STORAGE_KEY = "rule43.turnover.fyFilter";
  const loadSavedFys = (): string[] | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (!raw) return null;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : null;
    } catch {
      return null;
    }
  };
  const hasSaved = loadSavedFys() !== null;
  const [appliedFys, setAppliedFys] = useState<string[]>(() => loadSavedFys() ?? allKeys);
  const [draftFys, setDraftFys] = useState<string[]>(() => loadSavedFys() ?? allKeys);
  const [filterOpen, setFilterOpen] = useState(false);

  // Persist applied filter to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(appliedFys)); } catch { /* ignore */ }
  }, [appliedFys]);

  // Keep filter state in sync as FYs appear/disappear from data.
  // CRITICAL: do NOT auto-add new FYs to a saved selection — that would re-add
  // years the user explicitly excluded. Only seed defaults on the very first
  // visit (no localStorage entry yet).
  useEffect(() => {
    setAppliedFys((prev) => {
      const known = new Set(allKeys);
      const filtered = prev.filter((k) => known.has(k));
      // First-ever visit AND no FYs were knowable yet AND data has now arrived → default to ALL
      if (!hasSaved && prev.length === 0 && allKeys.length > 0) return allKeys;
      // Otherwise keep the user's selection (intersected with currently-known FYs)
      return filtered;
    });
    setDraftFys((prev) => {
      const known = new Set(allKeys);
      const filtered = prev.filter((k) => known.has(k));
      if (!hasSaved && prev.length === 0 && allKeys.length > 0) return allKeys;
      return filtered;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allKeys.join("|")]);

  const fyGroups = useMemo(() => {
    const set = new Set(appliedFys);
    return allFyGroups.filter((g) => set.has(g.key));
  }, [allFyGroups, appliedFys]);

  const filterLabel = useMemo(() => {
    if (appliedFys.length === 0) return "No FY selected";
    if (appliedFys.length === allFyGroups.length) return `All years (${allFyGroups.length})`;
    if (appliedFys.length === 1) {
      const g = allFyGroups.find((x) => x.key === appliedFys[0]);
      return g?.label ?? "1 FY";
    }
    return `${appliedFys.length} of ${allFyGroups.length} FYs`;
  }, [appliedFys, allFyGroups]);

  const toggleDraft = (key: string) => {
    setDraftFys((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };
  const draftAll = () => setDraftFys(allKeys);
  const draftNone = () => setDraftFys([]);
  const saveFilter = () => { setAppliedFys(draftFys); setFilterOpen(false); };
  const cancelFilter = () => { setDraftFys(appliedFys); setFilterOpen(false); };

  if (months.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground space-y-2">
          <Info className="h-8 w-8 mx-auto opacity-40" />
          <p className="text-sm">Add at least one invoice in the Invoices tab to see the monthly turnover schedule.</p>
        </CardContent>
      </Card>
    );
  }

  const fySummary = (group: { months: Date[] }) => {
    let exempt = 0, taxable = 0, filled = 0;
    for (const d of group.months) {
      const t = turnover[monthKey(d)];
      if (t && (t.exempt || t.taxable)) filled++;
      exempt += t?.exempt || 0;
      taxable += t?.taxable || 0;
    }
    const total = exempt + taxable;
    const ratio = total > 0 ? exempt / total : 0;
    return { exempt, taxable, total, ratio, filled, count: group.months.length };
  };

  const getDraft = (k: string, current: MonthlyTurnover, field: "exempt" | "taxable") => {
    const d = drafts[k];
    if (d && d[field] !== undefined) return d[field];
    return current[field] ? String(current[field]) : "";
  };

  const updateDraft = (k: string, field: "exempt" | "taxable", value: string) => {
    const sanitized = value.replace(/^-/, "");
    setDrafts((prev) => ({
      ...prev,
      [k]: {
        exempt: prev[k]?.exempt ?? "",
        taxable: prev[k]?.taxable ?? "",
        [field]: sanitized,
      },
    }));
  };

  const commitRow = (d: Date) => {
    const k = monthKey(d);
    const draft = drafts[k];
    if (!draft) return;
    const current = turnover[k] ?? { exempt: 0, taxable: 0 };
    const nextExempt = draft.exempt === "" ? current.exempt : Math.max(0, Number(draft.exempt) || 0);
    const nextTaxable = draft.taxable === "" ? current.taxable : Math.max(0, Number(draft.taxable) || 0);
    const next = { exempt: nextExempt, taxable: nextTaxable };
    if (next.exempt === current.exempt && next.taxable === current.taxable) {
      setDrafts((prev) => { const c = { ...prev }; delete c[k]; return c; });
      return;
    }
    setPending({ monthKey: k, monthLabel: monthLabel(d), next });
  };

  const confirmPending = () => {
    if (!pending) return;
    setTurnover(pending.monthKey, pending.next);
    setDrafts((prev) => { const c = { ...prev }; delete c[pending.monthKey]; return c; });
    setPending(null);
  };

  const cancelPending = () => {
    if (!pending) return;
    setDrafts((prev) => { const c = { ...prev }; delete c[pending.monthKey]; return c; });
    setPending(null);
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Monthly turnover by financial year</CardTitle>
              <p className="text-xs text-muted-foreground">
                {months.length} month(s) across {allFyGroups.length} FY. Click a year to expand. Values save automatically on leaving the field.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Show FY</span>
              <Popover open={filterOpen} onOpenChange={(o) => { setFilterOpen(o); if (o) setDraftFys(appliedFys); }}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 min-w-[200px] justify-between text-xs font-normal">
                    <span className="truncate">{filterLabel}</span>
                    <ChevronDown className="h-3.5 w-3.5 ml-2 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[260px] p-0">
                  <div className="flex items-center justify-between px-3 py-2 border-b text-xs">
                    <span className="font-medium">Select financial years</span>
                    <div className="flex gap-2">
                      <button type="button" className="text-primary hover:underline" onClick={draftAll}>All</button>
                      <button type="button" className="text-muted-foreground hover:underline" onClick={draftNone}>None</button>
                    </div>
                  </div>
                  <div className="max-h-[260px] overflow-y-auto py-1">
                    {allFyGroups.map((g) => {
                      const checked = draftFys.includes(g.key);
                      return (
                        <label
                          key={g.key}
                          className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 cursor-pointer"
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleDraft(g.key)} />
                          <span className="flex-1">{g.label}</span>
                          {checked && <Check className="h-3.5 w-3.5 text-primary" />}
                        </label>
                      );
                    })}
                    {allFyGroups.length === 0 && (
                      <div className="px-3 py-3 text-xs text-muted-foreground">No financial years yet.</div>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2 px-3 py-2 border-t bg-muted/30">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelFilter}>Cancel</Button>
                    <Button size="sm" className="h-7 text-xs" onClick={saveFilter}>Save</Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Accordion type="multiple" defaultValue={fyGroups.length > 0 ? [fyGroups[0].key] : []}>
            {fyGroups.map((g) => {
              const s = fySummary(g);
              return (
                <AccordionItem key={g.key} value={g.key}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-1 items-center justify-between gap-3 pr-3">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm">{g.label}</span>
                        <Badge variant="outline" className="text-[10px]">{s.filled}/{s.count} filled</Badge>
                      </div>
                      <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Exempt <span className="num text-foreground font-medium">{formatINR(s.exempt)}</span></span>
                        <span>Taxable <span className="num text-foreground font-medium">{formatINR(s.taxable)}</span></span>
                        <span>Ratio <span className="num text-foreground font-medium">{(s.ratio * 100).toFixed(1)}%</span></span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">Month</TableHead>
                          <TableHead className="text-right">Exempt T/O (₹)</TableHead>
                          <TableHead className="text-right">Taxable T/O (₹)</TableHead>
                          <TableHead className="text-right">Total (F)</TableHead>
                          <TableHead className="text-right w-[90px]">Ratio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.months.map((d) => {
                          const k = monthKey(d);
                          const t = turnover[k] ?? { exempt: 0, taxable: 0 };
                          const total = (t.exempt || 0) + (t.taxable || 0);
                          const ratio = total > 0 ? Math.min(t.exempt / total, 1) : 0;
                          return (
                            <TableRow key={k} className="hover:bg-muted/40">
                              <TableCell className="font-medium text-sm">{monthLabel(d)}</TableCell>
                              <TableCell>
                                <Input
                                  type="number" min={0} className="num text-right h-8" placeholder="0"
                                  value={getDraft(k, t, "exempt")}
                                  onChange={(e) => updateDraft(k, "exempt", e.target.value)}
                                  onBlur={() => commitRow(d)}
                                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number" min={0} className="num text-right h-8" placeholder="0"
                                  value={getDraft(k, t, "taxable")}
                                  onChange={(e) => updateDraft(k, "taxable", e.target.value)}
                                  onBlur={() => commitRow(d)}
                                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                />
                              </TableCell>
                              <TableCell className="text-right num text-sm">{formatINR(total)}</TableCell>
                              <TableCell className="text-right num text-sm font-medium">{(ratio * 100).toFixed(1)}%</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && cancelPending()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save turnover for {pending?.monthLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm to save the updated figures for this month.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPending}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
