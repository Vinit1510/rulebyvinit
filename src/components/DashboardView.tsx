import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calculator, BookOpen, Layers,
  ArrowRight, ShieldCheck, HelpCircle
} from "lucide-react";

interface Props {
  onNavigate: (path: string) => void;
}

export function DashboardView({ onNavigate }: Props) {
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
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Welcome Greeting Banner */}
      <div className="relative rounded-3xl bg-gradient-to-br from-teal-800 via-teal-950 to-cyan-950 text-white p-8 sm:p-10 overflow-hidden shadow-2xl border border-teal-700/30">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px] opacity-20 pointer-events-none" />
        <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl" />
        
        <div className="relative z-10 space-y-4 max-w-3xl">
          <Badge className="bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase tracking-wider text-[9px] px-3 py-1 font-bold rounded-full">
            GST Reversal Workspace
          </Badge>
          <motion.h2 
            initial={{ opacity: 0, y: -5 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="text-2xl sm:text-4xl font-black tracking-tight"
          >
            {greeting}, Partner!
          </motion.h2>
          <p className="text-teal-100/80 text-sm sm:text-base leading-relaxed font-medium">
            Welcome to your intelligent **Rule 42 &amp; 43 Apportionment Calculator**. Simplify your commercial GST compliance, eliminate manual calculations, and protect your business against tax auditing risks with absolute mathematical precision.
          </p>
        </div>
      </div>

      {/* Guide Header */}
      <div className="space-y-1">
        <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-teal-600" />
          Interactive Quick-Start Guide
        </h3>
        <p className="text-xs text-muted-foreground">Follow these three steps to successfully compute and declare your GSTR-3B reversals</p>
      </div>

      {/* Step by Step Cards */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        {guideSteps.map((s, idx) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -4 }}
              className="group"
            >
              <Card className="h-full border bg-card/60 backdrop-blur-md shadow-md rounded-2xl overflow-hidden hover:shadow-lg transition-all flex flex-col justify-between group-hover:border-primary/30">
                <CardHeader className="pb-3 relative">
                  <div className="flex items-center justify-between w-full mb-3">
                    <span className="text-3xl font-black text-muted-foreground/20 group-hover:text-primary/10 transition-colors font-mono">{s.step}</span>
                    <Badge variant="outline" className="text-[9px] font-semibold border-muted/50 text-muted-foreground">{s.badge}</Badge>
                  </div>
                  <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${s.color} border flex items-center justify-center mb-2`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-sm font-bold leading-snug group-hover:text-primary transition-colors">{s.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 flex-grow flex flex-col justify-between pt-0">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {s.description}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={s.action}
                    className="w-full justify-between h-9 text-xs text-muted-foreground group-hover:text-primary hover:bg-primary/5 rounded-xl border border-transparent group-hover:border-primary/15 font-semibold px-3 animate-pulse-subtle"
                  >
                    <span>{s.actionText}</span>
                    <ArrowRight className="h-3.5 w-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Compliance Notice */}
      <Card className="bg-card/40 backdrop-blur border rounded-2xl shadow-sm">
        <CardContent className="py-5 px-6 flex gap-4 items-start text-xs leading-relaxed text-muted-foreground">
          <HelpCircle className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-foreground block">How Apportionment Reversals Work Legally:</span>
            <p>
              Both Rule 42 &amp; Rule 43 utilize the exempt turnover ratio ($E/F$) from your Turnover entries. 
              **Rule 42** reverses inputs and services on a monthly basis with a flat 5% deemed personal reversal on common credits, reconciled at the end of the year. 
              **Rule 43** amortizes capital goods over 60 months, reversing the exempt portion period-by-period. All combined monthly reversals must be declared in **GSTR-3B Table 4(B)**.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
