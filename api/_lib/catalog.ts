import { z } from "zod";

import { getSql } from "./database.js";
import { verifyPublishedAssetPayment } from "./payments.js";
import { getPrimeGateRegistryListing } from "./primegate-registry.js";
import type {
  RegistryPackage,
  RegistryPublisherProfile,
  RegistryPublisherSearchResult,
  RegistryReview,
  RegistryVersion,
} from "../../src/lib/registry-data.js";
import {
  getDiscoverPackages,
  getPackageById,
  getPublisherProfile as getFallbackPublisherProfile,
} from "../../src/lib/registry-data.js";
import { formatAptAmountLabel, normalizeAptAmount, parseAptAmountToOctas } from "../../src/lib/aptos-amount.js";
import {
  buildPrimeGatePackageHandle,
  comparePrimeGateReleaseVersions,
} from "../../src/lib/primegate-package.js";
import { inferPrimeGatePackageType } from "../../src/lib/primegate-package-type.js";
import type {
  PrimeGateEntitlementRecord,
  PrimeGateInstallRecord,
  PrimeGateOfferRecord,
  PrimeGatePublishedAssetRecord,
  PrimeGatePublisherSaleRecord,
  PrimeGatePurchaseRecord,
} from "../../src/lib/registry-state.js";

function toRows(value: unknown) {
  return value as Record<string, unknown>[];
}

async function ensureRegistryReviewsTable(sql: ReturnType<typeof getSql>) {
  if (!sql) {
    return;
  }

  await sql`
    create table if not exists registry_reviews (
      id uuid primary key default gen_random_uuid(),
      package_id text not null,
      wallet_address text not null,
      author text not null,
      body text not null,
      rating numeric(2,1) not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (package_id, wallet_address)
    )
  `;

  await sql`
    create index if not exists idx_registry_reviews_package_id on registry_reviews (package_id)
  `;

  await sql`
    create index if not exists idx_registry_reviews_wallet_address on registry_reviews (lower(wallet_address))
  `;
}

