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
import {
  Calculator, Moon, Sun, RotateCcw, Loader2,
  LayoutDashboard, FileText, IndianRupee, FileSpreadsheet, Menu, X
} from "lucide-react";
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
  { value: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "/invoices", label: "Invoices", icon: FileText },
  { value: "/turnover", label: "Turnover", icon: IndianRupee },
  { value: "/reports", label: "Reports", icon: FileSpreadsheet },
];

function MainApp() {
  const calc = useCalculator();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Redirect root / to /dashboard
  useEffect(() => {
    if (location === "/" || location === "") {
      setLocation("/dashboard");
    }
  }, [location, setLocation]);

  const activeTab = TABS.some(t => t.value === location) ? location : "/dashboard";

  const months = useMemo(() => unionMonths(calc.state.invoices), [calc.state.invoices]);

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r bg-card no-print sticky top-0 h-screen flex-shrink-0">
        {/* Brand / Logo */}
        <div className="px-6 py-6 border-b flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight text-foreground">Rule 42 &amp; 43 Suite</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">GST ITC Apportionment</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setLocation(t.value)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all relative ${
                  isActive
                    ? "text-primary bg-primary/5 font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className={`h-4 w-4 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t space-y-2">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-muted-foreground">Theme</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggle} aria-label="Toggle theme">
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="w-full justify-start text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 gap-2 px-2 h-8">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Data
              </Button>
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
          
          <div className="pt-2 border-t flex items-center justify-between px-1">
            <UserMenu />
            {calc.syncing && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black md:hidden no-print"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-card border-r flex flex-col md:hidden no-print"
            >
              <div className="px-6 py-6 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Calculator className="h-5 w-5" />
                  </div>
                  <div>
                    <h1 className="text-sm font-semibold leading-tight text-foreground">Rule 42 &amp; 43 Suite</h1>
                    <p className="text-[10px] text-muted-foreground leading-tight">GST ITC Apportionment</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <nav className="flex-1 px-4 py-6 space-y-1">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        setLocation(t.value);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                        isActive
                          ? "text-primary bg-primary/5 font-bold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      {t.label}
                    </button>
                  );
                })}
              </nav>

              <div className="p-4 border-t space-y-2">
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs text-muted-foreground">Theme</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggle}>
                    {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  </Button>
                </div>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 gap-2 px-2 h-8">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset Data
                    </Button>
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
                        onClick={() => { calc.reset(); setLocation("/dashboard"); setMobileMenuOpen(false); toast({ title: "Reset complete", description: "All data cleared." }); }}
                      >Reset</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <div className="pt-2 border-t flex items-center justify-between px-1">
                  <UserMenu />
                  {calc.syncing && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto overflow-x-hidden">
        {/* Mobile Top Bar */}
        <header className="md:hidden sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 flex items-center justify-between px-6 py-4 no-print flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)} className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Calculator className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold leading-tight text-foreground">Rule 42 &amp; 43</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {calc.syncing && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <UserMenu />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 px-6 sm:px-8 py-6 w-full max-w-[1600px] mx-auto">
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
        </main>
      </div>

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
