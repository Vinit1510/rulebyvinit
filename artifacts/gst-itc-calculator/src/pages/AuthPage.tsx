import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, Loader2, Key, Settings, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const { signIn, loading, clientId, updateClientId } = useAuth();
  const { toast } = useToast();
  const [showConfig, setShowConfig] = useState(false);
  const [tempClientId, setTempClientId] = useState(clientId);

  const saveClientId = (e: React.FormEvent) => {
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
      title: "Client ID Saved",
      description: "You can now connect to Google Drive using your custom credentials.",
    });
    setShowConfig(false);
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
          <h1 className="text-2xl font-bold tracking-tight">Rule 43 ITC Calculator</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs">
            100% serverless and private capital goods reversal manager.
          </p>
        </div>

        <Card className="border border-border/80 shadow-md">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-lg">Secure Google Drive Sync</CardTitle>
            <CardDescription className="text-xs">
              Your financial records are saved directly in your personal cloud. No third-party servers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              className="w-full py-6 text-sm font-semibold hover:shadow-md transition-all duration-200"
              onClick={signIn}
              disabled={loading || !clientId}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <div className="flex items-center gap-2">
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </div>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full py-6 text-sm font-semibold hover:shadow-md transition-all duration-200 border-dashed"
              onClick={() => {
                if (typeof window !== "undefined") {
                  localStorage.setItem("r43_working_offline", "true");
                }
                window.location.href = basePath + "/";
              }}
            >
              Continue Offline (Local Sandbox)
            </Button>

            {!clientId && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 text-amber-500 rounded-lg text-xs border border-amber-500/20">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">OAuth Client ID Required</p>
                  <p className="mt-0.5 opacity-90">
                    Set up your Google Client ID below to start syncing data.
                  </p>
                </div>
              </div>
            )}

            <div className="relative pt-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-card px-3 text-muted-foreground tracking-wider font-semibold">
                  Credentials Setup
                </span>
              </div>
            </div>

            {/* Toggleable Developer Settings for Google Client ID */}
            <div className="space-y-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-xs text-muted-foreground hover:text-foreground h-9"
                onClick={() => setShowConfig(!showConfig)}
              >
                <div className="flex items-center gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  <span>Google Client ID Configuration</span>
                </div>
                <span>{showConfig ? "Hide" : "Show"}</span>
              </Button>

              {showConfig || !clientId ? (
                <form onSubmit={saveClientId} className="space-y-3 p-3 bg-muted/40 rounded-lg border border-border/50">
                  <div className="space-y-1.5">
                    <Label htmlFor="client-id" className="text-[11px] font-medium flex items-center gap-1">
                      <Key className="h-3 w-3 text-primary" />
                      <span>Google OAuth Client ID</span>
                    </Label>
                    <Input
                      id="client-id"
                      placeholder="e.g. 12345-abcde.apps.googleusercontent.com"
                      value={tempClientId}
                      onChange={(e) => setTempClientId(e.target.value)}
                      className="text-xs h-9 bg-background"
                      required
                    />
                  </div>
                  <Button type="submit" size="sm" className="w-full h-8 text-xs font-semibold">
                    Save and Apply Credentials
                  </Button>
                  <p className="text-[10px] text-muted-foreground leading-relaxed leading-normal mt-1">
                    To create a client ID, go to the <strong>Google Cloud Console</strong> &gt; API Credentials, create an OAuth 2.0 Web Client, and add <code>{window.location.origin}</code> to Authorized JavaScript Origins.
                  </p>
                </form>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground leading-normal max-w-xs mx-auto">
          CAs & Tax consultants retain 100% ownership. Files are saved as encrypted JSON configurations on your private Google Drive.
        </p>
      </div>
    </div>
  );
}
