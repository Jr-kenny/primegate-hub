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

function isPrimeGateSession(value: unknown): value is PrimeGateSession {
  return Boolean(
    value &&
      typeof value === "object" &&
      "expiresAt" in value &&
      "keyType" in value &&
      "publicKeyHex" in value &&
      "token" in value &&
      "walletAddress" in value,
  );
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

  const rawValue = window.localStorage.getItem(PRIMEGATE_SESSION_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    return isPrimeGateSession(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

export function persistPrimeGateSession(session: PrimeGateSession) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(PRIMEGATE_SESSION_KEY, JSON.stringify(session));
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
