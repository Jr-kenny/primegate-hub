export const PRIMEGATE_PUBLISHER_BILLING_MODEL = "hybrid" as const;

export type PrimeGatePublisherBillingModel = typeof PRIMEGATE_PUBLISHER_BILLING_MODEL;

export type PrimeGatePublisherBillingSummary = {
  model: PrimeGatePublisherBillingModel;
  plan: {
    name: string;
    slug: string;
    status: "active" | "pending";
  };
  period: {
    endsAt: string;
    startsAt: string;
  };
  publish: {
    includedBytes: number;
    remainingBytes: number;
    reservedBytes: number;
    usedBytes: number;
  };
  egress: {
    includedBytes: number;
    remainingBytes: number;
    usedBytes: number;
  };
  credits: {
    availableBytes: number;
    reservedBytes: number;
  };
  paymentRail: "not-configured" | "configured";
};

export type PrimeGatePublisherBillingInput = {
  creditBytesAvailable: number;
  creditBytesReserved: number;
  egressBytesIncluded: number;
  egressBytesUsed: number;
  periodEndsAt: Date;
  periodStartsAt: Date;
  planName: string;
  planSlug: string;
  planStatus: "active" | "pending";
  publishBytesIncluded: number;
  publishBytesReserved: number;
  publishBytesUsed: number;
  paymentRail: "not-configured" | "configured";
};

function clampNonNegative(value: number) {
  return Math.max(0, Number.isFinite(value) ? value : 0);
}

function toSafeNumber(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }

  return value;
}

export function buildPrimeGatePublisherBillingSummary(
  input: PrimeGatePublisherBillingInput,
): PrimeGatePublisherBillingSummary {
  const publishBytesIncluded = toSafeNumber(input.publishBytesIncluded, "Included publish bytes");
  const publishBytesUsed = toSafeNumber(input.publishBytesUsed, "Used publish bytes");
  const publishBytesReserved = toSafeNumber(input.publishBytesReserved, "Reserved publish bytes");
  const egressBytesIncluded = toSafeNumber(input.egressBytesIncluded, "Included egress bytes");
  const egressBytesUsed = toSafeNumber(input.egressBytesUsed, "Used egress bytes");
  const creditBytesAvailable = toSafeNumber(input.creditBytesAvailable, "Available credit bytes");
  const creditBytesReserved = toSafeNumber(input.creditBytesReserved, "Reserved credit bytes");

  return {
    model: PRIMEGATE_PUBLISHER_BILLING_MODEL,
    plan: {
      name: input.planName,
      slug: input.planSlug,
      status: input.planStatus,
    },
    period: {
      endsAt: input.periodEndsAt.toISOString(),
      startsAt: input.periodStartsAt.toISOString(),
    },
    publish: {
      includedBytes: publishBytesIncluded,
      remainingBytes: clampNonNegative(publishBytesIncluded - publishBytesUsed - publishBytesReserved),
      reservedBytes: publishBytesReserved,
      usedBytes: publishBytesUsed,
    },
    egress: {
      includedBytes: egressBytesIncluded,
      remainingBytes: clampNonNegative(egressBytesIncluded - egressBytesUsed),
      usedBytes: egressBytesUsed,
    },
    credits: {
      availableBytes: creditBytesAvailable,
      reservedBytes: creditBytesReserved,
    },
    paymentRail: input.paymentRail,
  };
}

export function formatPrimeGateBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
