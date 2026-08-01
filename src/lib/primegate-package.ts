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

  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9A-Za-z-][0-9A-Za-z-]*(?:\.(?:0|[1-9A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
      normalized,
    )
  ) {
    throw new Error("Release version must use SemVer, for example 1.4.0 or 2.0.0-beta.1.");
  }

  return normalized;
}

export const PRIMEGATE_RELEASE_CHANNELS = [
  "latest",
  "stable",
  "beta",
  "alpha",
  "next",
  "canary",
] as const;

export type PrimeGateReleaseChannel = (typeof PRIMEGATE_RELEASE_CHANNELS)[number];

export function normalizePrimeGateReleaseChannel(value: string | undefined) {
  const normalized = value?.trim().toLowerCase() || "latest";

  if (!PRIMEGATE_RELEASE_CHANNELS.includes(normalized as PrimeGateReleaseChannel)) {
    throw new Error(`Release channel must be one of: ${PRIMEGATE_RELEASE_CHANNELS.join(", ")}.`);
  }

  return normalized as PrimeGateReleaseChannel;
}

function parseSemVer(value: string) {
  const normalized = normalizePrimeGateReleaseVersion(value);
  const plusIndex = normalized.indexOf("+");
  const withoutBuild = plusIndex >= 0 ? normalized.slice(0, plusIndex) : normalized;
  const dashIndex = withoutBuild.indexOf("-");
  const coreVersion = dashIndex >= 0 ? withoutBuild.slice(0, dashIndex) : withoutBuild;
  const prerelease = dashIndex >= 0 ? withoutBuild.slice(dashIndex + 1) : "";
  const [major, minor, patch] = coreVersion.split(".").map(Number);

  return {
    major,
    minor,
    patch,
    prerelease: prerelease ? prerelease.split(".") : [],
  };
}

export function comparePrimeGateReleaseVersions(left: string, right: string) {
  const leftVersion = parseSemVer(left);
  const rightVersion = parseSemVer(right);

  for (const key of ["major", "minor", "patch"] as const) {
    if (leftVersion[key] !== rightVersion[key]) {
      return leftVersion[key] - rightVersion[key];
    }
  }

  if (leftVersion.prerelease.length === 0 && rightVersion.prerelease.length > 0) {
    return 1;
  }

  if (leftVersion.prerelease.length > 0 && rightVersion.prerelease.length === 0) {
    return -1;
  }

  for (let index = 0; index < Math.max(leftVersion.prerelease.length, rightVersion.prerelease.length); index += 1) {
    const leftPart = leftVersion.prerelease[index];
    const rightPart = rightVersion.prerelease[index];

    if (leftPart === undefined) {
      return -1;
    }

    if (rightPart === undefined) {
      return 1;
    }

    if (leftPart === rightPart) {
      continue;
    }

    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);

    if (leftNumeric && rightNumeric) {
      return Number(leftPart) - Number(rightPart);
    }

    if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    }

    return leftPart < rightPart ? -1 : 1;
  }

  return 0;
}

export function buildPrimeGatePackageHandle(ownerAddress: string, packageSlug: string) {
  return `${ownerAddress.toLowerCase()}/${packageSlug}`;
}
