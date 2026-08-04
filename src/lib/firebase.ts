const PROJECT_ID = "gst-rule-42-43-calculator";
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export interface AdminSettings {
  activationRequired: boolean;
  adminPin?: string;
  updatedAt?: string;
}

export interface ActivationCode {
  id: string;
  code: string;
  clientName: string;
  status: "active" | "redeemed" | "revoked" | "expired";
  createdAt: string;
  financialYear: string; // e.g. "2026-27"
  validUntil: string;    // ISO Date string e.g. "2027-03-31T23:59:59.000Z"
  usedByEmail?: string;
  usedByMobile?: string;
  usedAt?: string;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  mobile?: string;
  picture?: string;
  firstLogin: string;
  lastLogin: string;
  codeUsed?: string;
  financialYear?: string;
  status: "active" | "blocked";
}

export interface RenewalRequest {
  id: string;
  userEmail: string;
  userName: string;
  userMobile: string;
  currentCode: string;
  currentFY: string;
  requestedFY: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
}

/** Helper to extract Firestore JSON values */
function parseFirestoreDoc(doc: any): any {
  if (!doc || !doc.fields) return {};
  const out: Record<string, any> = { id: doc.name.split("/").pop() };
  for (const [key, value] of Object.entries<any>(doc.fields)) {
    if (value.stringValue !== undefined) out[key] = value.stringValue;
    else if (value.booleanValue !== undefined) out[key] = value.booleanValue;
    else if (value.integerValue !== undefined) out[key] = Number(value.integerValue);
    else if (value.doubleValue !== undefined) out[key] = Number(value.doubleValue);
    else if (value.timestampValue !== undefined) out[key] = value.timestampValue;
  }
  return out;
}

/** Helper to format JS object into Firestore field values */
function formatFirestoreFields(data: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (key === "id") continue;
    if (typeof val === "boolean") fields[key] = { booleanValue: val };
    else if (typeof val === "number") fields[key] = { doubleValue: val };
    else fields[key] = { stringValue: String(val ?? "") };
  }
  return fields;
}

/** Auto-calculate current Indian Financial Year based on creation date */
export function getCurrentFinancialYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed (1=Jan, 4=Apr, 12=Dec)
  
  if (month >= 4) {
    const nextYr = (year + 1) % 100;
    return `${year}-${nextYr < 10 ? '0' + nextYr : nextYr}`;
  } else {
    const prevYr = year - 1;
    const currYr = year % 100;
    return `${prevYr}-${currYr < 10 ? '0' + currYr : currYr}`;
  }
}

/** Calculate next Financial Year e.g. "2026-27" -> "2027-28" */
export function getNextFinancialYear(currentFY: string = "2026-27"): string {
  const parts = currentFY.split("-");
  if (parts.length === 2) {
    const startYr = parseInt(parts[0], 10);
    if (!isNaN(startYr)) {
      const nextStart = startYr + 1;
      const nextEnd = (nextStart + 1) % 100;
      return `${nextStart}-${nextEnd < 10 ? '0' + nextEnd : nextEnd}`;
    }
  }
  return "2027-28";
}

/** Helper to calculate FY end date (March 31st of second year) */
export function calculateFYEndDate(financialYear: string): string {
  const parts = financialYear.split("-");
  let endYear = new Date().getFullYear();
  if (parts.length === 2) {
    const startYr = parseInt(parts[0], 10);
    const endYrPart = parseInt(parts[1], 10);
    if (!isNaN(startYr) && !isNaN(endYrPart)) {
      endYear = endYrPart < 100 ? Math.floor(startYr / 100) * 100 + endYrPart : endYrPart;
    }
  }
  return new Date(Date.UTC(endYear, 2, 31, 23, 59, 59)).toISOString(); // March 31
}

/** Get Master Admin Settings with 2.5s timeout */
export async function getAdminSettings(): Promise<AdminSettings> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${FIRESTORE_BASE_URL}/settings/config`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const doc = await res.json();
      const parsed = parseFirestoreDoc(doc);
      return {
        activationRequired: Boolean(parsed.activationRequired ?? false),
        maintenanceMode: Boolean(parsed.maintenanceMode ?? false),
        maintenanceMessage: parsed.maintenanceMessage ?? "WEBSITE UNDER MAINTENANCE",
        supportContact: parsed.supportContact ?? "support@rulebyvinit.com | +91 98765 43210",
        updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      };
    }
  } catch (e) {
    console.error("Failed to fetch admin settings:", e);
  }
  return {
    activationRequired: false,
    maintenanceMode: false,
    maintenanceMessage: "WEBSITE UNDER MAINTENANCE",
    supportContact: "support@rulebyvinit.com | +91 98765 43210",
  };
}

/** Update Master Admin Settings */
export async function updateAdminSettings(settings: Partial<AdminSettings>): Promise<boolean> {
  try {
    const fields = formatFirestoreFields({
      ...settings,
      updatedAt: new Date().toISOString(),
    });

    const updateMasks = Object.keys(settings).map((k) => `updateMask.fieldPaths=${k}`).join("&");
    const maskQuery = updateMasks ? `?${updateMasks}&updateMask.fieldPaths=updatedAt` : `?updateMask.fieldPaths=updatedAt`;

    const res = await fetch(`${FIRESTORE_BASE_URL}/settings/config${maskQuery}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    return res.ok;
  } catch (e) {
    console.error("Failed to update admin settings:", e);
    return false;
  }
}

