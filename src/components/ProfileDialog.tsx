import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: Props) {
  const { user, clientId } = useAuth();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border border-border shadow-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Google Profile Account</DialogTitle>
          <DialogDescription className="text-xs">
            Your login details are synced securely with Google. Changes to your name or profile picture must be managed in your Google Account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {user?.picture && (
            <div className="flex justify-center pb-2">
              <img
                src={user.picture}
                alt={user.name}
                className="h-16 w-16 rounded-full border-2 border-primary/20 shadow-sm"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="profile-name" className="text-xs font-semibold">Full name</Label>
            <Input id="profile-name" value={user?.name ?? ""} readOnly className="text-xs bg-muted/40 cursor-default" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-email" className="text-xs font-semibold">Email address</Label>
            <Input id="profile-email" value={user?.email ?? ""} readOnly className="text-xs bg-muted/40 cursor-default" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-client-id" className="text-xs font-semibold">Active OAuth Client ID</Label>
            <Input id="profile-client-id" value={clientId || "(Environment Default)"} readOnly className="text-xs bg-muted/40 cursor-default truncate" />
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-xs font-semibold">
            Close details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
