import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calculator, BookOpen, Layers,
  ArrowRight, ShieldCheck, AlertTriangle, RotateCw
} from "lucide-react";
import { isLicenseInLastMonthOrExpired, getActiveLicenseFY } from "@/lib/rule43";
import { getNextFinancialYear, createRenewalRequest } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onNavigate: (path: string) => void;
}

export function DashboardView({ onNavigate }: Props) {
  const { toast } = useToast();
  const [requesting, setRequesting] = useState(false);

  const userFY = getActiveLicenseFY();
  const nextFY = getNextFinancialYear(userFY);
  const showBanner = isLicenseInLastMonthOrExpired(userFY);

  const handleRequestRenewal = async () => {
    const email = localStorage.getItem("r43_user_email") || "";
    const mobile = localStorage.getItem("r43_user_mobile") || "";
    const activeCode = localStorage.getItem("r43_activated_code") || "";

    setRequesting(true);
    const ok = await createRenewalRequest({
      userEmail: email || "user@client.local",
      userName: "Client User",
      userMobile: mobile || "N/A",
      currentCode: activeCode || "N/A",
      currentFY: userFY,
      requestedFY: nextFY,
    });
    setRequesting(false);

    if (ok) {
      toast({
        title: "Renewal Request Submitted!",
        description: `License renewal request for FY ${nextFY} has been sent to Administrator.`,
      });
    } else {
      toast({ title: "Failed to submit request", description: "Please try again.", variant: "destructive" });
    }
  };

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good Morning" : currentHour < 17 ? "Good Afternoon" : "Good Evening";

  const guideSteps = [
    {
      step: "01",
      title: "Add or Import Purchase Invoices",
      description: "Record your purchase invoices for the period. Mark items correctly as Inputs, Input Services, or Capital Goods, and select their usage profile.",
      badge: "Invoices Tab",
      icon: Layers,
      color: "from-teal-500/10 to-teal-500/5 text-teal-600 dark:text-teal-400 border-teal-500/20",
      actionText: "Manage Invoices",
      action: () => onNavigate("/invoices"),
    },
    {
      step: "02",
      title: "Update Monthly Turnovers",
      description: "Enter your monthly taxable and exempt turnover values. These figures are critical to calculate the common credit apportionment ratio (E/F) automatically.",
      badge: "Turnover Tab",
      icon: BookOpen,
      color: "from-amber-500/10 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20",
      actionText: "Update Turnover",
      action: () => onNavigate("/turnover"),
    },
    {
      step: "03",
      title: "Generate and Export Reports",
      description: "Review GSTR-3B monthly reversals (Rule 42 & 43), verify annual aggregate reconciliations, and download professional Excel and PDF audit sheets.",
      badge: "Reports Tab",
      icon: Calculator,
      color: "from-rose-500/10 to-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/20",
      actionText: "View Reversals",
      action: () => onNavigate("/reports"),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Expiry Warning Banner during Last Month of License (March) */}
      {showBanner && (
        <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <span>Notice: Your license for FY {userFY} expires on March 31. Please submit your FY {nextFY} renewal request to continue uninterrupted.</span>
          </div>
          <Button
            size="sm"
            disabled={requesting}
            onClick={handleRequestRenewal}
            className="h-7 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white gap-1"
          >
            <RotateCw className={`h-3 w-3 ${requesting ? "animate-spin" : ""}`} />
            Request FY {nextFY} Renewal
          </Button>
        </div>
      )}

      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 text-white p-6 sm:p-8 shadow-md border border-teal-800/40">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" /> GST REVERSAL WORKSPACE
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{greeting}, Tax Consultant</h2>
          <p className="text-sm text-teal-100/80 leading-relaxed pt-1">
            Welcome to your Rule 42 &amp; 43 Reversal Suite. Streamline and simplify your commercial GST compliance with accurate capital goods ITC apportionments against tax auditing risks with absolute precision.
          </p>
        </div>
      </div>

      {/* Interactive Quick Start Guide */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Interactive Quick Start Guide
            </h3>
            <p className="text-xs text-muted-foreground">Follow these three steps to calculate and file your GSTR-3B Rule 42 &amp; 43 monthly reversals.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {guideSteps.map((s, idx) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.3 }}
            >
              <Card className="h-full border border-border/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-black font-mono text-primary/30 group-hover:text-primary transition-colors">
                      {s.step}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-semibold">
                      {s.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <s.icon className="h-4 w-4 text-primary" /> {s.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                  <p className="text-xs text-muted-foreground leading-normal">
                    {s.description}
                  </p>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-semibold justify-between mt-2 group-hover:border-primary/50"
                    onClick={s.action}
                  >
                    <span>{s.actionText}</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
