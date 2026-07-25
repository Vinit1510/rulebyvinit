import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Key, ArrowLeft, CheckCircle2, AlertTriangle, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AdminPage() {
  const { clientId, updateClientId } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [tempClientId, setTempClientId] = useState(clientId);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempClientId.trim()) {
      toast({
        title: "Client ID required",
        description: "Please enter a valid Google OAuth Client ID.",
        variant: "destructive",
      });
      return;
    }
    updateClientId(tempClientId.trim());
    toast({
      title: "Client ID Saved Successfully!",
      description: "Google OAuth credentials have been updated for this application.",
    });
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-xs font-semibold"
            onClick={() => setLocation("/sign-in")}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Sign-in
          </Button>

          <span className="text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Admin Panel
          </span>
        </div>

        <Card className="border border-border/80 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" /> Google Credentials Administration
            </CardTitle>
            <CardDescription className="text-xs">
              Configure your master Google OAuth Client ID for cloud sync and backups. This page is hidden from standard client users.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-3.5 rounded-lg border text-xs flex items-center gap-3 bg-muted/30">
              {clientId ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">Google OAuth Configured</p>
                    <p className="text-muted-foreground text-[11px]">Client ID is active and ready for user sign-in.</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-600 dark:text-amber-400">Client ID Missing</p>
                    <p className="text-muted-foreground text-[11px]">Enter your Google OAuth Client ID below to enable cloud sync.</p>
                  </div>
                </>
              )}
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-client-id" className="text-xs font-semibold flex items-center gap-1.5">
                  Google OAuth Client ID
                </Label>
                <Input
                  id="admin-client-id"
                  placeholder="e.g. 1234567890-abcdef.apps.googleusercontent.com"
                  value={tempClientId}
                  onChange={(e) => setTempClientId(e.target.value)}
                  className="text-xs h-10 font-mono"
                  required
                />
              </div>

              <Button type="submit" className="w-full h-10 text-xs font-semibold gap-2">
                <Save className="h-4 w-4" /> Save Credentials
              </Button>
            </form>

            <div className="space-y-2 pt-2 border-t text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Google Cloud Console Setup Instructions:</p>
              <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-relaxed">
                <li>Go to <strong>Google Cloud Console</strong> &gt; APIs &amp; Services &gt; Credentials.</li>
                <li>Create an OAuth 2.0 Web Client ID.</li>
                <li>Add <code>{typeof window !== "undefined" ? window.location.origin : "https://gstreversal.vercel.app"}</code> to <strong>Authorized JavaScript Origins</strong>.</li>
                <li>Enable the <strong>Google Drive API</strong> in API Library.</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