function toIsoTimestamp(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function formatPrice(priceCents: number) {
  return priceCents <= 0 ? "Free" : `$${(priceCents / 100).toFixed(0)}`;
}

function formatPublishedAssetPrice(price: number) {
  return price <= 0 ? "Free" : formatAptAmountLabel(price);
}

function toStoredAptAmount(value: unknown) {
  return normalizeAptAmount(typeof value === "number" ? value : String(value));
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function normalizeOfferUpdatePolicy(value: unknown): PrimeGateOfferRecord["updatePolicy"] {
  const normalized = String(value ?? "release-only");
  return normalized === "patches" || normalized === "minor" || normalized === "lifetime"
    ? normalized
    : "release-only";
}

function mapOfferRow(row: Record<string, unknown>): PrimeGateOfferRecord {
  return {
    id: row.offer_id || row.id ? String(row.offer_id ?? row.id) : null,
    slug: String(row.offer_slug ?? row.slug ?? "default"),
    name: String(row.offer_name ?? row.name ?? "Standard access"),
    description: String(row.offer_description ?? row.description ?? "Access to this release."),
    price: toStoredAptAmount(row.offer_price ?? row.price ?? 0),
    currency: "APT",
    license: String(row.offer_license ?? row.license ?? "Custom"),
    updatePolicy: normalizeOfferUpdatePolicy(row.offer_update_policy ?? row.update_policy),
    includedArtifacts: parseStringArray(row.included_artifacts_json ?? row.includedArtifacts ?? ["primary"]),
  };
}

function buildDefaultOffer(row: Record<string, unknown>): PrimeGateOfferRecord {
  const price = toStoredAptAmount(row.price ?? 0);
  const title = String(row.title ?? row.package_name ?? "PrimeGate package");
  return {
    id: null,
    slug: "default",
    name: price === "0" ? "Free access" : "Standard access",
    description: price === "0" ? `Free access to ${title}.` : `Access to ${title} ${String(row.release_version ?? row.version ?? "")} release.`,
    price,
    currency: "APT",
    license: String(row.license ?? "Custom"),
    updatePolicy: "release-only",
    includedArtifacts: ["primary"],
  };
}

function buildUsageSnippet(packageName: string) {
  return `await primegate.install("${packageName}")`;
}

function buildPublishedAssetPackageName(row: Record<string, unknown>) {
  return String(row.title);
}

function buildPublishedAssetPublisher(ownerAddress: string) {
  return ownerAddress.toLowerCase();
}

function buildPublishedAssetPackageHandle(row: Record<string, unknown>) {
  return buildPrimeGatePackageHandle(
    buildPublishedAssetPublisher(String(row.owner_address)),
    String(row.package_slug),
  );
}

function mapPublishedAssetToRegistryPackage(
  row: Record<string, unknown>,
  packageCountForOwner: number,
): RegistryPackage {
  const ownerAddress = String(row.owner_address).toLowerCase();
  const createdAt = toIsoTimestamp(row.created_at);
  const createdYear = new Date(createdAt).getUTCFullYear();
  const offer = row.offer_slug ? mapOfferRow(row) : buildDefaultOffer(row);

  return {
    id: String(row.id),
    name: buildPublishedAssetPackageName(row),
    packageHandle: buildPublishedAssetPackageHandle(row),
    packageSlug: String(row.package_slug),
    createdAt,
    description: String(row.description),
    keywords: parseStringArray(row.keywords_json),
    readmeMarkdown: String(row.readme_markdown ?? ""),
    releaseChannel: String(row.release_channel ?? "latest"),
    releaseNotes: String(row.release_notes ?? ""),
    publisher: buildPublishedAssetPublisher(ownerAddress),
    type: inferPrimeGatePackageType(String(row.original_file_name), String(row.mime_type)),
    installs: 0,
    price: offer.price === "0" ? "Free" : formatAptAmountLabel(offer.price),
    verified: false,
    agentReady: false,
    version: String(row.release_version),
    license: offer.license,
    runtime: "CLI, SDK, MCP, Web",
    chain: "Aptos",
    offer,
    releaseCount: Number(row.package_release_count ?? 1),
    publisherSummary: "Independent publisher using PrimeGate as the canonical registry layer.",
    publisherPackageCount: packageCountForOwner,
    publisherMemberSince: Number.isFinite(createdYear) ? String(createdYear) : "2026",
    usageSnippet: buildUsageSnippet(String(row.id)),
    reviews: [],
    versions: [],
  };
}

function mapPackageRow(row: Record<string, unknown>): RegistryPackage {
  return {
    id: String(row.id),
    name: String(row.name),
    createdAt: row.created_at ? toIsoTimestamp(row.created_at) : undefined,
    description: String(row.description),
    publisher: String(row.publisher),
    type: String(row.type),
    installs: Number(row.installs ?? 0),
    price: formatPrice(Number(row.price_cents ?? 0)),
    verified: Boolean(row.is_verified),
    agentReady: Boolean(row.is_agent_ready),
    version: String(row.current_version),
    license: String(row.license),
    runtime: String(row.runtime),
    chain: String(row.chain),
    publisherSummary: String(row.publisher_summary),
    publisherPackageCount: Number(row.publisher_package_count ?? 0),
    publisherMemberSince: String(row.publisher_member_since),
    usageSnippet: buildUsageSnippet(String(row.name)),
    reviews: [],
    versions: [],
  };
}

function mapPublisherSearchRow(row: Record<string, unknown>): RegistryPublisherSearchResult {
  return {
    id: String(row.id),
    memberSince: String(row.member_since),
    packageCount: Number(row.package_count ?? 0),
    summary: String(row.summary),
    verified: Boolean(row.is_verified),
  };
}

function mapVersionRow(row: Record<string, unknown>): RegistryVersion {
  const status = String(row.status);

  return {
    version: String(row.version),
    notes: String(row.notes),
    status:
      status === "latest" || status === "stable" || status === "legacy"
        ? status
        : "stable",
  };
}

function mapReviewRow(row: Record<string, unknown>): RegistryReview {
  return {
    author: String(row.author),
    body: String(row.body),
    createdAt: row.created_at ? toIsoTimestamp(row.created_at) : undefined,
    rating: String(row.rating),
    walletAddress: row.wallet_address ? String(row.wallet_address) : undefined,
  };
}

function sortRegistryPackagesAlphabetically(packages: RegistryPackage[]) {
  return [...packages].sort((left, right) => {
    const nameComparison = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    if (nameComparison !== 0) {
      return nameComparison;
    }

    return left.id.localeCompare(right.id, undefined, { sensitivity: "base" });
  });
}

function mapPublishedAssetVersionRows(rows: Record<string, unknown>[]): RegistryVersion[] {
  const sortedRows = [...rows].sort((left, right) => {
    try {
      return comparePrimeGateReleaseVersions(String(right.release_version), String(left.release_version));
    } catch {
      return toIsoTimestamp(right.created_at).localeCompare(toIsoTimestamp(left.created_at));
    }
  });

  return sortedRows.map((row, index) => ({
    id: String(row.id),
    notes: `Published ${String(row.original_file_name)} to Shelby as ${String(row.asset_blob_name)}.`,
    publishedAt: toIsoTimestamp(row.created_at),
    channel: String(row.release_channel ?? "latest"),
    status: index === 0 ? "latest" : index === 1 ? "stable" : "legacy",
    version: String(row.release_version),
  }));
}

function mapPublishedAssetRow(row: Record<string, unknown>): PrimeGatePublishedAssetRecord {
  const listingStatus = String(row.listing_status ?? "active");
  const offer = row.offer_slug ? mapOfferRow(row) : buildDefaultOffer(row);

  return {
    assetBlobName: String(row.asset_blob_name),
    assetSha256: row.asset_sha256 ? String(row.asset_sha256) : null,
    createdAt: toIsoTimestamp(row.created_at),
    description: String(row.description),
    encrypted: Boolean(row.encryption_json),
    id: String(row.id),
    keywords: parseStringArray(row.keywords_json),
    license: String(row.license ?? "Custom"),
    manifestBlobName: String(row.manifest_blob_name),
    mimeType: String(row.mime_type),
    originalFileName: String(row.original_file_name),
    ownerAddress: String(row.owner_address),
    packageHandle: buildPublishedAssetPackageHandle(row),
    packageSlug: String(row.package_slug),
    price: Number(row.price),
    readmeMarkdown: String(row.readme_markdown ?? ""),
    releaseChannel: String(row.release_channel ?? "latest"),
    releaseNotes: String(row.release_notes ?? ""),
    offer,
    listingStatus:
      listingStatus === "pending" || listingStatus === "failed" ? listingStatus : "active",
    listingError: row.listing_error ? String(row.listing_error) : null,
    sizeBytes: Number(row.size_bytes),
    title: String(row.title),
    version: String(row.release_version),
  };
}

function mapPurchaseRow(row: Record<string, unknown>): PrimeGatePurchaseRecord {
  return {
    packageId: String(row.package_id),
    packageName: String(row.package_name),
    offerId: row.offer_id ? String(row.offer_id) : null,
    offerName: String(row.offer_name ?? "Standard access"),
    offerSlug: String(row.offer_slug ?? "default"),
    offerLicense: String(row.offer_license ?? "Custom"),
    offerUpdatePolicy: normalizeOfferUpdatePolicy(row.offer_update_policy),
    paymentAmountOctas: row.payment_amount_octas ? String(row.payment_amount_octas) : null,
    paymentRecipient: row.payment_recipient ? String(row.payment_recipient) : null,
    paymentTxHash: row.payment_tx_hash ? String(row.payment_tx_hash) : null,
    price: String(row.price),
    purchasedAt: toIsoTimestamp(row.purchased_at),
    publisher: String(row.publisher),
    version: String(row.version),
    walletAddress: String(row.wallet_address),
  };
}

function mapPublisherSaleRow(row: Record<string, unknown>): PrimeGatePublisherSaleRecord {
  return {
    buyerWalletAddress: String(row.wallet_address),
    packageId: String(row.package_id),
    packageName: String(row.package_name),
    offerId: row.offer_id ? String(row.offer_id) : null,
    offerName: String(row.offer_name ?? "Standard access"),
    offerSlug: String(row.offer_slug ?? "default"),
    offerLicense: String(row.offer_license ?? "Custom"),
    offerUpdatePolicy: normalizeOfferUpdatePolicy(row.offer_update_policy),
    paymentAmountOctas: row.payment_amount_octas ? String(row.payment_amount_octas) : null,
    paymentRecipient: row.payment_recipient ? String(row.payment_recipient) : null,
    paymentTxHash: row.payment_tx_hash ? String(row.payment_tx_hash) : null,
    price: String(row.price),
    purchasedAt: toIsoTimestamp(row.purchased_at),
    publisher: String(row.publisher),
    version: String(row.version),
  };
}

function mapInstallRow(row: Record<string, unknown>): PrimeGateInstallRecord {
  return {
    installedAt: toIsoTimestamp(row.installed_at),
    packageId: String(row.package_id),
    packageName: String(row.package_name),
    version: String(row.version),
    walletAddress: String(row.wallet_address),
  };
}

export async function listPackages() {
  const sql = getSql();

  if (!sql) {
    return getDiscoverPackages();
  }

  const rows = toRows(await sql`
    select
      p.id,
      p.name,
      p.description,
      p.type,
      p.installs,
      p.price_cents,
      p.is_verified,
      p.is_agent_ready,
      p.current_version,
      p.license,
      p.runtime,
      p.chain,
      p.created_at,
      pub.slug as publisher,
      pub.summary as publisher_summary,
      to_char(pub.member_since, 'YYYY') as publisher_member_since,
      (
        select count(*)::int
        from packages publisher_packages
        where publisher_packages.publisher_id = pub.id
      ) as publisher_package_count
    from packages p
    join publishers pub on pub.id = p.publisher_id
    order by p.installs desc, p.name asc
  `);

  const publishedAssetRows = toRows(await sql`
    select distinct on (lower(owner_address), package_slug)
      id,
      asset_blob_name,
      asset_sha256,
      created_at,
      description,
      encryption_json,
      keywords_json,
      license,
      manifest_blob_name,
      mime_type,
      original_file_name,
      owner_address,
      package_slug,
      price,
      readme_markdown,
      listing_error,
      listing_status,
      release_channel,
      release_notes,
      release_version,
      size_bytes,
      title,
      (
        select count(distinct owner_assets.package_slug)::int
        from published_assets owner_assets
        where lower(owner_assets.owner_address) = lower(published_assets.owner_address)
          and owner_assets.encryption_json is not null
          and owner_assets.content_key_envelope is not null
      ) as owner_asset_count,
      (
        select count(*)::int
        from published_assets release_assets
        where lower(release_assets.owner_address) = lower(published_assets.owner_address)
          and release_assets.package_slug = published_assets.package_slug
          and release_assets.encryption_json is not null
          and release_assets.content_key_envelope is not null
      ) as package_release_count
    from published_assets
    where encryption_json is not null
      and content_key_envelope is not null
    order by lower(owner_address), package_slug, created_at desc, id desc
  `);

  if (rows.length === 0 && publishedAssetRows.length === 0) {
    return getDiscoverPackages();
  }

  const mergedPackages = new Map<string, RegistryPackage>();

  for (const row of rows) {
    const pkg = mapPackageRow(row);
    mergedPackages.set(pkg.id, pkg);
  }

  for (const row of publishedAssetRows) {
    const pkg = mapPublishedAssetToRegistryPackage(row, Number(row.owner_asset_count ?? 1));
    mergedPackages.set(pkg.id, pkg);
  }

  return Array.from(mergedPackages.values());
}

export async function getPackage(id: string) {
  const sql = getSql();

  if (!sql) {
    return getPackageById(id);
  }

  const packageRows = toRows(await sql`
    select
      p.id,
      p.name,
      p.description,
      p.type,
      p.installs,
      p.price_cents,
      p.is_verified,
      p.is_agent_ready,
      p.current_version,
      p.license,
      p.runtime,
      p.chain,
      pub.slug as publisher,
      pub.summary as publisher_summary,
      to_char(pub.member_since, 'YYYY') as publisher_member_since,
      (
        select count(*)::int
        from packages publisher_packages
        where publisher_packages.publisher_id = pub.id
      ) as publisher_package_count
    from packages p
    join publishers pub on pub.id = p.publisher_id
    where p.id = ${id}
    limit 1
  `);

  if (packageRows.length === 0) {
    const publishedAssetRows = toRows(await sql`
      select
        id,
        asset_blob_name,
        asset_sha256,
        created_at,
        description,
        keywords_json,
        license,
        manifest_blob_name,
        mime_type,
        original_file_name,
        owner_address,
        package_slug,
        price,
        readme_markdown,
        release_channel,
        release_notes,
        release_version,
        size_bytes,
        title,
        (
          select count(distinct owner_assets.package_slug)::int
          from published_assets owner_assets
          where lower(owner_assets.owner_address) = lower(published_assets.owner_address)
        ) as owner_asset_count,
        (
          select count(*)::int
          from published_assets release_assets
          where lower(release_assets.owner_address) = lower(published_assets.owner_address)
            and release_assets.package_slug = published_assets.package_slug
        ) as package_release_count
      from published_assets
      where id = ${id}
      limit 1
    `);

    if (publishedAssetRows.length > 0) {
      const [publishedAssetRow] = publishedAssetRows;
      const [versionRows, reviewRows] = await Promise.all([
        sql`
          select
            id,
            asset_blob_name,
            created_at,
            original_file_name,
            release_channel,
            release_version
          from published_assets
          where lower(owner_address) = lower(${publishedAssetRow.owner_address})
            and package_slug = ${publishedAssetRow.package_slug}
          order by created_at desc, id desc
        `,
        sql`
          select
            author,
            body,
            rating,
            wallet_address,
            created_at
          from registry_reviews
          where package_id = ${id}
          order by created_at desc
        `,
      ]);

      return {
        ...mapPublishedAssetToRegistryPackage(
          publishedAssetRow,
          Number(publishedAssetRow.owner_asset_count ?? 1),
        ),
        reviews: toRows(reviewRows).map((row) => mapReviewRow(row)),
        versions: mapPublishedAssetVersionRows(toRows(versionRows)),
      } satisfies RegistryPackage;
    }

    return getPackageById(id);
  }

  const [packageRow] = packageRows;
  const [versionRowsResult, reviewRowsResult] = await Promise.all([
    sql`
      select version, notes, status
      from package_versions
      where package_id = ${id}
      order by created_at desc
    `,
    sql`
      select author, body, rating, wallet_address, created_at
      from (
        select
          author,
          body,
          rating,
          null::text as wallet_address,
          created_at
        from package_reviews
        where package_id = ${id}
        union all
        select
          author,
          body,
          rating,
          wallet_address,
          created_at
        from registry_reviews
        where package_id = ${id}
      ) reviews
      order by created_at desc
    `,
  ]);

  const pkg = mapPackageRow(packageRow);

  return {
    ...pkg,
    reviews: toRows(reviewRowsResult).map((row) => mapReviewRow(row)),
    versions: toRows(versionRowsResult).map((row) => mapVersionRow(row)),
  } satisfies RegistryPackage;
}

export async function getPublisherProfile(id: string) {
  const sql = getSql();

  if (!sql) {
    return getFallbackPublisherProfile(id);
  }

  const publisherRows = toRows(await sql`
    select
      pub.slug,
      pub.summary,
      pub.is_verified,
      to_char(pub.member_since, 'YYYY') as member_since,
      (
        select count(*)::int
        from packages p
        where p.publisher_id = pub.id
      ) as package_count
    from publishers pub
    where pub.slug = ${id}
    limit 1
  `);

  if (publisherRows.length === 0) {
    const publishedAssetRows = toRows(await sql`
      select distinct on (package_slug)
        id,
        title,
        original_file_name,
        mime_type,
        owner_address,
        created_at,
        package_slug,
        release_version
      from published_assets
      where lower(owner_address) = lower(${id})
        and encryption_json is not null
        and content_key_envelope is not null
      order by package_slug, created_at desc, id desc
    `);

    if (publishedAssetRows.length === 0) {
      return getFallbackPublisherProfile(id);
    }

    const latestCreatedAt = toIsoTimestamp(publishedAssetRows[0].created_at);
    const latestCreatedYear = new Date(latestCreatedAt).getUTCFullYear();

    return {
      id: String(id).toLowerCase(),
      packageCount: publishedAssetRows.length,
      memberSince: Number.isFinite(latestCreatedYear) ? String(latestCreatedYear) : "2026",
      summary: "Independent publisher using PrimeGate as the canonical registry layer.",
      verified: false,
      packages: publishedAssetRows.map((row) => ({
        id: String(row.id),
        name: buildPublishedAssetPackageName(row),
        subtitle: `${inferPrimeGatePackageType(String(row.original_file_name), String(row.mime_type))} · v${String(row.release_version)}`,
        installs: "0",
      })),
    } satisfies RegistryPublisherProfile;
  }

  const packageRows = toRows(await sql`
    select
      p.id,
      p.name,
      p.type,
      p.current_version,
      p.installs
    from packages p
    join publishers pub on pub.id = p.publisher_id
    where pub.slug = ${id}
    order by p.installs desc, p.name asc
  `);

  const [publisherRow] = publisherRows;

  return {
    id: String(publisherRow.slug),
    packageCount: Number(publisherRow.package_count ?? 0),
    memberSince: String(publisherRow.member_since),
    summary: String(publisherRow.summary),
    verified: Boolean(publisherRow.is_verified),
    packages: packageRows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      subtitle: `${String(row.type)} · v${String(row.current_version)}`,
      installs: Number(row.installs ?? 0).toLocaleString(),
    })),
  } satisfies RegistryPublisherProfile;
}

