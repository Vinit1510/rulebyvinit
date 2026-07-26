/**
 * Secure Obfuscated Storage Helper
 * Prevents inspection of activation codes, emails, and phone numbers from DevTools LocalStorage
 */
const OBFUSCATION_SALT = "GST_R43_RULE_CALCULATOR_2026_SECURITY_SALT";

function encodeString(str: string): string {
  if (!str) return "";
  let result = "";
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ OBFUSCATION_SALT.charCodeAt(i % OBFUSCATION_SALT.length));
  }
  return btoa(encodeURIComponent(result));
}

function decodeString(encoded: string): string {
  if (!encoded) return "";
  try {
    const raw = decodeURIComponent(atob(encoded));
    let result = "";
    for (let i = 0; i < raw.length; i++) {
      result += String.fromCharCode(raw.charCodeAt(i) ^ OBFUSCATION_SALT.charCodeAt(i % OBFUSCATION_SALT.length));
    }
    return result;
  } catch (e) {
    return "";
  }
}

export const secureStorage = {
  setItem: (key: string, value: string) => {
    if (typeof window === "undefined") return;
    const encKey = btoa(`_enc_${key}`);
    const encVal = encodeString(value);
    localStorage.setItem(encKey, encVal);
    // Remove legacy un-encrypted key if present
    localStorage.removeItem(key);
  },

  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    const encKey = btoa(`_enc_${key}`);
    const encVal = localStorage.getItem(encKey);
    if (encVal) {
      const decoded = decodeString(encVal);
      if (decoded) return decoded;
    }
    // Migration fallback for legacy plain text entries
    const plain = localStorage.getItem(key);
    if (plain) {
      secureStorage.setItem(key, plain);
      return plain;
    }
    return null;
  },

  removeItem: (key: string) => {
    if (typeof window === "undefined") return;
    const encKey = btoa(`_enc_${key}`);
    localStorage.removeItem(encKey);
    localStorage.removeItem(key);
  },
};

/** Anti-DevTools / Right-Click & Console Protection */
export function initDevToolsProtection() {
  if (typeof window === "undefined") return;

  // 1. Disable Right-Click Context Menu
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    return false;
  });

  // 2. Disable DevTools Keyboard Shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U)
  document.addEventListener("keydown", (e) => {
    if (
      e.keyCode === 123 || // F12
      (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) || // Ctrl+Shift+I/J/C
      (e.ctrlKey && e.keyCode === 85) // Ctrl+U
    ) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  });

  // 3. Clear and Silence Console in Production
  if (import.meta.env.PROD || true) {
    const noop = () => {};
    console.log = noop;
    console.warn = noop;
    console.info = noop;
    console.debug = noop;
  }
}
