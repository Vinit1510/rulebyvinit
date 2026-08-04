import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ShieldCheck, Key, ArrowLeft, Save,
  Users, KeyRound, Plus, Trash2, RefreshCw, Copy, Check, Lock, Unlock, Search, LogOut, Power, Phone, CalendarCheck, Wrench, AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  getAdminSettings, updateAdminSettings, getActivationCodes,
  createActivationCode, updateCodeStatus, deleteActivationCode, getRegisteredUsers,
  getRenewalRequests, updateRenewalRequestStatus,
  type ActivationCode, type UserRecord, type AdminSettings, type RenewalRequest
} from "@/lib/firebase";
import { secureStorage } from "@/lib/secureStorage";

export function AdminPage() {
  const { clientId, updateClientId } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Admin Password Authentication State
  const DEFAULT_ADMIN_PASS = "vinit@2026";
  const [adminPass, setAdminPass] = useState<string>(() => {
    return (typeof window !== "undefined" && secureStorage.getItem("r43_admin_master_pass")) || DEFAULT_ADMIN_PASS;
  });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return typeof window !== "undefined" && sessionStorage.getItem("r43_admin_authenticated") === "true";
  });
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [newPassInput, setNewPassInput] = useState("");

  // Data State
  const [tempClientId, setTempClientId] = useState(clientId);
  const [loading, setLoading] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);
  const [settings, setSettings] = useState<AdminSettings>({ activationRequired: false });
  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [renewals, setRenewals] = useState<RenewalRequest[]>([]);

  // Code Generation State
  const [newClientName, setNewClientName] = useState("");
  const [customCodeInput, setCustomCodeInput] = useState("");
  const [customExpiryInput, setCustomExpiryInput] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Maintenance State
  const [maintMode, setMaintMode] = useState(false);
  const [maintMsg, setMaintMsg] = useState("WEBSITE UNDER MAINTENANCE");
  const [maintContact, setMaintContact] = useState("support@rulebyvinit.com | +91 98765 43210");
  const [savingMaint, setSavingMaint] = useState(false);

  // Search & Tab Filter State
  const [userSearch, setUserSearch] = useState("");
  const [codeTabFilter, setCodeTabFilter] = useState<"all" | "active" | "expired" | "revoked">("all");

  const isCodeExpired = (c: ActivationCode) => {
    if (!c.validUntil) return false;
    return new Date() > new Date(c.validUntil);
  };

  const activeCodesList = codes.filter(c => c.status !== "revoked" && !isCodeExpired(c));
  const expiredCodesList = codes.filter(c => c.status !== "revoked" && isCodeExpired(c));
  const revokedCodesList = codes.filter(c => c.status === "revoked");

  const filteredCodes = codes.filter((c) => {
    if (codeTabFilter === "active") return c.status !== "revoked" && !isCodeExpired(c);
    if (codeTabFilter === "expired") return c.status !== "revoked" && isCodeExpired(c);
    if (codeTabFilter === "revoked") return c.status === "revoked";
    return true;
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, c, u, r] = await Promise.all([
        getAdminSettings(),
        getActivationCodes(),
        getRegisteredUsers(),
        getRenewalRequests(),
      ]);
      setSettings(s);
      setMaintMode(Boolean(s.maintenanceMode));
      setMaintMsg(s.maintenanceMessage || "WEBSITE UNDER MAINTENANCE");
      setMaintContact(s.supportContact || "support@rulebyvinit.com | +91 98765 43210");
      setCodes(c);
      setUsers(u);
      setRenewals(r);
    } catch (e) {
      console.error("Admin load error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminAuthenticated) {
      loadData();
    }
  }, [isAdminAuthenticated]);

  // Handle Admin Login
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput.trim() === adminPass) {
      setIsAdminAuthenticated(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("r43_admin_authenticated", "true");
      }
      toast({
        title: "Admin Access Granted",
        description: "Welcome to Master Admin Control Panel.",
      });
    } else {
      toast({
        title: "Access Denied",
        description: "Invalid Admin Password.",
        variant: "destructive",
      });
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("r43_admin_authenticated");
    }
  };

  // Change Admin Password
  const handleUpdateAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassInput.trim()) return;
    setAdminPass(newPassInput.trim());
    if (typeof window !== "undefined") {
      secureStorage.setItem("r43_admin_master_pass", newPassInput.trim());
    }
    setNewPassInput("");
    toast({
      title: "Admin Password Updated!",
      description: "Your master password for /vinit has been updated.",
    });
  };

  // Handle Activation Toggle
  const handleToggleActivation = async (checked: boolean) => {
    setSavingToggle(true);
    const success = await updateAdminSettings({ activationRequired: checked });
    setSavingToggle(false);
    if (success) {
      setSettings((prev) => ({ ...prev, activationRequired: checked }));
      toast({
        title: checked ? "Activation Code Enforcement ENABLED" : "Trial Mode ENABLED (OFF)",
        description: checked
          ? "Users must enter a valid activation code to access the app."
          : "Trial mode active: Anyone can sign in with Google freely without an activation code.",
      });
    } else {
      toast({
        title: "Failed to update setting",
        description: "Please check your internet connection.",
        variant: "destructive",
      });
    }
  };

  // Handle Maintenance Mode Toggle
  const handleToggleMaintenance = async (checked: boolean) => {
    setSavingMaint(true);
    const success = await updateAdminSettings({ maintenanceMode: checked });
    setSavingMaint(false);
    if (success) {
      setMaintMode(checked);
      setSettings((prev) => ({ ...prev, maintenanceMode: checked }));
      toast({
        title: checked ? "WEBSITE UNDER MAINTENANCE ENABLED (ON)" : "Website Restored & Active (OFF)",
        description: checked
          ? "Maintenance mode is ON: Access paused for all users."
          : "Website is live and active for all users.",
      });
    } else {
      toast({
        title: "Failed to update maintenance mode",
        description: "Please check your internet connection.",
        variant: "destructive",
      });
    }
  };

  // Handle Maintenance Details Save
  const handleSaveMaintenanceInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMaint(true);
    const success = await updateAdminSettings({
      maintenanceMode: maintMode,
      maintenanceMessage: maintMsg.trim() || "WEBSITE UNDER MAINTENANCE",
      supportContact: maintContact.trim() || "support@rulebyvinit.com | +91 98765 43210",
    });
    setSavingMaint(false);
    if (success) {
      setSettings((prev) => ({
        ...prev,
        maintenanceMode: maintMode,
        maintenanceMessage: maintMsg.trim(),
        supportContact: maintContact.trim(),
      }));
      toast({
        title: "Maintenance Information Saved!",
        description: "Custom headline and support contact text updated.",
      });
    } else {
      toast({
        title: "Failed to save maintenance details",
        variant: "destructive",
      });
    }
  };

  // Generate Code Helper
  const generateRandomCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let rand = "";
    for (let i = 0; i < 4; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
    return `R43-${rand}`;
  };

  // Handle Code Creation
  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = customCodeInput.trim() || generateRandomCode();
    setCreatingCode(true);

    const created = await createActivationCode(finalCode, newClientName, customExpiryInput || undefined);
    setCreatingCode(false);

    if (created) {
      setCodes((prev) => [created, ...prev]);
      setNewClientName("");
      setCustomCodeInput("");
      setCustomExpiryInput("");
      toast({
        title: "Activation Code Created!",
        description: `Code ${created.code} for FY ${created.financialYear} is live (Expires ${new Date(created.validUntil).toLocaleDateString("en-IN")}).`,
      });
    } else {
      toast({
        title: "Failed to create code",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle Code Activation / Deactivation Toggle
  const handleToggleCodeStatus = async (codeId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "revoked" ? "active" : "revoked";
    const ok = await updateCodeStatus(codeId, nextStatus);
    if (ok) {
      setCodes((prev) =>
        prev.map((c) => (c.id === codeId ? { ...c, status: nextStatus } : c))
      );
      toast({
        title: `Code ${nextStatus === "revoked" ? "Deactivated" : "Activated"}`,
        description: nextStatus === "revoked"
          ? "User account access suspended for this code."
          : "Code is now active for access.",
      });
    }
  };

  // Handle Code Deletion
  const handleDeleteCode = async (codeId: string, codeText: string) => {
    const ok = await deleteActivationCode(codeId);
    if (ok) {
      setCodes((prev) => prev.filter((c) => c.id !== codeId));
      toast({
        title: "Code Deleted Permanently",
        description: `Code ${codeText} has been deleted from database.`,
      });
    } else {
      toast({
        title: "Failed to delete code",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle Renewal Approval
  const handleApproveRenewal = async (req: RenewalRequest) => {
    const matchCode = codes.find(c => c.code === req.currentCode || c.usedByEmail === req.userEmail);
    if (!matchCode) {
      toast({ title: "Code record not found", description: "Please generate a new code for this client.", variant: "destructive" });
      return;
    }

    const okCode = await updateCodeStatus(matchCode.id, "redeemed", req.userEmail, req.userMobile, req.requestedFY);
    const okReq = await updateRenewalRequestStatus(req.id, "approved");

    if (okCode && okReq) {
      setCodes(prev => prev.map(c => c.id === matchCode.id ? { ...c, financialYear: req.requestedFY, status: "redeemed" } : c));
      setRenewals(prev => prev.map(r => r.id === req.id ? { ...r, status: "approved" } : r));
      toast({
        title: "License Renewed Successfully!",
        description: `License for ${req.userEmail} extended to FY ${req.requestedFY}.`,
      });
    } else {
      toast({ title: "Failed to approve renewal", variant: "destructive" });
    }
  };

  // Handle Copy to Clipboard
  const handleCopy = (codeText: string, id: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedId(id);
    toast({ title: "Code Copied!", description: `${codeText} copied to clipboard.` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle Save Client ID
  const handleSaveClientId = (e: React.FormEvent) => {
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
      title: "Client ID Saved!",
      description: "Google OAuth credentials updated.",
    });
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.mobile || "").includes(userSearch)
  );

  // If not authenticated as Admin: Show Admin Password Lock Screen
  if (!isAdminAuthenticated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10 relative overflow-hidden">
        <div className="w-full max-w-sm relative z-10 space-y-6">
          <Card className="border border-border/80 shadow-lg">
            <CardHeader className="text-center pb-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2 border border-primary/20">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg font-bold">Admin Security Access</CardTitle>
              <CardDescription className="text-xs">
                Enter Master Password to access gstreversal.vercel.app/vinit
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Master Admin Password</Label>
                  <Input
                    type="password"
                    placeholder="Enter Admin Password"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    className="text-xs h-10"
                    required
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full h-10 text-xs font-semibold">
                  Unlock Admin Dashboard
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const pendingRenewals = renewals.filter(r => r.status === "pending");

  return (
    <div className="min-h-screen bg-background px-4 py-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-xs font-semibold"
            onClick={() => setLocation("/sign-in")}
          >
            <ArrowLeft className="h-4 w-4" /> Back to App
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Master Administration Panel
            </h1>
            <p className="text-xs text-muted-foreground">
              Secret URL: gstreversal.vercel.app/vinit (Protected)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleAdminLogout}
            className="gap-1.5 text-xs font-semibold"
          >
            <LogOut className="h-3.5 w-3.5" /> Exit Admin
          </Button>
        </div>
      </div>

      {/* Summary Badges Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-3.5 rounded-xl border bg-card/60 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Users</p>
            <p className="text-lg font-bold">{users.length}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border bg-card/60 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active Codes</p>
            <p className="text-lg font-bold">{codes.filter(c => c.status === "active" || c.status === "redeemed").length}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border bg-card/60 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending Renewals</p>
            <p className="text-lg font-bold">{pendingRenewals.length}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border bg-card/60 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center font-bold">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Deactivated</p>
            <p className="text-lg font-bold">{codes.filter(c => c.status === "revoked").length}</p>
          </div>
        </div>
      </div>

      {/* Pending License Renewal Requests Section */}
      {pendingRenewals.length > 0 && (
        <Card className="border border-amber-500/30 bg-amber-500/5 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <CalendarCheck className="h-4 w-4" /> Pending FY License Renewal Requests
            </CardTitle>
            <CardDescription className="text-xs">
              Clients requesting license extension for next Financial Year.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden bg-background">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b text-[11px] font-semibold text-muted-foreground uppercase">
                    <th className="p-3">Client Email</th>
                    <th className="p-3">Mobile</th>
                    <th className="p-3">Current Code</th>
                    <th className="p-3">Requested FY</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pendingRenewals.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="p-3 font-semibold">{r.userEmail}</td>
                      <td className="p-3 font-mono">{r.userMobile}</td>
                      <td className="p-3"><code className="bg-muted px-1.5 py-0.5 rounded font-mono">{r.currentCode}</code></td>
                      <td className="p-3 font-bold text-emerald-600">FY {r.requestedFY}</td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          className="h-7 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 gap-1"
                          onClick={() => handleApproveRenewal(r)}
                        >
                          <Check className="h-3.5 w-3.5" /> Approve Renewal
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Website Under Maintenance Control Card */}
      <Card className="border border-destructive/40 bg-destructive/5 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <Wrench className="h-4 w-4" /> Website Under Maintenance Control
            </CardTitle>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                maintMode
                  ? "bg-destructive text-destructive-foreground border-destructive animate-pulse"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              }`}
            >
              {maintMode ? "ON (App Access Paused)" : "OFF (Website Live)"}
            </span>
          </div>
          <CardDescription className="text-xs mt-1">
            When Maintenance Mode is <strong>ON</strong>, no user can use the website. A large maintenance message and support contact info will be displayed. Admin panel remains accessible at <code>/vinit</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-background rounded-lg border">
            <div className="space-y-0.5 pr-2">
              <p className="text-xs font-bold text-foreground">
                {maintMode ? "Maintenance Lock Active (ON)" : "Website Operating Normally (OFF)"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {maintMode
                  ? "All app screens (Dashboard, Invoices, Turnover, Reports) are locked behind the Maintenance screen."
                  : "Users can navigate and use the application freely."}
              </p>
            </div>

            <Switch
              checked={maintMode}
              onCheckedChange={handleToggleMaintenance}
              disabled={savingMaint}
            />
          </div>

          <form onSubmit={handleSaveMaintenanceInfo} className="space-y-3 pt-2 border-t">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-foreground">Big Headline Message (Displayed on Maintenance Screen)</Label>
              <Input
                type="text"
                placeholder="e.g. WEBSITE UNDER MAINTENANCE"
                value={maintMsg}
                onChange={(e) => setMaintMsg(e.target.value)}
                className="text-xs h-9 font-bold uppercase"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-foreground">Small Font Support Contact Info (Displayed at Bottom)</Label>
              <Input
                type="text"
                placeholder="e.g. Contact Support Team: support@rulebyvinit.com | +91 98765 43210"
                value={maintContact}
                onChange={(e) => setMaintContact(e.target.value)}
                className="text-xs h-9"
                required
              />
            </div>

            <Button type="submit" size="sm" variant="outline" className="w-full h-8 text-xs font-semibold gap-1.5" disabled={savingMaint}>
              <Save className="h-3.5 w-3.5" /> Save Maintenance Text &amp; Support Info
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Grid Section 1: Activation Toggle & Admin Password */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Master ON/OFF Activation Toggle Card */}
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                {settings.activationRequired ? (
                  <Lock className="h-4 w-4 text-amber-500" />
                ) : (
                  <Unlock className="h-4 w-4 text-emerald-500" />
                )}
                Activation Code Enforcement
              </CardTitle>

              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  settings.activationRequired
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                }`}
              >
                {settings.activationRequired ? "ON (Strict Code Required)" : "OFF (Trial Mode)"}
              </span>
            </div>
            <CardDescription className="text-xs mt-1">
              Toggle whether users must have a valid activation code to access the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-muted/40 rounded-lg border">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold">
                  {settings.activationRequired
                    ? "Enforce Code (Strict Mode)"
                    : "Trial Mode (Free Access)"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {settings.activationRequired
                    ? "Strict Mode: All users must have a valid active code with un-expired FY."
                    : "Trial mode active: Anyone can sign in with Google freely without an activation code."}
                </p>
              </div>

              <Switch
                checked={settings.activationRequired}
                onCheckedChange={handleToggleActivation}
                disabled={savingToggle}
              />
            </div>
          </CardContent>
        </Card>

        {/* Change Admin Master Password Card */}
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" /> Admin Master Password
            </CardTitle>
            <CardDescription className="text-xs">
              Change the password required to access gstreversal.vercel.app/vinit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateAdminPassword} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">New Master Password</Label>
                <Input
                  type="password"
                  placeholder="Enter new admin password"
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  className="text-xs h-9"
                  required
                />
              </div>
              <Button type="submit" size="sm" className="w-full h-8 text-xs font-semibold gap-1.5">
                <Save className="h-3.5 w-3.5" /> Update Admin Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Grid Section 2: Google OAuth Client ID & Code Generator */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Google OAuth Client ID Card */}
        <Card className="border border-border/80 shadow-sm md:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" /> Google Client ID
              </CardTitle>
              {clientId ? (
                <span className="text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Active
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Missing
                </span>
              )}
            </div>
            <CardDescription className="text-xs">
              Google OAuth Client ID for cloud sync.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveClientId} className="space-y-3">
              <div className="space-y-1">
                <Input
                  placeholder="Enter Client ID"
                  value={tempClientId}
                  onChange={(e) => setTempClientId(e.target.value)}
                  className="text-xs h-9 font-mono"
                  required
                />
              </div>
              <Button type="submit" size="sm" className="w-full h-8 text-xs font-semibold gap-1.5">
                <Save className="h-3.5 w-3.5" /> Save Client ID
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Activation Code Generator */}
        <Card className="border border-border/80 shadow-sm md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" /> Generate Activation Codes (1 Code = 1 Gmail)
              </CardTitle>
              <span className="text-xs text-muted-foreground font-semibold">
                Total Codes: {codes.length}
              </span>
            </div>
            <CardDescription className="text-xs">
              Codes automatically lock to the first Gmail address and auto-calculate Financial Year validity (April to March) based on generation date.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleCreateCode} className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 bg-muted/30 rounded-lg border">
              <div>
                <Label className="text-[11px] font-semibold">Client Name / Label</Label>
                <Input
                  placeholder="e.g. Acme CA Firm"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="text-xs h-8 bg-background mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold">Custom Expiry Date (Optional)</Label>
                <Input
                  type="date"
                  value={customExpiryInput}
                  onChange={(e) => setCustomExpiryInput(e.target.value)}
                  className="text-xs h-8 bg-background mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold">Custom Code (Optional)</Label>
                <Input
                  placeholder="Blank for auto-generate"
                  value={customCodeInput}
                  onChange={(e) => setCustomCodeInput(e.target.value)}
                  className="text-xs h-8 bg-background mt-1 uppercase font-mono"
                />
              </div>

              <div className="flex items-end">
                <Button type="submit" size="sm" disabled={creatingCode} className="w-full h-8 text-xs font-semibold gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> {creatingCode ? "Generating..." : "Generate Code"}
                </Button>
              </div>
            </form>

            {/* Activation Code Directory Sub-Tabs */}
            <Tabs defaultValue="active" value={codeTabFilter} onValueChange={(v) => setCodeTabFilter(v as any)} className="w-full pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-primary" /> Activation Codes Sub-Directory
                </span>
                <TabsList className="h-8 p-1 bg-muted/60">
                  <TabsTrigger value="active" className="text-xs px-2.5 h-6 font-semibold data-[state=active]:text-emerald-600">
                    Active ({activeCodesList.length})
                  </TabsTrigger>
                  <TabsTrigger value="expired" className="text-xs px-2.5 h-6 font-semibold data-[state=active]:text-amber-600">
                    Expired ({expiredCodesList.length})
                  </TabsTrigger>
                  <TabsTrigger value="revoked" className="text-xs px-2.5 h-6 font-semibold data-[state=active]:text-red-600">
                    Deactive / Blocked ({revokedCodesList.length})
                  </TabsTrigger>
                  <TabsTrigger value="all" className="text-xs px-2.5 h-6 font-semibold">
                    All ({codes.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value={codeTabFilter} className="mt-3">
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-64 overflow-y-auto divide-y">
                    {filteredCodes.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        No activation codes found in "{codeTabFilter}" sub-tab.
                      </div>
                    ) : (
                      filteredCodes.map((c) => {
                        const expired = isCodeExpired(c);
                        const isDeactive = c.status === "revoked";
                        const formattedExpiry = c.validUntil
                          ? new Date(c.validUntil).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
                          : "31/03/2027";

                        return (
                          <div key={c.id} className="p-3 flex items-center justify-between gap-3 hover:bg-muted/20 text-xs">
                            <div className="flex items-center gap-3">
                              <code className="font-bold text-xs bg-muted px-2 py-1 rounded font-mono text-primary border">
                                {c.code}
                              </code>
                              <div>
                                <p className="font-semibold text-foreground leading-tight flex items-center gap-2">
                                  <span>{c.clientName}</span>
                                  <span className="text-[10px] text-emerald-600 font-mono font-bold">(FY {c.financialYear || "2026-27"})</span>
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  Created: {new Date(c.createdAt).toLocaleDateString("en-IN")} • <span className="font-semibold text-foreground">Expiry Date: {formattedExpiry}</span>
                                  {c.usedByEmail && ` • Locked to: ${c.usedByEmail}`}
                                  {c.usedByMobile && ` • Mobile: ${c.usedByMobile}`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${
                                  isDeactive
                                    ? "bg-red-500/15 text-red-600 border-red-500/30"
                                    : expired
                                    ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                                    : c.status === "redeemed"
                                    ? "bg-blue-500/15 text-blue-600 border-blue-500/30"
                                    : "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                                }`}
                              >
                                {isDeactive ? "Deactivated" : expired ? "Expired" : c.status}
                              </span>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleCopy(c.code, c.id)}
                                title="Copy Code"
                              >
                                {copiedId === c.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </Button>

                              {/* Activate / Deactivate Toggle Button */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-7 w-7 ${isDeactive ? "text-emerald-600 hover:bg-emerald-50" : "text-amber-600 hover:bg-amber-50"}`}
                                onClick={() => handleToggleCodeStatus(c.id, c.status)}
                                title={isDeactive ? "Activate Code" : "Deactivate Code"}
                              >
                                <Power className="h-3.5 w-3.5" />
                              </Button>

                              {/* Delete Code Button */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteCode(c.id, c.code)}
                                title="Delete Code Permanently"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Grid Section 3: Live Registered Users Table */}
      <Card className="border border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Live Registered Users Directory
              </CardTitle>
              <CardDescription className="text-xs">
                View all clients/users who have signed in and used your application.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
                {users.length} Users Registered
              </span>
              <div className="relative w-48">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search email/mobile..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="text-xs h-8 pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="p-3">User</th>
                  <th className="p-3">Email Address</th>
                  <th className="p-3">Mobile No</th>
                  <th className="p-3">First Login</th>
                  <th className="p-3">Code / FY</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground text-xs">
                      No user records found. Users will automatically appear here once they log in.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                        {u.picture ? (
                          <img src={u.picture} alt="" className="h-6 w-6 rounded-full border" />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                            {(u.name || u.email).slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span>{u.name || "User"}</span>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">{u.email}</td>
                      <td className="p-3 font-mono font-semibold text-foreground">
                        {u.mobile ? (
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-primary" /> {u.mobile}</span>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {u.firstLogin ? new Date(u.firstLogin).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="p-3">
                        {u.codeUsed ? (
                          <div className="flex flex-col">
                            <code className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border w-fit">{u.codeUsed}</code>
                            {u.financialYear && <span className="text-[10px] text-emerald-600 font-semibold mt-0.5">FY {u.financialYear}</span>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">None (Trial)</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-semibold uppercase bg-emerald-500/15 text-emerald-600 px-2 py-0.5 rounded border border-emerald-500/30">
                          {u.status || "Active"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