export async function listPublishedAssets(ownerAddress: string) {
  const sql = getSql();

  if (!sql) {
    return [];
  }

  const rows = toRows(await sql`
    select
      id,
      asset_blob_name,
      asset_sha256,
      created_at,
      description,
      encryption_json,
      keywords_json,
      license,
      manifest_blob_name,
      mime_type,
      original_file_name,
      owner_address,
      package_slug,
      price,
      readme_markdown,
      listing_error,
      listing_status,
      release_channel,
      release_notes,
      release_version,
      size_bytes,
      title
    from published_assets
    where lower(owner_address) = lower(${ownerAddress})
    order by created_at desc
  `);

  return rows.map((row) => mapPublishedAssetRow(row));
}

export async function getPublishedAssetById(id: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  const rows = toRows(await sql`
    select
      id,
      asset_blob_name,
      asset_sha256,
      created_at,
      description,
      encryption_json,
      keywords_json,
      license,
      manifest_blob_name,
      mime_type,
      original_file_name,
      owner_address,
      package_slug,
      price,
      readme_markdown,
      listing_error,
      listing_status,
      release_channel,
      release_notes,
      release_version,
      size_bytes,
      title
    from published_assets
    where id = ${id}
    limit 1
  `);

  if (rows.length === 0) {
    return null;
  }

  return mapPublishedAssetRow(rows[0]);
}