/** Get all Activation Codes */
export async function getActivationCodes(): Promise<ActivationCode[]> {
  try {
    const res = await fetch(`${FIRESTORE_BASE_URL}/activation_codes`);
    if (res.ok) {
      const data = await res.json();
      const docs = data.documents || [];
      return docs.map(parseFirestoreDoc);
    }
  } catch (e) {
    console.error("Failed to fetch activation codes:", e);
  }
  return [];
}

/** Create a new Activation Code with Automatic or Custom Expiry Date */
export async function createActivationCode(
  code: string,
  clientName: string,
  customExpiryDate?: string,
  customFY?: string
): Promise<ActivationCode | null> {
  try {
    const id = `code_${Date.now()}`;
    const financialYear = customFY ? customFY.trim() : getCurrentFinancialYear();
    const validUntil = customExpiryDate
      ? new Date(`${customExpiryDate}T23:59:59.000Z`).toISOString()
      : calculateFYEndDate(financialYear);

    const record: ActivationCode = {
      id,
      code: code.toUpperCase().trim(),
      clientName: clientName.trim() || "General Client",
      status: "active",
      financialYear,
      validUntil,
      createdAt: new Date().toISOString(),
    };

    const res = await fetch(`${FIRESTORE_BASE_URL}/activation_codes?documentId=${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: formatFirestoreFields(record) }),
    });

    if (res.ok) {
      return record;
    }
  } catch (e) {
    console.error("Failed to create activation code:", e);
  }
  return null;
}

/** Update / Revoke / Renew Activation Code Status */
export async function updateCodeStatus(
  codeId: string,
  status: "active" | "revoked" | "redeemed" | "expired",
  usedByEmail?: string,
  usedByMobile?: string,
  newFY?: string
): Promise<boolean> {
  try {
    const data: Record<string, any> = { status };
    if (usedByEmail) data.usedByEmail = usedByEmail;
    if (usedByMobile) data.usedByMobile = usedByMobile;
    if (status === "redeemed") data.usedAt = new Date().toISOString();
    if (newFY) {
      data.financialYear = newFY;
      data.validUntil = calculateFYEndDate(newFY);
      data.status = "redeemed";
    }

    const fields = formatFirestoreFields(data);
    const query = Object.keys(data).map(k => `updateMask.fieldPaths=${k}`).join("&");

    const res = await fetch(`${FIRESTORE_BASE_URL}/activation_codes/${codeId}?${query}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    return res.ok;
  } catch (e) {
    console.error("Failed to update code status:", e);
    return false;
  }
}

/** Delete an Activation Code permanently from Firestore */
export async function deleteActivationCode(codeId: string): Promise<boolean> {
  try {
    const res = await fetch(`${FIRESTORE_BASE_URL}/activation_codes/${codeId}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch (e) {
    console.error("Failed to delete activation code:", e);
    return false;
  }
}

/** Verify if an activation code is valid, active, not expired, and lock it to 1 Gmail address & mobile */
export async function verifyActivationCode(
  inputCode: string,
  userEmail?: string,
  userMobile?: string
): Promise<{ valid: boolean; doc?: ActivationCode; message?: string }> {
  try {
    const codes = await getActivationCodes();
    const cleanInput = inputCode.trim().toUpperCase();
    const cleanEmail = (userEmail || "").trim().toLowerCase();
    const match = codes.find(c => c.code === cleanInput);

    if (!match) {
      return { valid: false, message: "Invalid activation code. Please check and try again." };
    }
    if (match.status === "revoked") {
      return {
        valid: false,
        message: "Account Access Suspended: Your activation code is pending, expired, or deactivated. Please contact support to activate your account.",
      };
    }

    // Check Expiry Date
    if (match.validUntil) {
      const expiryDate = new Date(match.validUntil);
      if (new Date() > expiryDate) {
        return {
          valid: false,
          doc: match,
          message: `License Expired: Your code for FY ${match.financialYear || "2026-27"} expired on ${expiryDate.toLocaleDateString("en-IN")}. Please submit a renewal request to continue.`,
        };
      }
    }

    // Check Gmail Lock
    if (match.status === "redeemed" && match.usedByEmail) {
      if (cleanEmail && match.usedByEmail.toLowerCase() !== cleanEmail) {
        return {
          valid: false,
          message: `This activation code is locked to ${match.usedByEmail} and cannot be used by another Gmail account.`,
        };
      }
    }
    return { valid: true, doc: match };
  } catch (e) {
    console.error("Verify code error:", e);
    return { valid: false, message: "Failed to verify code. Please check your internet connection." };
  }
}

/** Get all Registered Users combining users collection & redeemed activation codes */
export async function getRegisteredUsers(): Promise<UserRecord[]> {
  try {
    const [usersRes, codesRes] = await Promise.all([
      fetch(`${FIRESTORE_BASE_URL}/users`),
      fetch(`${FIRESTORE_BASE_URL}/activation_codes`),
    ]);

    let userList: UserRecord[] = [];
    if (usersRes.ok) {
      const data = await usersRes.json();
      userList = (data.documents || []).map(parseFirestoreDoc);
    }

    let codeList: ActivationCode[] = [];
    if (codesRes.ok) {
      const data = await codesRes.json();
      codeList = (data.documents || []).map(parseFirestoreDoc);
    }

    // Merge redeemed activation code users into userList if not present
    for (const code of codeList) {
      if (code.usedByEmail || code.usedByMobile) {
        const emailKey = (code.usedByEmail || "").toLowerCase().trim();
        const existing = userList.find(u => u.email.toLowerCase() === emailKey || (code.usedByMobile && u.mobile === code.usedByMobile));
        if (existing) {
          if (!existing.codeUsed) existing.codeUsed = code.code;
          if (!existing.mobile && code.usedByMobile) existing.mobile = code.usedByMobile;
          if (!existing.financialYear) existing.financialYear = code.financialYear;
        } else {
          userList.push({
            id: `merged_${code.id}`,
            email: code.usedByEmail || `${code.usedByMobile}@client.local`,
            name: code.clientName || "Client User",
            mobile: code.usedByMobile || "",
            firstLogin: code.usedAt || code.createdAt || new Date().toISOString(),
            lastLogin: code.usedAt || new Date().toISOString(),
            codeUsed: code.code,
            financialYear: code.financialYear || "2026-27",
            status: code.status === "revoked" ? "blocked" : "active",
          });
        }
      }
    }

    return userList;
  } catch (e) {
    console.error("Failed to fetch registered users:", e);
  }
  return [];
}

/** Log User Sign-In / Registration with Mobile Number */
export async function logUserSignIn(
  email: string,
  name: string,
  picture?: string,
  codeUsed?: string,
  mobile?: string,
  fy?: string
): Promise<boolean> {
  try {
    const cleanEmail = email.toLowerCase().trim();
    const docId = cleanEmail.replace(/[^a-z0-9]/gi, "_");
    const now = new Date().toISOString();

    const existingRes = await fetch(`${FIRESTORE_BASE_URL}/users/${docId}`);
    let record: Record<string, any> = {
      email: cleanEmail,
      name: name || cleanEmail.split("@")[0],
      picture: picture || "",
      lastLogin: now,
      status: "active",
    };

    if (codeUsed) record.codeUsed = codeUsed;
    if (mobile) record.mobile = mobile;
    if (fy) record.financialYear = fy;

    if (existingRes.ok) {
      const fields = formatFirestoreFields(record);
      const query = Object.keys(record).map(k => `updateMask.fieldPaths=${k}`).join("&");
      await fetch(`${FIRESTORE_BASE_URL}/users/${docId}?${query}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
    } else {
      record.firstLogin = now;
      const fields = formatFirestoreFields(record);
      await fetch(`${FIRESTORE_BASE_URL}/users/${docId}?documentId=${docId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
    }
    return true;
  } catch (e) {
    console.error("Failed to log user sign-in:", e);
    return false;
  }
}

/** Submit a License Renewal Request from Client */
export async function createRenewalRequest(req: Omit<RenewalRequest, "id" | "requestedAt" | "status">): Promise<boolean> {
  try {
    const id = `req_${Date.now()}`;
    const record: RenewalRequest = {
      ...req,
      id,
      requestedAt: new Date().toISOString(),
      status: "pending",
    };
    const res = await fetch(`${FIRESTORE_BASE_URL}/renewal_requests?documentId=${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: formatFirestoreFields(record) }),
    });
    return res.ok;
  } catch (e) {
    console.error("Failed to create renewal request:", e);
    return false;
  }
}

/** Get all Renewal Requests for Admin */
export async function getRenewalRequests(): Promise<RenewalRequest[]> {
  try {
    const res = await fetch(`${FIRESTORE_BASE_URL}/renewal_requests`);
    if (res.ok) {
      const data = await res.json();
      const docs = data.documents || [];
      return docs.map(parseFirestoreDoc);
    }
  } catch (e) {
    console.error("Failed to fetch renewal requests:", e);
  }
  return [];
}

/** Approve / Reject Renewal Request */
export async function updateRenewalRequestStatus(requestId: string, status: "approved" | "rejected"): Promise<boolean> {
  try {
    const fields = formatFirestoreFields({ status });
    const res = await fetch(`${FIRESTORE_BASE_URL}/renewal_requests/${requestId}?updateMask.fieldPaths=status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    return res.ok;
  } catch (e) {
    console.error("Failed to update renewal request status:", e);
    return false;
  }
}
