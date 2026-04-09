export const APTOS_COIN_TYPE = "0x1::aptos_coin::AptosCoin";
export const APT_DECIMALS = 8;
export const OCTAS_PER_APT = 10n ** BigInt(APT_DECIMALS);

function normalizeRawAptAmount(value: string | number) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("APT amount must be a non-negative finite number.");
    }

    value = value.toString();
  }

  let normalized = value.trim();
  if (!normalized) {
    throw new Error("APT amount is required.");
  }

  if (normalized.startsWith("+")) {
    normalized = normalized.slice(1);
  }

  if (normalized.startsWith(".")) {
    normalized = `0${normalized}`;
  }

  if (normalized.endsWith(".")) {
    normalized = normalized.slice(0, -1);
  }

  if (normalized.includes("e") || normalized.includes("E")) {
    throw new Error("APT amount must use a plain decimal string.");
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("APT amount must be a valid non-negative decimal value.");
  }

  const [wholePart, fractionalPart = ""] = normalized.split(".");
  const compactWholePart = wholePart.replace(/^0+(?=\d)/, "") || "0";
  const compactFractionalPart = fractionalPart.replace(/0+$/, "");

  if (compactFractionalPart.length > APT_DECIMALS) {
    throw new Error(`APT amount supports at most ${APT_DECIMALS} decimal places.`);
  }

  return {
    fractionalPart: compactFractionalPart,
    wholePart: compactWholePart,
  };
}

export function normalizeAptAmount(value: string | number) {
  const { wholePart, fractionalPart } = normalizeRawAptAmount(value);
  return fractionalPart ? `${wholePart}.${fractionalPart}` : wholePart;
}

export function parseAptAmountToOctas(value: string | number) {
  const { wholePart, fractionalPart } = normalizeRawAptAmount(value);
  const paddedFraction = fractionalPart.padEnd(APT_DECIMALS, "0");
  return BigInt(wholePart) * OCTAS_PER_APT + BigInt(paddedFraction || "0");
}

export function formatAptAmount(value: string | number) {
  return normalizeAptAmount(value);
}

export function formatAptAmountLabel(value: string | number) {
  return `${formatAptAmount(value)} APT`;
}