export type PrimeGatePublishedAssetAccess = {
  contentKeyEnvelope: string | null;
  ciphertextSizeBytes: number | null;
  encryptionJson: string | null;
  manifestCiphertextSizeBytes: number | null;
};

export async function getPublishedAssetAccess(id: string): Promise<PrimeGatePublishedAssetAccess | null> {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  const rows = toRows(await sql`
    select
      content_key_envelope,
      ciphertext_size_bytes,
      encryption_json,
      manifest_ciphertext_size_bytes
    from published_assets
    where id = ${id}
    limit 1
  `);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    contentKeyEnvelope: row.content_key_envelope ? String(row.content_key_envelope) : null,
    ciphertextSizeBytes: row.ciphertext_size_bytes == null ? null : Number(row.ciphertext_size_bytes),
    encryptionJson: row.encryption_json ? String(row.encryption_json) : null,
    manifestCiphertextSizeBytes:
      row.manifest_ciphertext_size_bytes == null ? null : Number(row.manifest_ciphertext_size_bytes),
  };
}

export async function getPublishedAssetOffer(packageId: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  const rows = toRows(await sql`
    select
      id,
      published_asset_id,
      slug,
      name,
      description,
      price,
      currency,
      license,
      update_policy,
      included_artifacts_json
    from published_offers
    where published_asset_id = ${packageId}
    order by created_at asc, id asc
    limit 1
  `);

  if (rows.length > 0) {
    return mapOfferRow(rows[0]);
  }

  const publishedAsset = await getPublishedAssetById(packageId);
  return publishedAsset?.offer ?? null;
}

