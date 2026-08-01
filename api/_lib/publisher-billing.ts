import { randomUUID } from "node:crypto";
import { AccountAddress } from "@aptos-labs/ts-sdk";

import { AuthError } from "./auth.js";
import { getSql } from "./database.js";
import { readPrimeGateEnvValue } from "../../src/lib/primegate-env.js";
import {
  buildPrimeGatePublisherBillingSummary,
  type PrimeGatePublisherBillingSummary,
} from "../../src/lib/publisher-billing.js";

const DEFAULT_FREE_PUBLISH_BYTES = 1024 * 1024 * 1024;
const DEFAULT_FREE_EGRESS_BYTES = 5 * 1024 * 1024 * 1024;
const FREE_PLAN_NAME = "Free";
const FREE_PLAN_SLUG = "free";

type BillingRows = Record<string, unknown>[];
let billingTablesReady: Promise<void> | null = null;

function toRows(value: unknown) {
  return value as BillingRows;
}

function readByteLimit(name: string, fallback: number) {
  const rawValue = readPrimeGateEnvValue(process.env[name]);

  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer when configured.`);
  }

  return value;
}

function getBillingConfig() {
  const paymentRail = readPrimeGateEnvValue(process.env.PRIMEGATE_BILLING_PAYMENT_RAIL);

  return {
    egressBytesIncluded: readByteLimit(
      "PRIMEGATE_FREE_EGRESS_BYTES",
      DEFAULT_FREE_EGRESS_BYTES,
    ),
    paymentRail: paymentRail ? ("configured" as const) : ("not-configured" as const),
    publishBytesIncluded: readByteLimit(
      "PRIMEGATE_FREE_PUBLISH_BYTES",
      DEFAULT_FREE_PUBLISH_BYTES,
    ),
  };
}

function normalizeWalletAddress(address: string) {
  return AccountAddress.from(address).toStringLong().toLowerCase();
}

function toSafeNumber(value: unknown, label: string) {
  const numberValue = Number(value ?? 0);

  if (!Number.isSafeInteger(numberValue) || numberValue < 0) {
    throw new Error(`${label} is outside the supported range.`);
  }

  return numberValue;
}

function getBillingPeriod(now = new Date()) {
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return { endsAt, startsAt };
}

export async function ensurePublisherBillingTables(sql = getSql()) {
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (billingTablesReady) {
    return billingTablesReady;
  }

  billingTablesReady = (async () => {
    await sql`
    create table if not exists publisher_billing_accounts (
      wallet_address text primary key,
      plan_slug text not null default 'free',
      subscription_status text not null default 'inactive',
      billing_provider text,
      external_customer_id text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
    `;

    await sql`
    create table if not exists publisher_usage_ledger (
      id uuid primary key default gen_random_uuid(),
      wallet_address text not null,
      event_type text not null check (event_type in ('publish', 'egress', 'credit_grant', 'credit_debit')),
      logical_bytes bigint not null default 0,
      storage_bytes bigint not null default 0,
      egress_bytes bigint not null default 0,
      credit_bytes bigint not null default 0,
      release_id text,
      reservation_id uuid,
      idempotency_key text not null unique,
      metadata_json text not null default '{}',
      created_at timestamptz not null default now()
    )
    `;

    await sql`
    create table if not exists publisher_usage_reservations (
      id uuid primary key default gen_random_uuid(),
      intent_id uuid not null unique,
      wallet_address text not null,
      reserved_bytes bigint not null,
      reserved_credit_bytes bigint not null default 0,
      status text not null default 'pending' check (status in ('pending', 'committed', 'released', 'expired')),
      expires_at timestamptz not null,
      committed_at timestamptz,
      created_at timestamptz not null default now()
    )
    `;

    await sql`
    create index if not exists idx_publisher_usage_ledger_wallet_created
      on publisher_usage_ledger (lower(wallet_address), created_at desc)
    `;

    await sql`
    create index if not exists idx_publisher_usage_reservations_wallet_status
      on publisher_usage_reservations (lower(wallet_address), status, expires_at)
    `;
  })();

  try {
    await billingTablesReady;
  } catch (error) {
    billingTablesReady = null;
    throw error;
  }
}

async function ensureBillingAccount(walletAddress: string) {
  const sql = getSql();

  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await sql`
    insert into publisher_billing_accounts (wallet_address)
    values (${walletAddress})
    on conflict (wallet_address) do nothing
  `;
}

export async function getPublisherBillingSummary(
  walletAddress: string,
): Promise<PrimeGatePublisherBillingSummary> {
  const sql = getSql();

  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await ensurePublisherBillingTables(sql);
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress);
  await ensureBillingAccount(normalizedWalletAddress);

  const { endsAt, startsAt } = getBillingPeriod();
  const [accountRows, usageRows, reservationRows] = await Promise.all([
    sql`
      select plan_slug, subscription_status
      from publisher_billing_accounts
      where lower(wallet_address) = lower(${normalizedWalletAddress})
      limit 1
    `,
    sql`
      select
        coalesce(sum(logical_bytes) filter (
          where event_type = 'publish' and created_at >= ${startsAt}
        ), 0)::bigint as publish_bytes_used,
        coalesce(sum(egress_bytes) filter (
          where event_type = 'egress' and created_at >= ${startsAt}
        ), 0)::bigint as egress_bytes_used,
        coalesce(sum(credit_bytes) filter (
          where event_type in ('credit_grant', 'credit_debit')
        ), 0)::bigint as credit_bytes_available
      from publisher_usage_ledger
      where lower(wallet_address) = lower(${normalizedWalletAddress})
    `,
    sql`
      select
        coalesce(sum(reserved_bytes), 0)::bigint as reserved_publish_bytes,
        coalesce(sum(reserved_credit_bytes), 0)::bigint as reserved_credit_bytes
      from publisher_usage_reservations
      where lower(wallet_address) = lower(${normalizedWalletAddress})
        and status = 'pending'
        and expires_at > now()
    `,
  ]);

  const account = toRows(accountRows)[0] ?? {};
  const usage = toRows(usageRows)[0] ?? {};
  const reservations = toRows(reservationRows)[0] ?? {};
  const config = getBillingConfig();
  const creditBytesReserved = toSafeNumber(reservations.reserved_credit_bytes, "Reserved credits");
  const creditBytesBalance = Math.max(
    0,
    toSafeNumber(usage.credit_bytes_available, "Credit balance"),
  );

  return buildPrimeGatePublisherBillingSummary({
    creditBytesAvailable: Math.max(0, creditBytesBalance - creditBytesReserved),
    creditBytesReserved,
    egressBytesIncluded: config.egressBytesIncluded,
    egressBytesUsed: toSafeNumber(usage.egress_bytes_used, "Egress usage"),
    periodEndsAt: endsAt,
    periodStartsAt: startsAt,
    planName: account.plan_slug === FREE_PLAN_SLUG ? FREE_PLAN_NAME : String(account.plan_slug ?? FREE_PLAN_NAME),
    planSlug: String(account.plan_slug ?? FREE_PLAN_SLUG),
    planStatus:
      account.plan_slug === FREE_PLAN_SLUG || account.subscription_status === "active"
        ? "active"
        : "pending",
    publishBytesIncluded: config.publishBytesIncluded,
    publishBytesReserved: toSafeNumber(reservations.reserved_publish_bytes, "Reserved publish bytes"),
    publishBytesUsed: toSafeNumber(usage.publish_bytes_used, "Publish usage"),
    paymentRail: config.paymentRail,
  });
}

export async function reservePublisherPublish(input: {
  expiresAt: Date;
  intentId: string;
  sizeBytes: number;
  walletAddress: string;
}) {
  const sql = getSql();

  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await ensurePublisherBillingTables(sql);
  const normalizedWalletAddress = normalizeWalletAddress(input.walletAddress);
  const { startsAt } = getBillingPeriod();
  const config = getBillingConfig();

  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 0) {
    throw new Error("Publish size is outside the supported range.");
  }

  const transactionResults = await sql.transaction((tx) => [
    tx`
      insert into publisher_billing_accounts (wallet_address)
      values (${normalizedWalletAddress})
      on conflict (wallet_address) do nothing
    `,
    tx`
      select wallet_address
      from publisher_billing_accounts
      where lower(wallet_address) = lower(${normalizedWalletAddress})
      for update
    `,
    tx`
      with usage as (
        select
          coalesce(sum(logical_bytes) filter (
            where event_type = 'publish' and created_at >= ${startsAt}
          ), 0)::bigint as publish_bytes_used,
          coalesce(sum(credit_bytes) filter (
            where event_type in ('credit_grant', 'credit_debit')
          ), 0)::bigint as credit_bytes_available,
          coalesce((
            select sum(reserved_bytes)
            from publisher_usage_reservations
            where lower(wallet_address) = lower(${normalizedWalletAddress})
              and status = 'pending'
              and expires_at > now()
          ), 0)::bigint as reserved_publish_bytes,
          coalesce((
            select sum(reserved_credit_bytes)
            from publisher_usage_reservations
            where lower(wallet_address) = lower(${normalizedWalletAddress})
              and status = 'pending'
              and expires_at > now()
          ), 0)::bigint as reserved_credit_bytes
        from publisher_usage_ledger
        where lower(wallet_address) = lower(${normalizedWalletAddress})
      )
      insert into publisher_usage_reservations (
        intent_id,
        wallet_address,
        reserved_bytes,
        reserved_credit_bytes,
        expires_at
      )
      select
        ${input.intentId},
        ${normalizedWalletAddress},
        ${input.sizeBytes},
        greatest(
          ${input.sizeBytes} - greatest(
            ${config.publishBytesIncluded} - usage.publish_bytes_used - usage.reserved_publish_bytes,
            0
          ),
          0
        ),
        ${input.expiresAt}
      from usage
      where greatest(
        ${config.publishBytesIncluded} - usage.publish_bytes_used - usage.reserved_publish_bytes,
        0
      ) + greatest(
        usage.credit_bytes_available - usage.reserved_credit_bytes,
        0
      ) >= ${input.sizeBytes}
      on conflict (intent_id) do nothing
      returning intent_id
    `,
  ]);

  const reservationRows = toRows(transactionResults[2]);
  if (reservationRows.length === 0) {
    const summary = await getPublisherBillingSummary(normalizedWalletAddress);
    const availableBytes = summary.publish.remainingBytes + summary.credits.availableBytes;
    const paymentMessage =
      summary.paymentRail === "configured"
        ? "Add publisher credits or select a paid plan to continue."
        : "The free publisher allowance is exhausted, and paid publishing is not enabled for this deployment yet.";

    throw new AuthError(
      `This release needs ${input.sizeBytes.toLocaleString()} bytes, but only ${availableBytes.toLocaleString()} publish bytes are available. ${paymentMessage}`,
      402,
    );
  }

  return getPublisherBillingSummary(normalizedWalletAddress);
}

export async function commitPublisherPublish(input: {
  intentId: string;
  releaseId: string;
  sizeBytes: number;
  storageBytes: number;
  walletAddress: string;
}) {
  const sql = getSql();

  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await ensurePublisherBillingTables(sql);
  const normalizedWalletAddress = normalizeWalletAddress(input.walletAddress);
  const publishIdempotencyKey = `publish:${input.releaseId}`;
  const creditIdempotencyKey = `credit-debit:${input.intentId}`;

  const transactionResults = await sql.transaction((tx) => [
    tx`
      update publisher_usage_reservations
      set
        status = 'committed',
        committed_at = now()
      where intent_id = ${input.intentId}
        and lower(wallet_address) = lower(${normalizedWalletAddress})
        and status = 'pending'
        and expires_at > now()
      returning reserved_credit_bytes
    `,
    tx`
      insert into publisher_usage_ledger (
        wallet_address,
        event_type,
        logical_bytes,
        storage_bytes,
        release_id,
        reservation_id,
        idempotency_key
      )
      select
        ${normalizedWalletAddress},
        'publish',
        ${input.sizeBytes},
        ${input.storageBytes},
        ${input.releaseId},
        id,
        ${publishIdempotencyKey}
      from publisher_usage_reservations
      where intent_id = ${input.intentId}
        and lower(wallet_address) = lower(${normalizedWalletAddress})
        and status = 'committed'
      on conflict (idempotency_key) do nothing
      returning id
    `,
    tx`
      insert into publisher_usage_ledger (
        wallet_address,
        event_type,
        credit_bytes,
        reservation_id,
        idempotency_key
      )
      select
        ${normalizedWalletAddress},
        'credit_debit',
        -reserved_credit_bytes,
        id,
        ${creditIdempotencyKey}
      from publisher_usage_reservations
      where intent_id = ${input.intentId}
        and lower(wallet_address) = lower(${normalizedWalletAddress})
        and status = 'committed'
        and reserved_credit_bytes > 0
      on conflict (idempotency_key) do nothing
    `,
  ]);

  const reservationRows = toRows(transactionResults[0]);
  const ledgerRows = toRows(transactionResults[1]);

  if (reservationRows.length === 0 && ledgerRows.length === 0) {
    const existingRows = toRows(await sql`
      select 1
      from publisher_usage_ledger
      where idempotency_key = ${publishIdempotencyKey}
      limit 1
    `);

    if (existingRows.length === 0) {
      throw new AuthError("The PrimeGate publish reservation expired. Create a new publish intent and retry.", 409);
    }
  }
}

export async function recordPublisherEgress(input: {
  bytes: number;
  releaseId: string;
  walletAddress: string;
}) {
  if (!Number.isSafeInteger(input.bytes) || input.bytes <= 0) {
    return;
  }

  const sql = getSql();
  if (!sql) {
    return;
  }

  try {
    await ensurePublisherBillingTables(sql);
    await sql`
      insert into publisher_usage_ledger (
        wallet_address,
        event_type,
        egress_bytes,
        release_id,
        idempotency_key
      )
      values (
        ${normalizeWalletAddress(input.walletAddress)},
        'egress',
        ${input.bytes},
        ${input.releaseId},
        ${`egress:${input.releaseId}:${randomUUID()}`}
      )
    `;
  } catch (error) {
    console.error("PrimeGate publisher egress metering failed", error);
  }
}
