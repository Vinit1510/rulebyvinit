import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  format: "excel" | "pdf";
  hasBlockedCredits: boolean;
  blockedCount: number;
  onConfirm: (opts: { includeBlockedCredit: boolean }) => void;
}

export function ExportOptionsDialog({ open, onOpenChange, format, hasBlockedCredits, blockedCount, onConfirm }: Props) {
  const [includeBlocked, setIncludeBlocked] = useState(true);
  const fmtLabel = format === "excel" ? "Excel" : "PDF";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export {fmtLabel} report</DialogTitle>
          <DialogDescription>Choose what to include before downloading.</DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-3">
          {hasBlockedCredits ? (
            <div className="flex items-start gap-3 rounded-md border p-3 bg-muted/30">
              <Checkbox
                id="include-blocked"
                checked={includeBlocked}
                onCheckedChange={(c) => setIncludeBlocked(c === true)}
              />
              <div className="space-y-0.5">
                <Label htmlFor="include-blocked" className="cursor-pointer font-medium">
                  Include Section 17(5) blocked credit
                </Label>
                <p className="text-xs text-muted-foreground">
                  Adds a separate sheet/page listing {blockedCount} blocked invoice{blockedCount === 1 ? "" : "s"} and the ineligible ITC.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No Section 17(5) entries in the current period.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onConfirm({ includeBlockedCredit: hasBlockedCredits && includeBlocked }); onOpenChange(false); }}>
            Download {fmtLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