export async function syncPublishedAssetListing(ownerAddress: string, packageId: string) {
  const sql = getSql();

  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const publishedAsset = await getPublishedAssetById(packageId);
  if (!publishedAsset) {
    throw new Error("Published asset could not be found.");
  }

  if (publishedAsset.ownerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error("Published asset does not belong to the connected publisher.");
  }

  let listingStatus: "active" | "failed" | "pending" = "active";
  let listingError: string | null = null;

  if (publishedAsset.price > 0) {
    const listing = await getPrimeGateRegistryListing(packageId);
    const expectedPriceOctas = parseAptAmountToOctas(toStoredAptAmount(publishedAsset.price)).toString();

    if (!listing) {
      listingStatus = "pending";
    } else if (
      listing.sellerAddress !== publishedAsset.ownerAddress.toLowerCase() ||
      listing.priceOctas.toString() !== expectedPriceOctas
    ) {
      listingStatus = "failed";
      listingError = "The on-chain listing does not match this release owner and price.";
    }
  }

  await sql`
    update published_assets
    set listing_status = ${listingStatus},
        listing_error = ${listingError},
        listing_updated_at = now()
    where id = ${packageId}
      and lower(owner_address) = lower(${ownerAddress})
  `;

  const syncedAsset = await getPublishedAssetById(packageId);
  if (!syncedAsset) {
    throw new Error("Published asset could not be loaded after listing status update.");
  }

  return syncedAsset;
}

export async function getCatalogPurchaseTarget(packageId: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  const packageRows = toRows(await sql`
    select
      p.id,
      p.name,
      pub.slug as publisher,
      p.current_version,
      p.price_cents
    from packages p
    join publishers pub on pub.id = p.publisher_id
    where p.id = ${packageId}
    limit 1
  `);

  if (packageRows.length > 0) {
    const row = packageRows[0];
    return {
      kind: "seeded-package" as const,
      packageId: String(row.id),
      packageName: String(row.name),
      price: formatPrice(Number(row.price_cents ?? 0)),
      publisher: String(row.publisher),
      version: String(row.current_version),
    };
  }

  const publishedAssetRows = toRows(await sql`
    select id, owner_address, price, release_version, title, license
    from published_assets
    where id = ${packageId}
    limit 1
  `);

  if (publishedAssetRows.length === 0) {
    return null;
  }

  const publishedAsset = publishedAssetRows[0];
  const offer = (await getPublishedAssetOffer(packageId)) ?? buildDefaultOffer(publishedAsset);
  const amountApt = toStoredAptAmount(offer.price);

  return {
    kind: "published-asset" as const,
    packageId: String(publishedAsset.id),
    packageName: String(publishedAsset.title),
    offer,
    price: amountApt === "0" ? "Free" : formatAptAmountLabel(amountApt),
    payment: {
      amountApt,
      amountOctas: parseAptAmountToOctas(amountApt).toString(),
      recipientAddress: buildPublishedAssetPublisher(String(publishedAsset.owner_address)),
    },
    publisher: buildPublishedAssetPublisher(String(publishedAsset.owner_address)),
    version: String(publishedAsset.release_version),
  };
}

export async function searchCatalogPackages(query: string) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const sql = getSql();
  if (!sql) {
    const lowerQuery = trimmedQuery.toLowerCase();
    return sortRegistryPackagesAlphabetically(
      getDiscoverPackages().filter((pkg) => {
        return (
          pkg.id.toLowerCase().includes(lowerQuery) ||
          pkg.name.toLowerCase().includes(lowerQuery) ||
          (pkg.packageHandle?.toLowerCase().includes(lowerQuery) ?? false) ||
          (pkg.packageSlug?.toLowerCase().includes(lowerQuery) ?? false) ||
          pkg.description.toLowerCase().includes(lowerQuery) ||
          pkg.publisher.toLowerCase().includes(lowerQuery) ||
          pkg.type.toLowerCase().includes(lowerQuery)
        );
      }),
    );
  }

  const packageRows = toRows(await sql`
    select
      p.id,
      p.name,
      p.description,
      p.type,
      p.installs,
      p.price_cents,
      p.is_verified,
      p.is_agent_ready,
      p.current_version,
      p.license,
      p.runtime,
      p.chain,
      pub.slug as publisher,
      pub.summary as publisher_summary,
      to_char(pub.member_since, 'YYYY') as publisher_member_since,
      (
        select count(*)::int
        from packages publisher_packages
        where publisher_packages.publisher_id = pub.id
      ) as publisher_package_count
    from packages p
    join publishers pub on pub.id = p.publisher_id
    where
      p.id ilike ${`%${trimmedQuery}%`}
      or p.name ilike ${`%${trimmedQuery}%`}
      or p.description ilike ${`%${trimmedQuery}%`}
      or p.type ilike ${`%${trimmedQuery}%`}
      or pub.slug ilike ${`%${trimmedQuery}%`}
    order by lower(p.name) asc, lower(p.id) asc
    limit 12
  `);

  const publishedAssetRows = toRows(await sql`
    select distinct on (lower(owner_address), package_slug)
      id,
      asset_blob_name,
      asset_sha256,
      created_at,
      description,
      keywords_json,
      license,
      manifest_blob_name,
      mime_type,
      original_file_name,
      owner_address,
      package_slug,
      price,
      readme_markdown,
      listing_error,
      listing_status,
      release_channel,
      release_notes,
      release_version,
      size_bytes,
      title,
      (
        select count(distinct owner_assets.package_slug)::int
        from published_assets owner_assets
        where lower(owner_assets.owner_address) = lower(published_assets.owner_address)
          and owner_assets.encryption_json is not null
          and owner_assets.content_key_envelope is not null
      ) as owner_asset_count,
      (
        select count(*)::int
        from published_assets release_assets
        where lower(release_assets.owner_address) = lower(published_assets.owner_address)
          and release_assets.package_slug = published_assets.package_slug
          and release_assets.encryption_json is not null
          and release_assets.content_key_envelope is not null
      ) as package_release_count
    from published_assets
    where
      encryption_json is not null
      and content_key_envelope is not null
      and (
        id ilike ${`%${trimmedQuery}%`}
        or title ilike ${`%${trimmedQuery}%`}
        or description ilike ${`%${trimmedQuery}%`}
        or original_file_name ilike ${`%${trimmedQuery}%`}
        or owner_address ilike ${`%${trimmedQuery}%`}
        or package_slug ilike ${`%${trimmedQuery}%`}
        or concat(lower(owner_address), '/', package_slug) ilike lower(${`%${trimmedQuery}%`})
      )
    order by lower(owner_address), package_slug, created_at desc, id desc
    limit 24
  `);

  const mergedPackages = new Map<string, RegistryPackage>();

  for (const row of packageRows) {
    const pkg = mapPackageRow(row);
    mergedPackages.set(pkg.id, pkg);
  }

  for (const row of publishedAssetRows) {
    const pkg = mapPublishedAssetToRegistryPackage(row, Number(row.owner_asset_count ?? 1));
    mergedPackages.set(pkg.id, pkg);
  }

  return sortRegistryPackagesAlphabetically(Array.from(mergedPackages.values()));
}

