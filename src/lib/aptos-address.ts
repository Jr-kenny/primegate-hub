function toAddressString(address: string | { toString: () => string }) {
  const value = typeof address === "string" ? address : address.toString();
  return value.trim().toLowerCase();
}

export function normalizeAptosAddress(address: string | { toString: () => string }): string {
  const normalized = toAddressString(address);
  const hex = normalized.startsWith("0x") ? normalized.slice(2) : normalized;

  if (!hex || hex.length > 64 || !/^[0-9a-f]+$/.test(hex)) {
    throw new Error("Invalid Aptos address.");
  }

  return `0x${hex.padStart(64, "0")}`;
}
