import { motion } from "framer-motion";
import { Wrench, Phone, ShieldAlert, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminSettings } from "@/lib/firebase";

export function MaintenanceOverlay({ settings }: { settings?: AdminSettings }) {
  const title = settings?.maintenanceMessage || "WEBSITE UNDER MAINTENANCE";
  const contact = settings?.supportContact || "Contact Support Team: support@rulebyvinit.com | +91 98765 43210";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-2xl p-4 overflow-y-auto select-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(239,68,68,0.12),transparent_70%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-2xl relative z-10 my-auto text-center"
      >
        <Card className="border border-destructive/30 shadow-2xl bg-card/90 backdrop-blur-xl overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />

          <CardContent className="p-8 sm:p-12 space-y-8">
            {/* Animated Icon */}
            <div className="relative mx-auto w-24 h-24 rounded-3xl bg-destructive/10 border border-destructive/30 flex items-center justify-center text-destructive shadow-inner">
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              >
                <Wrench className="h-12 w-12" />
              </motion.div>
              <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold shadow-md">
                <Lock className="h-3 w-3" />
              </span>
            </div>

            {/* BIG BOLD HEADLINE */}
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-destructive bg-destructive/10 px-3 py-1 rounded-full border border-destructive/20">
                <ShieldAlert className="h-3.5 w-3.5" /> Scheduled System Maintenance
              </span>
              <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-foreground leading-tight drop-shadow-xs">
                {title}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed pt-2">
                We are currently performing essential system upgrades and maintenance to enhance your experience. Application features are temporarily paused.
              </p>
            </div>

            {/* Status Info Box */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground flex items-center justify-center gap-3 max-w-md mx-auto">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
              </span>
              <span className="font-semibold text-foreground">Maintenance in progress · Please check back shortly</span>
            </div>

            {/* SMALL FONT CONTACT TO SUPPORT TEAM */}
            <div className="pt-6 border-t border-border/80 space-y-2">
              <div className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-2">
                <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs">{contact}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
