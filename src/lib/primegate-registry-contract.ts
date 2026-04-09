export const PRIMEGATE_DEPLOYED_REGISTRY_ADDRESS =
  "0x58e10066c287737386e57de3f6fa1353d811139c36b5e7c8acaa6dd7aebbcbe6";

export function encodePrimeGatePackageId(packageId: string) {
  return Array.from(new TextEncoder().encode(packageId));
}

export function getPrimeGateRegistryFunctionId(contractAddress: string, functionName: string) {
  return `${contractAddress}::registry::${functionName}`;
}

function decodeHexBytes(value: string) {
  const normalized = value.trim().toLowerCase();
  const prefixed = normalized.startsWith("0x") ? normalized.slice(2) : normalized;

  if (!prefixed || prefixed.length % 2 !== 0 || /[^a-f0-9]/.test(prefixed)) {
    return null;
  }

  const bytes: number[] = [];
  for (let index = 0; index < prefixed.length; index += 2) {
    bytes.push(Number.parseInt(prefixed.slice(index, index + 2), 16));
  }

  return bytes;
}

export function isPrimeGatePackageIdArgument(argument: unknown, packageId: string) {
  const expected = encodePrimeGatePackageId(packageId);

  if (typeof argument === "string") {
    if (argument === packageId) {
      return true;
    }

    const decodedHexBytes = decodeHexBytes(argument);
    return (
      decodedHexBytes !== null &&
      decodedHexBytes.length === expected.length &&
      decodedHexBytes.every((value, index) => value === expected[index])
    );
  }

  if (argument instanceof Uint8Array) {
    return argument.length === expected.length && argument.every((value, index) => value === expected[index]);
  }

  if (
    argument &&
    typeof argument === "object" &&
    "vec" in argument &&
    Array.isArray((argument as { vec?: unknown }).vec)
  ) {
    return isPrimeGatePackageIdArgument((argument as { vec: unknown[] }).vec, packageId);
  }

  if (Array.isArray(argument)) {
    return (
      argument.length === expected.length &&
      argument.every((value, index) => Number(value) === expected[index])
    );
  }

  return false;
}
