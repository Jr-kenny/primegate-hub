export function normalizePrimeGatePackageSlug(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  if (!normalized) {
    throw new Error("Package slug is required.");
  }

  return normalized;
}

export function normalizePrimeGateReleaseVersion(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Release version is required.");
  }

  if (!/^[0-9A-Za-z][0-9A-Za-z.+-]*$/.test(normalized)) {
    throw new Error("Release version must use letters, numbers, dots, plus, or hyphen.");
  }

  return normalized;
}

export function buildPrimeGatePackageHandle(ownerAddress: string, packageSlug: string) {
  return `${ownerAddress.toLowerCase()}/${packageSlug}`;
}
