import { useEffect, useState, useCallback, useRef } from "react";
import { type Invoice, type MonthlyTurnover } from "@/lib/rule43";
import { useAuth } from "@/hooks/useAuth";
import { searchTaxDataFile, downloadTaxDataFile, uploadTaxDataFile } from "@/lib/googleDrive";

const STORAGE_KEY = "gst-itc-calc-v2";

interface CalcState {
  invoices: Invoice[];
  turnover: Record<string, MonthlyTurnover>;
}

const defaultState: CalcState = { invoices: [], turnover: {} };

/** Migrate a single invoice that was saved before IGST/CGST/SGST split */
function migrateInvoice(raw: any): Invoice {
  const inv = { ...raw };
  if (inv.gstRate !== undefined && inv.igstRate === undefined) {
    inv.igstRate = Number(inv.gstRate) || 0;
    inv.cgstRate = 0; inv.sgstRate = 0;
    delete inv.gstRate;
  }
  if (inv.igstRate === undefined) inv.igstRate = 0;
  if (inv.cgstRate === undefined) inv.cgstRate = 0;
  if (inv.sgstRate === undefined) inv.sgstRate = 0;

  if (Array.isArray(inv.creditNotes)) {
    inv.creditNotes = inv.creditNotes.map((cn: any) => {
      if (cn.gstRate !== undefined && cn.igstRate === undefined) {
        return { ...cn, igstRate: Number(cn.gstRate) || 0, cgstRate: 0, sgstRate: 0, gstRate: undefined };
      }
      if (cn.igstRate === undefined) return { ...cn, igstRate: 0, cgstRate: 0, sgstRate: 0 };
      return cn;
    });
  }
  if (Array.isArray(inv.debitNotes)) {
    inv.debitNotes = inv.debitNotes.map((dn: any) => {
      if (dn.gstRate !== undefined && dn.igstRate === undefined) {
        return { ...dn, igstRate: Number(dn.gstRate) || 0, cgstRate: 0, sgstRate: 0, gstRate: undefined };
      }
      if (dn.igstRate === undefined) return { ...dn, igstRate: 0, cgstRate: 0, sgstRate: 0 };
      return dn;
    });
  }
  return inv as Invoice;
}

function loadLocalState(): CalcState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    const invoices: Invoice[] = Array.isArray(parsed.invoices)
      ? parsed.invoices.map(migrateInvoice)
      : [];
    return { invoices, turnover: parsed.turnover ?? {} };
  } catch {
    return defaultState;
  }
}

export function useCalculator() {
  const { accessToken, isSignedIn } = useAuth();
  const [state, setState] = useState<CalcState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // References to keep track of Google Drive File ID and the debounce sync timer
  const fileIdRef = useRef<string | null>(null);
  const syncTimeoutRef = useRef<number | null>(null);
  const latestStateRef = useRef<CalcState>(defaultState);

  // Keep latestStateRef updated so that the async debounced sync always has the freshest state
  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  // Load from local storage initially (Offline-first approach)
  useEffect(() => {
    const local = loadLocalState();
    setState(local);
    setHydrated(true);
  }, []);

  // Sync state to LocalStorage mirror on every local change
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to write state to localStorage", e);
    }
  }, [state, hydrated]);

  // Debounced Sync to Google Drive
  const triggerGoogleDriveSync = useCallback(() => {
    if (!isSignedIn || !accessToken) return;

    // Clear any existing sync timer to debounce the save
    if (syncTimeoutRef.current !== null) {
      window.clearTimeout(syncTimeoutRef.current);
    }

    // Set a 1.5-second debounce timer
    syncTimeoutRef.current = window.setTimeout(async () => {
      setSyncing(true);
      try {
        const freshState = latestStateRef.current;
        const uploadedFileId = await uploadTaxDataFile(
          accessToken,
          fileIdRef.current,
          freshState
        );
        fileIdRef.current = uploadedFileId;
      } catch (error) {
        console.error("Debounced Google Drive Sync Failed:", error);
      } finally {
        setSyncing(false);
      }
    }, 1500);
  }, [accessToken, isSignedIn]);

  // Load state from Google Drive upon sign-in
  useEffect(() => {
    if (!isSignedIn || !accessToken) {
      fileIdRef.current = null;
      return;
    }

    (async () => {
      setSyncing(true);
      try {
        // 1. Search if rule43_calculator_data.json exists in Google Drive
        const fileId = await searchTaxDataFile(accessToken);
        fileIdRef.current = fileId;

        if (fileId) {
          // 2. Download contents
          const remoteState = await downloadTaxDataFile(accessToken, fileId);
          if (remoteState && (Array.isArray(remoteState.invoices) || remoteState.turnover)) {
            const formattedInvoices = (remoteState.invoices || []).map(migrateInvoice);
            const loadedState = {
              invoices: formattedInvoices,
              turnover: remoteState.turnover || {},
            };
            setState(loadedState);
          }
        } else {
          // 3. File doesn't exist yet: Create it with our current local storage data
          const currentLocal = loadLocalState();
          const newFileId = await uploadTaxDataFile(accessToken, null, currentLocal);
          fileIdRef.current = newFileId;
        }
      } catch (error) {
        console.error("Initial load from Google Drive failed:", error);
      } finally {
        setSyncing(false);
      }
    })();
  }, [isSignedIn, accessToken]);

  const upsertInvoice = useCallback(
    async (inv: Invoice) => {
      setState((s) => {
        const idx = s.invoices.findIndex((i) => i.id === inv.id);
        const next = [...s.invoices];
        if (idx >= 0) next[idx] = inv; else next.push(inv);
        return { ...s, invoices: next };
      });
      // Trigger background cloud save
      triggerGoogleDriveSync();
    },
    [triggerGoogleDriveSync]
  );

  const deleteInvoice = useCallback(
    async (id: string) => {
      setState((s) => ({ ...s, invoices: s.invoices.filter((i) => i.id !== id) }));
      triggerGoogleDriveSync();
    },
    [triggerGoogleDriveSync]
  );

  const setTurnover = useCallback(
    async (key: string, t: MonthlyTurnover) => {
      setState((s) => ({ ...s, turnover: { ...s.turnover, [key]: t } }));
      triggerGoogleDriveSync();
    },
    [triggerGoogleDriveSync]
  );

  const applyToAllTurnover = useCallback(
    async (keys: string[], t: MonthlyTurnover) => {
      setState((s) => {
        const next = { ...s.turnover };
        keys.forEach((k) => { next[k] = { ...t }; });
        return { ...s, turnover: next };
      });
      triggerGoogleDriveSync();
    },
    [triggerGoogleDriveSync]
  );

  const bulkImport = useCallback(
    async (invoices: Invoice[]) => {
      const migrated = invoices.map(migrateInvoice);
      setState((s) => ({ ...s, invoices: [...s.invoices, ...migrated] }));
      triggerGoogleDriveSync();
    },
    [triggerGoogleDriveSync]
  );

  const reset = useCallback(async () => {
    setState(defaultState);
    if (isSignedIn && accessToken && fileIdRef.current) {
      setSyncing(true);
      try {
        await uploadTaxDataFile(accessToken, fileIdRef.current, defaultState);
      } catch (e) {
        console.error("Google Drive Reset Failed:", e);
      } finally {
        setSyncing(false);
      }
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }, [isSignedIn, accessToken]);

  return {
    state,
    hydrated,
    syncing,
    upsertInvoice,
    deleteInvoice,
    bulkImport,
    setTurnover,
    applyToAllTurnover,
    reset,
  };
}

export type { CalcState };
