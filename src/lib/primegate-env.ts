export function readPrimeGateEnvValue(value: string | undefined) {
  const trimmed = value?.trim() ?? "";

  return trimmed.replace(/\\r(?:\\n)?$/, "").trim();
}
