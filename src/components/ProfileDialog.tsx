import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ShieldCheck, CalendarCheck, RotateCw, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createRenewalRequest } from "@/lib/firebase";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requesting, setRequesting] = useState(false);

  const activeCode = typeof window !== "undefined" ? localStorage.getItem("r43_activated_code") : null;
  const userMobile = typeof window !== "undefined" ? localStorage.getItem("r43_user_mobile") : null;
  const userFY = typeof window !== "undefined" ? localStorage.getItem("r43_code_fy") : "2025-26";

  const handleRequestRenewal = async () => {
    const email = user?.email || localStorage.getItem("r43_user_email") || "";
    const mobile = userMobile || "";

    if (!email) {
      toast({ title: "Email required", variant: "destructive" });
      return;
    }

    setRequesting(true);
    const ok = await createRenewalRequest({
      userEmail: email,
      userName: user?.name || email.split("@")[0],
      userMobile: mobile || "N/A",
      currentCode: activeCode || "N/A",
      currentFY: userFY || "2025-26",
      requestedFY: "2026-27",
    });
    setRequesting(false);

    if (ok) {
      toast({
        title: "Renewal Request Submitted!",
        description: "Your license renewal request for FY 2026-27 has been sent to Administrator.",
      });
    } else {
      toast({ title: "Failed to submit request", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border border-border shadow-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> User Account &amp; License Validity
          </DialogTitle>
          <DialogDescription className="text-xs">
            Manage your account profile, registered mobile number, and active license details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5 py-1">
          {user?.picture && (
            <div className="flex justify-center pb-1">
              <img
                src={user.picture}
                alt={user.name}
                className="h-14 w-14 rounded-full border-2 border-primary/20 shadow-sm"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold">Full Name</Label>
              <Input value={user?.name ?? "Offline User"} readOnly className="text-xs h-8 bg-muted/40 cursor-default" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold flex items-center gap-1">
                <Phone className="h-3 w-3 text-primary" /> Registered Mobile
              </Label>
              <Input value={userMobile || "Not recorded"} readOnly className="text-xs h-8 bg-muted/40 cursor-default font-mono" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-semibold">Email Address</Label>
            <Input value={user?.email ?? localStorage.getItem("r43_user_email") ?? "N/A"} readOnly className="text-xs h-8 bg-muted/40 cursor-default" />
          </div>

          {/* License Validity Badge Card */}
          <div className="p-3 bg-muted/40 rounded-lg border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <CalendarCheck className="h-4 w-4 text-emerald-500" /> License Validity
              </span>
              <span className="text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-600 px-2 py-0.5 rounded border border-emerald-500/30">
                Active (FY {userFY})
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Activation Code: <code className="font-mono text-foreground font-semibold">{activeCode || "Trial Mode"}</code>
              <br />
              Valid until: <span className="font-semibold text-foreground">March 31, {userFY ? `20${userFY.split("-")[1]}` : "2026"}</span>
            </p>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={requesting}
              onClick={handleRequestRenewal}
              className="w-full text-xs h-8 font-semibold gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
            >
              <RotateCw className={`h-3.5 w-3.5 ${requesting ? "animate-spin" : ""}`} />
              Request FY 2026-27 Renewal
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-xs font-semibold">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
