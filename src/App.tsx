import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
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
import { DashboardView } from "@/components/DashboardView";
import { UserMenu } from "@/components/UserMenu";
import { AuthPage } from "@/pages/AuthPage";
import { useCalculator } from "@/hooks/useCalculator";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { unionMonths } from "@/lib/rule43";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const TABS = [
  { value: "/dashboard", label: "Dashboard" },
  { value: "/invoices", label: "Invoices" },
  { value: "/turnover", label: "Turnover" },
  { value: "/reports", label: "Reports" },
];

function MainApp() {
  const calc = useCalculator();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Redirect root / to /dashboard
  useEffect(() => {
    if (location === "/" || location === "") {
      setLocation("/dashboard");
    }
  }, [location, setLocation]);

  const activeTab = TABS.some(t => t.value === location) ? location : "/dashboard";

  const months = useMemo(() => unionMonths(calc.state.invoices), [calc.state.invoices]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 no-print">
        <div className="w-full px-6 sm:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold leading-tight">Rule 42 &amp; 43 ITC Suite</h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">
                Inputs &amp; Capital Goods ITC apportionment &amp; reversals
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
                    onClick={() => { calc.reset(); setLocation("/dashboard"); toast({ title: "Reset complete", description: "All data cleared." }); }}
                  >Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="w-full px-6 sm:px-8 py-6 flex-1">
        {/* Navigation Tabs */}
        <div className="flex bg-muted/40 p-1 rounded-lg border gap-1 self-start w-full sm:w-auto no-print mb-6">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setLocation(t.value)}
              className={`text-xs px-5 py-2.5 rounded-md font-semibold transition-all flex-1 sm:flex-none text-center ${
                activeTab === t.value
                  ? "bg-background text-foreground shadow-md border border-border font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
              {activeTab === "/dashboard" && (
                <DashboardView
                  invoices={calc.state.invoices}
                  turnover={calc.state.turnover}
                  onNavigate={setLocation}
                  onAddInvoice={() => {
                    setLocation("/invoices");
                  }}
                  onImport={() => {
                    setLocation("/invoices");
                  }}
                />
              )}
              {activeTab === "/invoices" && (
                <InvoiceRegister
                  invoices={calc.state.invoices}
                  onSave={calc.upsertInvoice}
                  onDelete={calc.deleteInvoice}
                  onImport={calc.bulkImport}
                />
              )}
              {activeTab === "/turnover" && (
                <TurnoverTable
                  months={months}
                  turnover={calc.state.turnover}
                  setTurnover={calc.setTurnover}
                  applyToAll={calc.applyToAllTurnover}
                />
              )}
              {activeTab === "/reports" && (
                <ResultsPanel invoices={calc.state.invoices} turnover={calc.state.turnover} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
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
          <Route path="/dashboard" component={ProtectedRoute} />
          <Route path="/invoices" component={ProtectedRoute} />
          <Route path="/turnover" component={ProtectedRoute} />
          <Route path="/reports" component={ProtectedRoute} />
          <Route path="/" component={ProtectedRoute} />
          <Route component={ProtectedRoute} />
        </RouteSwitch>
        <Toaster />
      </TooltipProvider>
    </WouterRouter>
  );
}

export default App;
