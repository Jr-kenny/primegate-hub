import { z } from "zod";

import { getSql } from "./database.js";
import { verifyPublishedAssetPayment } from "./payments.js";
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
import { buildPrimeGatePackageHandle } from "../../src/lib/primegate-package.js";
import { inferPrimeGatePackageType } from "../../src/lib/primegate-package-type.js";
import type {
  PrimeGateEntitlementRecord,
  PrimeGateInstallRecord,
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

  return {
    id: String(row.id),
    name: buildPublishedAssetPackageName(row),
    packageHandle: buildPublishedAssetPackageHandle(row),
    packageSlug: String(row.package_slug),
    createdAt,
    description: String(row.description),
    publisher: buildPublishedAssetPublisher(ownerAddress),
    type: inferPrimeGatePackageType(String(row.original_file_name), String(row.mime_type)),
    installs: 0,
    price: Number(row.price) <= 0 ? "Free" : formatAptAmountLabel(toStoredAptAmount(row.price)),
    verified: false,
    agentReady: false,
    version: String(row.release_version),
    license: "Custom",
    runtime: "CLI, SDK, MCP, Web",
    chain: "Aptos",
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
  return rows.map((row, index) => ({
    id: String(row.id),
    notes: `Published ${String(row.original_file_name)} to Shelby as ${String(row.asset_blob_name)}.`,
    publishedAt: toIsoTimestamp(row.created_at),
    status: index === 0 ? "latest" : index === 1 ? "stable" : "legacy",
    version: String(row.release_version),
  }));
}

function mapPublishedAssetRow(row: Record<string, unknown>): PrimeGatePublishedAssetRecord {
  return {
    assetBlobName: String(row.asset_blob_name),
    createdAt: toIsoTimestamp(row.created_at),
    description: String(row.description),
    id: String(row.id),
    manifestBlobName: String(row.manifest_blob_name),
    mimeType: String(row.mime_type),
    originalFileName: String(row.original_file_name),
    ownerAddress: String(row.owner_address),
    packageHandle: buildPublishedAssetPackageHandle(row),
    packageSlug: String(row.package_slug),
    price: Number(row.price),
    sizeBytes: Number(row.size_bytes),
    title: String(row.title),
    version: String(row.release_version),
  };
}

function mapPurchaseRow(row: Record<string, unknown>): PrimeGatePurchaseRecord {
  return {
    packageId: String(row.package_id),
    packageName: String(row.package_name),
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
      created_at,
      description,
      manifest_blob_name,
      mime_type,
      original_file_name,
      owner_address,
      package_slug,
      price,
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
        created_at,
        description,
        manifest_blob_name,
        mime_type,
        original_file_name,
        owner_address,
        package_slug,
        price,
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
      created_at,
      description,
      manifest_blob_name,
      mime_type,
      original_file_name,
      owner_address,
      package_slug,
      price,
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
      created_at,
      description,
      manifest_blob_name,
      mime_type,
      original_file_name,
      owner_address,
      package_slug,
      price,
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
    select id, owner_address, price, release_version, title
    from published_assets
    where id = ${packageId}
    limit 1
  `);

  if (publishedAssetRows.length === 0) {
    return null;
  }

  const publishedAsset = publishedAssetRows[0];
  const amountApt = toStoredAptAmount(publishedAsset.price);

  return {
    kind: "published-asset" as const,
    packageId: String(publishedAsset.id),
    packageName: String(publishedAsset.title),
    price: Number(publishedAsset.price) <= 0 ? "Free" : formatAptAmountLabel(amountApt),
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
      created_at,
      description,
      manifest_blob_name,
      mime_type,
      original_file_name,
      owner_address,
      package_slug,
      price,
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
    where
      id ilike ${`%${trimmedQuery}%`}
      or title ilike ${`%${trimmedQuery}%`}
      or description ilike ${`%${trimmedQuery}%`}
      or original_file_name ilike ${`%${trimmedQuery}%`}
      or owner_address ilike ${`%${trimmedQuery}%`}
      or package_slug ilike ${`%${trimmedQuery}%`}
      or concat(lower(owner_address), '/', package_slug) ilike lower(${`%${trimmedQuery}%`})
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
      lower(owner_address) ilike lower(${`%${trimmedQuery}%`})
      or package_slug ilike ${`%${trimmedQuery}%`}
      or title ilike ${`%${trimmedQuery}%`}
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
      ${walletAddress}::text as wallet_address,
      now()::text as granted_at,
      'free'::text as source
    from packages p
    where p.price_cents = 0
    union all
    select
      purchases.package_id,
      purchases.package_name,
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
  createdAt: z.string().min(1),
  description: z.string().min(1),
  id: z.string().min(1),
  manifestBlobName: z.string().min(1),
  mimeType: z.string().min(1),
  originalFileName: z.string().min(1),
  ownerAddress: z.string().min(1),
  packageSlug: z.string().min(1),
  priceApt: z.string().min(1),
  releaseVersion: z.string().min(1),
  sizeBytes: z.number().min(0),
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

export async function savePublishedAsset(input: unknown) {
  const sql = getSql();

  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const asset = publishedAssetSchema.parse(input);
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
      price,
      asset_blob_name,
      manifest_blob_name,
      mime_type,
      original_file_name,
      size_bytes,
      created_at
    )
    values (
      ${asset.id},
      ${asset.ownerAddress},
      ${asset.packageSlug},
      ${asset.releaseVersion},
      ${asset.title},
      ${asset.description},
      ${normalizeAptAmount(asset.priceApt)},
      ${asset.assetBlobName},
      ${asset.manifestBlobName},
      ${asset.mimeType},
      ${asset.originalFileName},
      ${asset.sizeBytes},
      ${asset.createdAt}
    )
    on conflict (id) do update
    set
      owner_address = excluded.owner_address,
      package_slug = excluded.package_slug,
      release_version = excluded.release_version,
      title = excluded.title,
      description = excluded.description,
      price = excluded.price,
      asset_blob_name = excluded.asset_blob_name,
      manifest_blob_name = excluded.manifest_blob_name,
      mime_type = excluded.mime_type,
      original_file_name = excluded.original_file_name,
      size_bytes = excluded.size_bytes,
      created_at = excluded.created_at
    returning
      id,
      asset_blob_name,
      created_at,
      description,
      manifest_blob_name,
      mime_type,
      original_file_name,
      owner_address,
      package_slug,
      price,
      release_version,
      size_bytes,
      title
  `);

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
