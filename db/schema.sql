create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists publishers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  summary text not null,
  is_verified boolean not null default false,
  member_since date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists packages (
  id text primary key,
  publisher_id uuid not null references publishers(id) on delete cascade,
  name text not null unique,
  description text not null,
  type text not null,
  installs integer not null default 0,
  price_cents integer not null default 0,
  is_verified boolean not null default false,
  is_agent_ready boolean not null default false,
  current_version text not null,
  license text not null,
  runtime text not null,
  chain text not null,
  created_at timestamptz not null default now()
);

create table if not exists package_versions (
  id uuid primary key default gen_random_uuid(),
  package_id text not null references packages(id) on delete cascade,
  version text not null,
  notes text not null,
  status text not null check (status in ('latest', 'stable', 'legacy')),
  created_at timestamptz not null default now(),
  unique (package_id, version)
);

create table if not exists package_reviews (
  id uuid primary key default gen_random_uuid(),
  package_id text not null references packages(id) on delete cascade,
  author text not null,
  body text not null,
  rating numeric(2,1) not null,
  created_at timestamptz not null default now()
);

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
);

create table if not exists published_assets (
  id text primary key,
  owner_address text not null,
  storage_account text not null,
  package_slug text not null,
  release_version text not null,
  title text not null,
  description text not null,
  license text not null default 'Custom',
  keywords_json text not null default '[]',
  readme_markdown text not null default '',
  release_notes text not null default '',
  release_channel text not null default 'latest',
  price numeric(20,8) not null default 0,
  asset_blob_name text not null,
  manifest_blob_name text not null,
  mime_type text not null,
  original_file_name text not null,
  size_bytes bigint not null,
  asset_sha256 text,
  content_key_envelope text,
  encryption_json text,
  ciphertext_size_bytes bigint,
  manifest_ciphertext_size_bytes bigint,
  listing_status text not null default 'active' check (listing_status in ('pending', 'active', 'failed')),
  listing_error text,
  listing_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table published_assets add column if not exists package_slug text;
alter table published_assets add column if not exists storage_account text;
update published_assets set storage_account = owner_address where storage_account is null or btrim(storage_account) = '';
alter table published_assets alter column storage_account set not null;
alter table published_assets add column if not exists release_version text;
alter table published_assets add column if not exists license text not null default 'Custom';
alter table published_assets add column if not exists keywords_json text not null default '[]';
alter table published_assets add column if not exists readme_markdown text not null default '';
alter table published_assets add column if not exists release_notes text not null default '';
alter table published_assets add column if not exists release_channel text not null default 'latest';
alter table published_assets add column if not exists asset_sha256 text;
alter table published_assets add column if not exists content_key_envelope text;
alter table published_assets add column if not exists encryption_json text;
alter table published_assets add column if not exists ciphertext_size_bytes bigint;
alter table published_assets add column if not exists manifest_ciphertext_size_bytes bigint;
alter table published_assets add column if not exists listing_status text default 'active';
alter table published_assets add column if not exists listing_error text;
alter table published_assets add column if not exists listing_updated_at timestamptz default now();

update published_assets
set listing_status = 'active'
where listing_status is null or btrim(listing_status) = '';

update published_assets
set listing_updated_at = coalesce(listing_updated_at, created_at, now())
where listing_updated_at is null;

alter table published_assets alter column listing_status set not null;
alter table published_assets alter column listing_updated_at set not null;

update published_assets
set package_slug = lower(regexp_replace(coalesce(nullif(title, ''), id), '[^a-zA-Z0-9]+', '-', 'g'))
where package_slug is null or btrim(package_slug) = '';

update published_assets
set package_slug = trim(both '-' from package_slug)
where package_slug is not null;

update published_assets
set package_slug = concat('release-', left(id, 8))
where package_slug is null or btrim(package_slug) = '';

update published_assets
set release_version = '1.0.0'
where release_version is null or btrim(release_version) = '';

alter table published_assets alter column package_slug set not null;
alter table published_assets alter column release_version set not null;

update published_assets
set license = 'Custom'
where license is null or btrim(license) = '';

update published_assets
set keywords_json = '[]'
where keywords_json is null or btrim(keywords_json) = '';

update published_assets
set readme_markdown = ''
where readme_markdown is null;

update published_assets
set release_notes = ''
where release_notes is null;

update published_assets
set release_channel = 'latest'
where release_channel is null or btrim(release_channel) = '';

create table if not exists published_offers (
  id uuid primary key default gen_random_uuid(),
  published_asset_id text not null references published_assets(id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null,
  price numeric(20,8) not null default 0,
  currency text not null default 'APT',
  license text not null default 'Custom',
  update_policy text not null default 'release-only',
  included_artifacts_json text not null default '["primary"]',
  created_at timestamptz not null default now(),
  unique (published_asset_id, slug)
);

create index if not exists idx_published_offers_asset_id on published_offers (published_asset_id);

create table if not exists publisher_billing_accounts (
  wallet_address text primary key,
  plan_slug text not null default 'free',
  subscription_status text not null default 'inactive',
  billing_provider text,
  external_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
);

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
);

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
select
  published_assets.id,
  'default',
  case when published_assets.price = 0 then 'Free access' else 'Standard access' end,
  published_assets.description,
  published_assets.price,
  'APT',
  published_assets.license,
  'release-only',
  '["primary"]'
from published_assets
where not exists (
  select 1
  from published_offers
  where published_offers.published_asset_id = published_assets.id
    and published_offers.slug = 'default'
);

create table if not exists purchases (
  wallet_address text not null,
  package_id text not null,
  offer_id uuid references published_offers(id),
  offer_slug text,
  offer_name text,
  offer_license text,
  offer_update_policy text,
  package_name text not null,
  payment_amount_octas text,
  payment_recipient text,
  payment_tx_hash text,
  publisher text not null,
  version text not null,
  price text not null,
  purchased_at timestamptz not null default now(),
  primary key (wallet_address, package_id)
);

alter table purchases add column if not exists offer_id uuid references published_offers(id);
alter table purchases add column if not exists offer_slug text;
alter table purchases add column if not exists offer_name text;
alter table purchases add column if not exists offer_license text;
alter table purchases add column if not exists offer_update_policy text;

create table if not exists installs (
  wallet_address text not null,
  package_id text not null,
  package_name text not null,
  version text not null,
  installed_at timestamptz not null default now(),
  primary key (wallet_address, package_id)
);

create table if not exists wallet_auth_nonces (
  wallet_address text not null,
  nonce text not null,
  message text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (wallet_address, nonce)
);

create index if not exists idx_packages_publisher_id on packages (publisher_id);
create index if not exists idx_packages_name_trgm on packages using gin (name gin_trgm_ops);
create index if not exists idx_packages_description_trgm on packages using gin (description gin_trgm_ops);
create index if not exists idx_packages_type_trgm on packages using gin (type gin_trgm_ops);
create index if not exists idx_package_versions_package_id on package_versions (package_id);
create index if not exists idx_package_reviews_package_id on package_reviews (package_id);
create index if not exists idx_registry_reviews_package_id on registry_reviews (package_id);
create index if not exists idx_registry_reviews_wallet_address on registry_reviews (lower(wallet_address));
create index if not exists idx_published_assets_owner_address on published_assets (lower(owner_address));
create index if not exists idx_published_assets_owner_slug on published_assets (lower(owner_address), package_slug);
create unique index if not exists idx_published_assets_owner_slug_release
  on published_assets (lower(owner_address), package_slug, release_version);
create index if not exists idx_published_assets_owner_slug_created on published_assets (lower(owner_address), package_slug, created_at desc, id desc);
create index if not exists idx_published_assets_title_trgm on published_assets using gin (title gin_trgm_ops);
create index if not exists idx_published_assets_description_trgm on published_assets using gin (description gin_trgm_ops);
create index if not exists idx_published_assets_original_file_name_trgm on published_assets using gin (original_file_name gin_trgm_ops);
create index if not exists idx_published_assets_package_slug_trgm on published_assets using gin (package_slug gin_trgm_ops);
create index if not exists idx_published_assets_owner_address_trgm on published_assets using gin (lower(owner_address) gin_trgm_ops);
create index if not exists idx_purchases_wallet_address on purchases (lower(wallet_address));
create index if not exists idx_purchases_offer_id on purchases (offer_id);
create unique index if not exists idx_purchases_payment_tx_hash on purchases (lower(payment_tx_hash)) where payment_tx_hash is not null;
create index if not exists idx_installs_wallet_address on installs (lower(wallet_address));
create index if not exists idx_wallet_auth_nonces_wallet_address on wallet_auth_nonces (lower(wallet_address));
create index if not exists idx_publishers_slug_trgm on publishers using gin (slug gin_trgm_ops);
create index if not exists idx_publishers_summary_trgm on publishers using gin (summary gin_trgm_ops);
create index if not exists idx_publisher_usage_ledger_wallet_created
  on publisher_usage_ledger (lower(wallet_address), created_at desc);
create index if not exists idx_publisher_usage_reservations_wallet_status
  on publisher_usage_reservations (lower(wallet_address), status, expires_at);
