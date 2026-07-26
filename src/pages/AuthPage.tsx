import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calculator, KeyRound, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAdminSettings, verifyActivationCode, updateCodeStatus } from "@/lib/firebase";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.4 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.7 0 19.5-8.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.4 29 4.5 24 4.5c-7.4 0-13.8 4.2-17 10.2z"/>
      <path fill="#4CAF50" d="M24 43.5c5.1 0 9.7-2 13.2-5.2l-6.1-5.2c-2 1.4-4.4 2.2-7.1 2.2-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39.4 16.2 43.5 24 43.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.4 4.3-4.4 5.6l6.1 5.2c4.3-3.9 7-9.7 7-16.3 0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

export function AuthPage() {
  const { signIn, loading, clientId, updateClientId, isSignedIn, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Activation code state
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      if (user?.email) {
        logUserSignIn(user.email, user.name || "", user.picture).catch(console.error);
      }

      let isMounted = true;
      getAdminSettings()
        .then(async (settings) => {
          if (!isMounted) return;
          const storedCode = typeof window !== "undefined" ? localStorage.getItem("r43_activated_code") : null;

          if (!settings.activationRequired) {
            toast({
              title: "Signed in successfully!",
              description: "Google Drive Sync is active. Loading your dashboard...",
            });
            setLocation("/dashboard");
          } else {
            if (storedCode) {
              const check = await verifyActivationCode(storedCode, user?.email);
              if (check.valid) {
                setLocation("/dashboard");
                return;
              }
            }
            setShowActivationModal(true);
          }
        })
        .catch((err) => {
          console.error("Failed to check admin settings:", err);
          if (isMounted) setLocation("/dashboard");
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isSignedIn, setLocation, toast, user]);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    setVerifying(true);
    const res = await verifyActivationCode(inputCode, user?.email);
    setVerifying(false);

    if (res.valid && res.doc) {
      if (typeof window !== "undefined") {
        localStorage.setItem("r43_activated_code", res.doc.code);
        localStorage.setItem("r43_working_offline", "true");
      }
      await updateCodeStatus(res.doc.id, "redeemed", user?.email || "offline_user");
      if (user?.email) {
        logUserSignIn(user.email, user.name || "", user.picture, res.doc.code).catch(console.error);
      }
      toast({
        title: "Activation Successful!",
        description: `Code ${res.doc.code} verified. Loading workspace...`,
      });
      setShowActivationModal(false);
      window.location.href = basePath + "/";
    } else {
      toast({
        title: "Activation Failed",
        description: res.message || "Invalid activation code.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10 relative overflow-hidden">
      {/* Decorative gradient backgrounds */}
      <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 shadow-sm border border-primary/20">
            <Calculator className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Rule 42 &amp; 43 ITC Reversal</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs">
            100% serverless and private capital goods reversal manager.
          </p>
        </div>

        <Card className="border border-border/80 shadow-md">
          <CardHeader className="pb-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <CardTitle className="text-lg">Secure Google Drive Sync</CardTitle>
            </div>
            <CardDescription className="text-xs mt-1">
              Your financial records are saved directly in your personal cloud. No third-party servers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              className="w-full py-6 text-sm font-semibold hover:shadow-md transition-all duration-200"
              onClick={() => {
                if (clientId) {
                  signIn();
                } else {
                  toast({
                    title: "Google Client ID Required",
                    description: "Please configure your Google Client ID at /vinit to enable cloud sync.",
                  });
                }
              }}
            >
              <div className="flex items-center gap-2">
                <GoogleIcon />
                <span>Continue with Google</span>
              </div>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full py-6 text-sm font-semibold hover:shadow-md transition-all duration-200 border-dashed border-primary/40 bg-primary/5"
              onClick={async () => {
                const settings = await getAdminSettings();
                const storedCode = typeof window !== "undefined" ? localStorage.getItem("r43_activated_code") : null;
                if (settings.activationRequired && !storedCode) {
                  toast({
                    title: "Activation Code Required",
                    description: "Code enforcement is enabled by Admin. Please enter your activation code to use Local Sandbox.",
                  });
                  setShowActivationModal(true);
                  return;
                }
                if (typeof window !== "undefined") {
                  localStorage.setItem("r43_working_offline", "true");
                }
                window.location.href = basePath + "/";
              }}
            >
              Continue Offline (Local Sandbox)
            </Button>

            <div className="flex justify-center pt-0.5">
              <input
                type="file"
                id="offline-backup-upload"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const data = JSON.parse(event.target?.result as string);
                      if (data && (Array.isArray(data.invoices) || data.turnover)) {
                        localStorage.setItem("gst-itc-calc-v2", JSON.stringify(data));
                        localStorage.setItem("r43_working_offline", "true");
                        toast({
                          title: "Backup Restored Successfully!",
                          description: "Redirecting you to your offline workspace...",
                        });
                        setTimeout(() => {
                          window.location.href = basePath + "/";
                        }, 800);
                      } else {
                        throw new Error("Invalid backup structure");
                      }
                    } catch (err) {
                      toast({
                        title: "Failed to Restore Backup",
                        description: "The selected file is not a valid Rule 43 backup JSON.",
                        variant: "destructive",
                      });
                    }
                  };
                  reader.readAsText(file);
                }}
              />
              <Button
                type="button"
                variant="link"
                className="text-[11px] text-muted-foreground hover:text-primary h-auto py-1 tracking-wide"
                onClick={() => document.getElementById("offline-backup-upload")?.click()}
              >
                Import Local Backup (.json)
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground leading-normal max-w-xs mx-auto">
          CAs &amp; Tax consultants retain 100% ownership. Files are saved as encrypted JSON configurations on your private Google Drive.
        </p>
      </div>

      {/* Non-dismissible Activation Code Required Dialog Modal */}
      <Dialog open={showActivationModal} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5 text-primary" /> Enter Activation Code
            </DialogTitle>
            <DialogDescription className="text-xs">
              Activation Code enforcement is enabled by the Administrator. Please enter your assigned activation code to unlock access.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVerifyCode} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Activation Code</Label>
              <Input
                placeholder="Enter Activation Code"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                className="text-sm font-mono tracking-wider uppercase h-10"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Button type="submit" disabled={verifying} className="w-full h-10 font-semibold text-xs">
                {verifying ? "Verifying Code..." : "Activate & Continue to Dashboard"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs text-muted-foreground hover:text-destructive h-8"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    localStorage.removeItem("r43_google_token");
                    localStorage.removeItem("r43_google_user");
                    localStorage.removeItem("r43_activated_code");
                  }
                  setShowActivationModal(false);
                  window.location.reload();
                }}
              >
                Sign Out / Switch Google Account
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
