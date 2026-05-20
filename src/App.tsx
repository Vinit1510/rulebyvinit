import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Calculator, Moon, Sun, RotateCcw, Loader2 } from "lucide-react";
import { Switch as RouteSwitch, Route, useLocation, Router as WouterRouter } from "wouter";
import { InvoiceRegister } from "@/components/InvoiceRegister";
import { TurnoverTable } from "@/components/TurnoverTable";
import { ResultsPanel } from "@/components/ResultsPanel";
import { UserMenu } from "@/components/UserMenu";
import { AuthPage } from "@/pages/AuthPage";
import { useCalculator } from "@/hooks/useCalculator";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { unionMonths } from "@/lib/rule43";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const TABS = [
  { value: "invoices", label: "1. Invoices" },
  { value: "turnover", label: "2. Turnover" },
  { value: "reports", label: "3. Reports" },
];

function MainApp() {
  const calc = useCalculator();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const [tab, setTab] = useState<string>(() => {
    if (typeof window === "undefined") return "invoices";
    const saved = window.localStorage.getItem("rule43.activeTab");
    return saved && TABS.some((t) => t.value === saved) ? saved : "invoices";
  });
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("rule43.activeTab", tab);
  }, [tab]);

  const months = useMemo(() => unionMonths(calc.state.invoices), [calc.state.invoices]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 no-print">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold leading-tight">Rule 43 ITC Calculator</h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">
                Multi-invoice capital goods ITC reversal under CGST Rule 43
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {calc.syncing && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Syncing" />}
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Reset all"><RotateCcw className="h-4 w-4" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset everything?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all your invoices and turnover entries from your account. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => { calc.reset(); setTab("invoices"); toast({ title: "Reset complete", description: "All data cleared." }); }}
                  >Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1 no-print">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs sm:text-sm py-2">{t.label}</TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-6">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
                <TabsContent value="invoices" forceMount={tab === "invoices" ? true : undefined} hidden={tab !== "invoices"}>
                  <InvoiceRegister
                    invoices={calc.state.invoices}
                    onSave={calc.upsertInvoice}
                    onDelete={calc.deleteInvoice}
                    onImport={calc.bulkImport}
                  />
                </TabsContent>
                <TabsContent value="turnover" forceMount={tab === "turnover" ? true : undefined} hidden={tab !== "turnover"}>
                  <TurnoverTable
                    months={months}
                    turnover={calc.state.turnover}
                    setTurnover={calc.setTurnover}
                    applyToAll={calc.applyToAllTurnover}
                  />
                </TabsContent>
                <TabsContent value="reports" forceMount={tab === "reports" ? true : undefined} hidden={tab !== "reports"}>
                  <ResultsPanel invoices={calc.state.invoices} turnover={calc.state.turnover} />
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </div>
        </Tabs>
      </main>

      <Toaster />
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function ProtectedRoute() {
  const { isSignedIn, loading } = useAuth();
  const [, setLocation] = useLocation();
  const isOfflineMode = typeof window !== "undefined" && localStorage.getItem("r43_working_offline") === "true";

  useEffect(() => {
    if (!loading && !isSignedIn && !isOfflineMode) {
      setLocation("/sign-in");
    }
  }, [loading, isSignedIn, isOfflineMode, setLocation]);

  if (loading) return <FullScreenLoader />;
  if (!isSignedIn && !isOfflineMode) return <FullScreenLoader />;
  return <MainApp />;
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <TooltipProvider delayDuration={150}>
        <RouteSwitch>
          <Route path="/sign-in" component={AuthPage} />
          <Route path="/" component={ProtectedRoute} />
          <Route component={ProtectedRoute} />
        </RouteSwitch>
        <Toaster />
      </TooltipProvider>
    </WouterRouter>
  );
}

export default App;