export async function searchCatalogPublishers(query: string) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const sql = getSql();
  if (!sql) {
    const lowerQuery = trimmedQuery.toLowerCase();
    const seen = new Set<string>();

    return getDiscoverPackages()
      .filter((pkg) => {
        return (
          pkg.publisher.toLowerCase().includes(lowerQuery) ||
          pkg.publisherSummary.toLowerCase().includes(lowerQuery)
        );
      })
      .map((pkg) => pkg.publisher)
      .filter((publisherId) => {
        if (seen.has(publisherId)) {
          return false;
        }

        seen.add(publisherId);
        return true;
      })
      .map((publisherId) => {
        const profile = getFallbackPublisherProfile(publisherId);
        return {
          id: profile.id,
          memberSince: profile.memberSince,
          packageCount: profile.packageCount,
          summary: profile.summary,
          verified: profile.verified,
        } satisfies RegistryPublisherSearchResult;
      });
  }

  const publisherRows = toRows(await sql`
    select
      pub.slug as id,
      pub.summary,
      pub.is_verified,
      to_char(pub.member_since, 'YYYY') as member_since,
      (
        select count(*)::int
        from packages p
        where p.publisher_id = pub.id
      ) as package_count
    from publishers pub
    where
      pub.slug ilike ${`%${trimmedQuery}%`}
      or pub.summary ilike ${`%${trimmedQuery}%`}
    order by package_count desc, pub.slug asc
    limit 12
  `);

  const publishedAssetPublisherRows = toRows(await sql`
    select
      lower(owner_address) as id,
      'Independent publisher using PrimeGate as the canonical registry layer.'::text as summary,
      false as is_verified,
      to_char(min(created_at), 'YYYY') as member_since,
      count(distinct package_slug)::int as package_count
    from published_assets
    where
      encryption_json is not null
      and content_key_envelope is not null
      and (
        lower(owner_address) ilike lower(${`%${trimmedQuery}%`})
        or package_slug ilike ${`%${trimmedQuery}%`}
        or title ilike ${`%${trimmedQuery}%`}
      )
    group by lower(owner_address)
    order by package_count desc, lower(owner_address) asc
    limit 12
  `);

  const mergedPublishers = new Map<string, RegistryPublisherSearchResult>();

  for (const row of publisherRows) {
    const publisher = mapPublisherSearchRow(row);
    mergedPublishers.set(publisher.id, publisher);
  }

  for (const row of publishedAssetPublisherRows) {
    const publisher = mapPublisherSearchRow(row);
    if (!mergedPublishers.has(publisher.id)) {
      mergedPublishers.set(publisher.id, publisher);
    }
  }

  return Array.from(mergedPublishers.values());
}

export async function listPurchases(walletAddress: string) {
  const sql = getSql();

  if (!sql) {
    return [];
  }

  const rows = toRows(await sql`
    select
      package_id,
      package_name,
      offer_id,
      offer_name,
      offer_slug,
      offer_license,
      offer_update_policy,
      payment_amount_octas,
      payment_recipient,
      payment_tx_hash,
      price,
      purchased_at,
      publisher,
      version,
      wallet_address
    from purchases
    where lower(wallet_address) = lower(${walletAddress})
    order by purchased_at desc
  `);

  return rows.map((row) => mapPurchaseRow(row));
}

export async function listPublisherSales(ownerAddress: string) {
  const sql = getSql();

  if (!sql) {
    return [];
  }

  const rows = toRows(await sql`
    select
      wallet_address,
      package_id,
      package_name,
      offer_id,
      offer_name,
      offer_slug,
      offer_license,
      offer_update_policy,
      payment_amount_octas,
      payment_recipient,
      payment_tx_hash,
      price,
      purchased_at,
      publisher,
      version
    from purchases
    where lower(publisher) = lower(${ownerAddress})
    order by purchased_at desc
  `);

  return rows.map((row) => mapPublisherSaleRow(row));
}

export async function listInstalls(walletAddress: string) {
  const sql = getSql();

  if (!sql) {
    return [];
  }

  const rows = toRows(await sql`
    select
      installed_at,
      package_id,
      package_name,
      version,
      wallet_address
    from installs
    where lower(wallet_address) = lower(${walletAddress})
    order by installed_at desc
  `);

  return rows.map((row) => mapInstallRow(row));
}

export async function listEntitlements(walletAddress: string) {
  const sql = getSql();

  if (!sql) {
    return [];
  }

  const rows = toRows(await sql`
    select
      p.id as package_id,
      p.name as package_name,
      null::uuid as offer_id,
      'Free access'::text as offer_name,
      'default'::text as offer_slug,
      p.license as offer_license,
      'release-only'::text as offer_update_policy,
      ${walletAddress}::text as wallet_address,
      now()::text as granted_at,
      'free'::text as source
    from packages p
    where p.price_cents = 0
    union all
    select
      purchases.package_id,
      purchases.package_name,
      purchases.offer_id,
      purchases.offer_name,
      purchases.offer_slug,
      purchases.offer_license,
      purchases.offer_update_policy,
      purchases.wallet_address,
      purchases.purchased_at::text as granted_at,
      'purchase'::text as source
    from purchases
    where lower(purchases.wallet_address) = lower(${walletAddress})
  `);

  const mergedEntitlements = new Map<string, PrimeGateEntitlementRecord>();

  for (const row of rows) {
    const entitlement: PrimeGateEntitlementRecord = {
      grantedAt: String(row.granted_at),
      packageId: String(row.package_id),
      packageName: String(row.package_name),
      offerId: row.offer_id ? String(row.offer_id) : null,
      offerName: String(row.offer_name ?? "Standard access"),
      offerSlug: String(row.offer_slug ?? "default"),
      offerLicense: String(row.offer_license ?? "Custom"),
      offerUpdatePolicy: normalizeOfferUpdatePolicy(row.offer_update_policy),
      source: String(row.source) === "purchase" ? "purchase" : "free",
      walletAddress: String(row.wallet_address),
    };

    const existing = mergedEntitlements.get(entitlement.packageId);
    if (!existing || existing.source === "free") {
      mergedEntitlements.set(entitlement.packageId, entitlement);
    }
  }

  return Array.from(mergedEntitlements.values()).sort((left, right) =>
    right.grantedAt.localeCompare(left.grantedAt),
  );
}

