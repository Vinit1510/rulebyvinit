import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip as RTooltip, CartesianGrid, Legend, AreaChart, Area
} from "recharts";
import {
  Calculator, Plus, Upload, BookOpen, Layers,
  TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight, Award
} from "lucide-react";
import {
  type Invoice, type MonthlyTurnover, formatINR,
  computeItcComponents, consolidate, computeRule42Month, unionMonths
} from "@/lib/rule43";

interface Props {
  invoices: Invoice[];
  turnover: Record<string, MonthlyTurnover>;
  onNavigate: (path: string) => void;
  onAddInvoice: () => void;
  onImport: () => void;
}

export function DashboardView({ invoices, turnover, onNavigate, onAddInvoice, onImport }: Props) {
  const capGoods = useMemo(() => invoices.filter((i) => (i.itemType ?? "capital_good") === "capital_good"), [invoices]);
  const r42Invoices = useMemo(() => invoices.filter((i) => (i.itemType ?? "capital_good") !== "capital_good"), [invoices]);

  const stats = useMemo(() => {
    // 1. Total Gross ITC
    const totalGross = invoices.reduce((s, inv) => {
      const { igstItc, cgstItc, sgstItc } = computeItcComponents(inv.taxableValue, inv);
      return s + igstItc + cgstItc + sgstItc;
    }, 0);

    // 2. Rule 43 (Capital Goods) Total Reversals
    const r43Consol = consolidate(capGoods, turnover);
    const r43Reversal = r43Consol.totalReversal;

    // 3. Rule 42 (Inputs/Services) Total Reversals
    // Distinct Rule 42 months
    const r42Months = Array.from(new Set(
      r42Invoices.map((inv) => inv.purchaseDate ? inv.purchaseDate.slice(0, 7) : "").filter(Boolean)
    ));
    let r42Reversal = 0;
    let r42TotalItc = 0;
    
    for (const m of r42Months) {
      const t = turnover[m] ?? { exempt: 0, taxable: 0 };
      const res = computeRule42Month(invoices, m, t);
      r42Reversal += res.totalReversal.igst + res.totalReversal.cgst + res.totalReversal.sgst;
      r42TotalItc += res.totalItc.igst + res.totalItc.cgst + res.totalItc.sgst;
    }

    const totalReversals = r43Reversal + r42Reversal;
    const netItc = Math.max(0, totalGross - totalReversals);

    return {
      totalGross,
      r43Reversal,
      r42Reversal,
      r42TotalItc,
      totalReversals,
      netItc,
      invoicesCount: invoices.length,
      capGoodsCount: capGoods.length,
      r42Count: r42Invoices.length,
    };
  }, [invoices, capGoods, r42Invoices, turnover]);

  // Combine monthly trends for the chart
  const chartData = useMemo(() => {
    const allMonthsSet = new Set<string>();
    
    // Rule 43 months
    const r43Months = unionMonths(capGoods).map(d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
    r43Months.forEach(m => allMonthsSet.add(m));

    // Rule 42 months
    const r42Months = r42Invoices.map((inv) => inv.purchaseDate ? inv.purchaseDate.slice(0, 7) : "").filter(Boolean);
    r42Months.forEach(m => allMonthsSet.add(m));

    // Turnover months
    Object.keys(turnover).forEach(m => allMonthsSet.add(m));

    const sortedMonths = Array.from(allMonthsSet).sort();
    
    return sortedMonths.map((m) => {
      // Calculate Rule 43 monthly reversal
      let r43Rev = 0;
      for (const inv of capGoods) {
        const res = consolidate([inv], turnover);
        const match = res.rows.find((row) => row.monthKey === m);
        if (match) r43Rev += match.totalReversal;
      }

      // Calculate Rule 42 monthly reversal
      const t = turnover[m] ?? { exempt: 0, taxable: 0 };
      const r42Res = computeRule42Month(invoices, m, t);
      const r42Rev = r42Res.totalReversal.igst + r42Res.totalReversal.cgst + r42Res.totalReversal.sgst;

      const [y, mo] = m.split("-");
      const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

      return {
        month: label,
        monthKey: m,
        "Rule 42 Reversal": Math.round(r42Rev),
        "Rule 43 Reversal": Math.round(r43Rev),
        "Total Reversal": Math.round(r42Rev + r43Rev),
      };
    });
  }, [invoices, capGoods, r42Invoices, turnover]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-teal-800 to-cyan-900 text-white p-6 sm:p-8 overflow-hidden shadow-lg border border-teal-700">
        <div className="absolute right-0 top-0 w-1/3 h-full bg-radial-gradient opacity-20 pointer-events-none transform translate-x-12 -translate-y-12" />
        <div className="relative z-10 space-y-2 max-w-2xl">
          <Badge className="bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase tracking-wider text-[10px] px-3 py-1 font-bold">
            GST Reversal Suite
          </Badge>
          <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight">Apportionment Dashboard</h2>
          <p className="text-teal-100/80 text-xs sm:text-sm leading-relaxed">
            Manage, parse, and automate your **Rule 42** (Inputs &amp; Services) and **Rule 43** (Capital Goods) Input Tax Credit reconciliations instantly.
          </p>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-all border-l-4 border-l-teal-600 bg-background/50 backdrop-blur">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Inward ITC</span>
              <div className="num text-2xl font-black tracking-tight text-foreground">{formatINR(stats.totalGross)}</div>
              <p className="text-[10px] text-muted-foreground flex gap-2">
                <span>{stats.invoicesCount} Total Invoices</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all border-l-4 border-l-amber-500 bg-background/50 backdrop-blur">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Rule 42 Reversals</span>
              <div className="num text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">{formatINR(stats.r42Reversal)}</div>
              <p className="text-[10px] text-muted-foreground flex gap-2">
                <span>{stats.r42Count} Inputs/Services</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <ArrowDownRight className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all border-l-4 border-l-rose-500 bg-background/50 backdrop-blur">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Rule 43 Reversals</span>
              <div className="num text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400">{formatINR(stats.r43Reversal)}</div>
              <p className="text-[10px] text-muted-foreground flex gap-2">
                <span>{stats.capGoodsCount} Capital Goods</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all border-l-4 border-l-emerald-500 bg-background/50 backdrop-blur">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Net Eligible Claim</span>
              <div className="num text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">{formatINR(stats.netItc)}</div>
              <p className="text-[10px] text-muted-foreground flex gap-2">
                <span>Total Reversals: {formatINR(stats.totalReversals)}</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Section */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Trend Chart */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Monthly Reversals Trend</CardTitle>
            <CardDescription className="text-xs">Compare monthly Rule 42 and Rule 43 credit reversals</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pl-0">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">
                No monthly data points available yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} formatter={(v: number) => formatINR(v)} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Rule 42 Reversal" name="Rule 42 Reversal" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="Rule 43 Reversal" name="Rule 43 Reversal" stackId="a" fill="#f43f5e" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Panel */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            <CardDescription className="text-xs">Workflow shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              type="button"
              className="w-full justify-start text-xs h-10 border shadow-sm bg-teal-600 hover:bg-teal-700 text-white font-semibold"
              onClick={onAddInvoice}
            >
              <Plus className="h-4 w-4 mr-2" /> Add Single Invoice
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-xs h-10 border shadow-sm hover:bg-accent/60"
              onClick={onImport}
            >
              <Upload className="h-4 w-4 mr-2" /> Import Invoices Template
            </Button>
            <hr className="my-2 border-dashed" />
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-xs h-10 text-muted-foreground hover:text-foreground hover:bg-accent/40"
              onClick={() => onNavigate("/invoices")}
            >
              <Layers className="h-4 w-4 mr-2 text-teal-600" /> Go to Invoice Register
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-xs h-10 text-muted-foreground hover:text-foreground hover:bg-accent/40"
              onClick={() => onNavigate("/turnover")}
            >
              <BookOpen className="h-4 w-4 mr-2 text-amber-500" /> Update Turnover Records
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-xs h-10 text-muted-foreground hover:text-foreground hover:bg-accent/40"
              onClick={() => onNavigate("/reports")}
            >
              <Calculator className="h-4 w-4 mr-2 text-rose-500" /> View Reversal Reports
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Info Notice card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4 flex gap-3 items-start text-xs leading-relaxed text-muted-foreground">
          <AlertCircle className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-foreground">Statutory Apportionment Guidelines:</span> Both rules utilize the turnover entries to calculate the monthly exempt ratio $E/F$. Reversals must be reported in Table 4(B) of your monthly GSTR-3B filings, and Rule 42 must be aggregate-reconciled annually.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
