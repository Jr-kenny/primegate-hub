export type PrimeGateSession = {
  expiresAt: string;
  keyType: string;
  publicKeyHex: string;
  token: string;
  walletAddress: string;
};

const PRIMEGATE_SESSION_KEY = "primegate:session:v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function bytesToHex(bytes: Uint8Array) {
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `0x${hex}`;
}

export function normalizeHex(value: string) {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

export function getStoredPrimeGateSession() {
  if (!canUseStorage()) {
    return null;
  }

  window.localStorage.removeItem(PRIMEGATE_SESSION_KEY);
  return null;
}

export function persistPrimeGateSession(_session: PrimeGateSession) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(PRIMEGATE_SESSION_KEY);
}

export function clearPrimeGateSession() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(PRIMEGATE_SESSION_KEY);
}

export function getPrimeGateSessionToken() {
  const session = getStoredPrimeGateSession();
  if (!session) {
    return null;
  }

  if (!hasValidPrimeGateSession(session.walletAddress)) {
    clearPrimeGateSession();
    return null;
  }

  return session.token;
}

export function hasValidPrimeGateSession(walletAddress?: string | null) {
  const session = getStoredPrimeGateSession();
  if (!session) {
    return false;
  }

  if (walletAddress && session.walletAddress !== walletAddress.toLowerCase()) {
    return false;
  }

  return new Date(session.expiresAt).getTime() > Date.now();
}
