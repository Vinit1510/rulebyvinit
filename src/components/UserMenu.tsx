import { useState } from "react";
import { useLocation } from "wouter";
import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { ProfileDialog } from "@/components/ProfileDialog";

export function UserMenu() {
  const { user, signOut, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const [busy, setBusy] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // If working in offline bypass mode, render a clean "Offline Workspace" menu
  const isOffline = typeof window !== "undefined" && localStorage.getItem("r43_working_offline") === "true";

  if (!isSignedIn && isOffline) {
    const handleSignOut = () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem("r43_working_offline");
      }
      setLocation("/sign-in");
    };

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 px-3 border-dashed hover:bg-muted/60" aria-label="Offline Workspace">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-semibold">Offline</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
            Local browser sandbox
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive text-xs">
            <LogOut className="h-3.5 w-3.5 mr-2" /> Exit Offline Mode
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (!user) return null;

  const email = user.email || "";
  const name = user.name || email.split("@")[0];
  const initials = (name || email || "U").slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    setBusy(true);
    await signOut();
    if (typeof window !== "undefined") {
      localStorage.removeItem("r43_working_offline");
    }
    setBusy(false);
    setLocation("/sign-in");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full shadow-sm hover:bg-muted/50" aria-label="User menu">
          <Avatar className="h-8 w-8 border border-border">
            {user.picture && <AvatarImage src={user.picture} alt={name} referrerPolicy="no-referrer" />}
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border border-border shadow-md">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold truncate leading-tight">{name}</span>
            <span className="text-[11px] text-muted-foreground truncate leading-tight">{email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setProfileOpen(true)} className="text-xs font-medium cursor-pointer py-2">
          <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" /> Account details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut} disabled={busy} className="text-destructive focus:text-destructive text-xs font-medium cursor-pointer py-2">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </DropdownMenu>
  );
}