const publishedAssetSchema = z.object({
  assetBlobName: z.string().min(1),
  assetSha256: z.string().regex(/^0x[a-f0-9]{64}$/),
  ciphertextSizeBytes: z.number().int().positive(),
  contentKeyEnvelope: z.string().min(1),
  createdAt: z.string().min(1),
  description: z.string().min(1),
  id: z.string().min(1),
  keywords: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
  license: z.string().trim().min(1).max(128).default("Custom"),
  manifestBlobName: z.string().min(1),
  encryptionJson: z.string().min(1),
  manifestCiphertextSizeBytes: z.number().int().positive(),
  mimeType: z.string().min(1),
  originalFileName: z.string().min(1),
  ownerAddress: z.string().min(1),
  packageSlug: z.string().min(1),
  priceApt: z.string().min(1),
  readmeMarkdown: z.string().max(50_000).default(""),
  releaseChannel: z.string().min(1).default("latest"),
  releaseNotes: z.string().max(10_000).default(""),
  releaseVersion: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  title: z.string().min(1),
});

const purchaseSchema = z.object({
  packageId: z.string().min(1),
  paymentTxHash: z.string().min(1).optional(),
  walletAddress: z.string().min(1),
});

const installSchema = z.object({
  installedAt: z.string().min(1),
  packageId: z.string().min(1),
  packageName: z.string().min(1),
  version: z.string().min(1),
  walletAddress: z.string().min(1),
});

const reviewSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  packageId: z.string().min(1),
  rating: z.union([z.string(), z.number()]),
  walletAddress: z.string().min(1),
});

async function ensureDefaultPublishedOffer(
  sql: NonNullable<ReturnType<typeof getSql>>,
  asset: {
    description?: string;
    id?: string;
    license?: string;
    priceApt?: string;
    releaseVersion?: string;
    title?: string;
  },
) {
  await sql`
    insert into published_offers (
      published_asset_id,
      slug,
      name,
      description,
      price,
      currency,
      license,
      update_policy,
      included_artifacts_json
    )
    values (
      ${String(asset.id)},
      'default',
      ${normalizeAptAmount(String(asset.priceApt ?? "0")) === "0" ? "Free access" : "Standard access"},
      ${asset.description || `Access to ${asset.title ?? "this package"} ${asset.releaseVersion ?? ""} release.`},
      ${normalizeAptAmount(String(asset.priceApt ?? "0"))},
      'APT',
      ${asset.license ?? "Custom"},
      'release-only',
      '["primary"]'
    )
    on conflict (published_asset_id, slug) do nothing
  `;
}

export async function savePublishedAsset(input: unknown) {
  const sql = getSql();

  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const asset = publishedAssetSchema.parse(input);
  const existingRows = toRows(await sql`
    select
      id,
      asset_blob_name,
      asset_sha256,
      content_key_envelope,
      ciphertext_size_bytes,
      encryption_json,
      owner_address,
      package_slug,
      release_version,
      manifest_ciphertext_size_bytes,
      size_bytes
    from published_assets
    where id = ${asset.id}
    limit 1
  `);

  if (existingRows.length > 0) {
    const existing = existingRows[0];
    if (
      String(existing.owner_address).toLowerCase() !== asset.ownerAddress.toLowerCase() ||
      String(existing.asset_blob_name) !== asset.assetBlobName ||
      String(existing.asset_sha256 ?? "") !== asset.assetSha256 ||
      Number(existing.ciphertext_size_bytes) !== asset.ciphertextSizeBytes ||
      String(existing.encryption_json ?? "") !== asset.encryptionJson ||
      String(existing.package_slug) !== asset.packageSlug ||
      String(existing.release_version) !== asset.releaseVersion ||
      Number(existing.manifest_ciphertext_size_bytes) !== asset.manifestCiphertextSizeBytes ||
      Number(existing.size_bytes) !== asset.sizeBytes
    ) {
      throw new Error("This release ID is immutable and cannot be reused for different package bytes.");
    }

    await ensureDefaultPublishedOffer(sql, asset);
    const existingAsset = await getPublishedAssetById(asset.id);
    if (!existingAsset) {
      throw new Error("The existing PrimeGate release could not be loaded.");
    }

    return existingAsset;
  }

  const conflictingRows = toRows(await sql`
    select id
    from published_assets
    where lower(owner_address) = lower(${asset.ownerAddress})
      and package_slug = ${asset.packageSlug}
      and release_version = ${asset.releaseVersion}
      and id <> ${asset.id}
    limit 1
  `);

  if (conflictingRows.length > 0) {
    throw new Error("This package slug and release version already exist for the connected publisher.");
  }

  const rows = toRows(await sql`
    insert into published_assets (
      id,
      owner_address,
      package_slug,
      release_version,
      title,
      description,
      license,
      keywords_json,
      readme_markdown,
      release_notes,
      release_channel,
      price,
      asset_blob_name,
      manifest_blob_name,
      mime_type,
      original_file_name,
      size_bytes,
      asset_sha256,
      content_key_envelope,
      ciphertext_size_bytes,
      encryption_json,
      listing_status,
      manifest_ciphertext_size_bytes,
      listing_error,
      listing_updated_at,
      created_at
    )
    values (
      ${asset.id},
      ${asset.ownerAddress},
      ${asset.packageSlug},
      ${asset.releaseVersion},
      ${asset.title},
      ${asset.description},
      ${asset.license},
      ${JSON.stringify(asset.keywords)},
      ${asset.readmeMarkdown},
      ${asset.releaseNotes},
      ${asset.releaseChannel},
      ${normalizeAptAmount(asset.priceApt)},
      ${asset.assetBlobName},
      ${asset.manifestBlobName},
      ${asset.mimeType},
      ${asset.originalFileName},
      ${asset.sizeBytes},
      ${asset.assetSha256},
      ${asset.contentKeyEnvelope},
      ${asset.ciphertextSizeBytes},
      ${asset.encryptionJson},
      ${normalizeAptAmount(asset.priceApt) === "0" ? "active" : "pending"},
      ${asset.manifestCiphertextSizeBytes},
      null,
      now(),
      ${asset.createdAt}
    )
    on conflict (id) do nothing
    returning
      id,
      asset_blob_name,
      created_at,
      description,
      keywords_json,
      license,
      manifest_blob_name,
      mime_type,
      original_file_name,
      owner_address,
      package_slug,
      price,
      readme_markdown,
      asset_sha256,
      encryption_json,
      listing_error,
      listing_status,
      release_channel,
      release_notes,
      release_version,
      size_bytes,
      title
  `);

  if (rows.length === 0) {
    const insertedAsset = await getPublishedAssetById(asset.id);
    if (!insertedAsset) {
      throw new Error("PrimeGate could not load the immutable release after publishing.");
    }

    return insertedAsset;
  }

  await ensureDefaultPublishedOffer(sql, asset);
  return mapPublishedAssetRow(rows[0]);
}

export async function savePurchase(input: unknown) {
  const sql = getSql();

  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const purchase = purchaseSchema.parse(input);
  const purchaseTarget = await getCatalogPurchaseTarget(purchase.packageId);

  if (!purchaseTarget) {
    throw new Error("Package could not be found in the PrimeGate catalog.");
  }

  if (purchaseTarget.kind !== "published-asset") {
    throw new Error("On-chain APT checkout is only supported for PrimeGate-published artifacts right now.");
  }

  if (!purchaseTarget.payment || purchaseTarget.payment.amountOctas === "0") {
    throw new Error("This PrimeGate artifact does not require a purchase.");
  }

  if (!purchase.paymentTxHash) {
    throw new Error("Payment transaction hash is required for paid PrimeGate artifacts.");
  }

  const verifiedPayment = await verifyPublishedAssetPayment({
    amountOctas: purchaseTarget.payment.amountOctas,
    packageId: purchase.packageId,
    recipientAddress: purchaseTarget.payment.recipientAddress,
    transactionHash: purchase.paymentTxHash,
    walletAddress: purchase.walletAddress,
  });

  const rows = toRows(await sql`
    insert into purchases (
      wallet_address,
      package_id,
      offer_id,
      offer_slug,
      offer_name,
      offer_license,
      offer_update_policy,
      package_name,
      payment_amount_octas,
      payment_recipient,
      payment_tx_hash,
      publisher,
      version,
      price,
      purchased_at
    )
    values (
      ${purchase.walletAddress},
      ${purchaseTarget.packageId},
      ${purchaseTarget.offer.id},
      ${purchaseTarget.offer.slug},
      ${purchaseTarget.offer.name},
      ${purchaseTarget.offer.license},
      ${purchaseTarget.offer.updatePolicy},
      ${purchaseTarget.packageName},
      ${verifiedPayment.amountOctas},
      ${verifiedPayment.recipientAddress},
      ${verifiedPayment.transactionHash},
      ${purchaseTarget.publisher},
      ${purchaseTarget.version},
      ${purchaseTarget.price},
      ${verifiedPayment.purchasedAt}
    )
    on conflict (wallet_address, package_id) do update
    set
      offer_id = excluded.offer_id,
      offer_slug = excluded.offer_slug,
      offer_name = excluded.offer_name,
      offer_license = excluded.offer_license,
      offer_update_policy = excluded.offer_update_policy,
      package_name = excluded.package_name,
      payment_amount_octas = excluded.payment_amount_octas,
      payment_recipient = excluded.payment_recipient,
      payment_tx_hash = excluded.payment_tx_hash,
      publisher = excluded.publisher,
      version = excluded.version,
      price = excluded.price,
      purchased_at = excluded.purchased_at
    returning
      package_id,
      package_name,
      offer_id,
      offer_name,
      offer_slug,
      offer_license,
      offer_update_policy,
      payment_amount_octas,
      payment_recipient,
      payment_tx_hash,
      price,
      purchased_at,
      publisher,
      version,
      wallet_address
  `);

  return mapPurchaseRow(rows[0]);
}

export async function saveInstall(input: unknown) {
  const sql = getSql();

  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const install = installSchema.parse(input);
  const installTarget = await getCatalogPurchaseTarget(install.packageId);

  if (!installTarget) {
    throw new Error("Package could not be found in the PrimeGate catalog.");
  }

  const requiresPurchase =
    installTarget.kind === "published-asset"
      ? installTarget.payment.amountOctas !== "0"
      : installTarget.price.trim().toLowerCase() !== "free";

  if (requiresPurchase) {
    const purchaseRows = toRows(await sql`
      select 1
      from purchases
      where lower(wallet_address) = lower(${install.walletAddress})
        and package_id = ${install.packageId}
      limit 1
    `);

    if (purchaseRows.length === 0) {
      throw new Error("A verified purchase is required before installing this package.");
    }
  }

  const rows = toRows(await sql`
    insert into installs (
      wallet_address,
      package_id,
      package_name,
      version,
      installed_at
    )
    values (
      ${install.walletAddress},
      ${installTarget.packageId},
      ${installTarget.packageName},
      ${installTarget.version},
      ${install.installedAt}
    )
    on conflict (wallet_address, package_id) do update
    set
      package_name = excluded.package_name,
      version = excluded.version,
      installed_at = excluded.installed_at
    returning
      installed_at,
      package_id,
      package_name,
      version,
      wallet_address
  `);

  return mapInstallRow(rows[0]);
}

export async function saveReview(input: unknown) {
  const sql = getSql();

  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await ensureRegistryReviewsTable(sql);

  const review = reviewSchema.parse(input);
  const normalizedWalletAddress = String(review.walletAddress).trim().toLowerCase();
  const normalizedRating = Number.parseFloat(String(review.rating));

  if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    throw new Error("Review rating must be between 1.0 and 5.0.");
  }

  const packageTarget = await getCatalogPurchaseTarget(review.packageId);
  if (!packageTarget) {
    throw new Error("Package could not be found in the PrimeGate catalog.");
  }

  const rows = toRows(await sql`
    insert into registry_reviews (
      package_id,
      wallet_address,
      author,
      body,
      rating
    )
    values (
      ${review.packageId},
      ${normalizedWalletAddress},
      ${normalizedWalletAddress},
      ${review.body},
      ${normalizedRating.toFixed(1)}
    )
    on conflict (package_id, wallet_address) do update
    set
      author = excluded.author,
      body = excluded.body,
      rating = excluded.rating,
      updated_at = now()
    returning
      author,
      body,
      rating,
      wallet_address,
      created_at
  `);

  return mapReviewRow(rows[0]);
}
