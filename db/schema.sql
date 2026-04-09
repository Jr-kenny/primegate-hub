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
  package_slug text not null,
  release_version text not null,
  title text not null,
  description text not null,
  price numeric(20,8) not null default 0,
  asset_blob_name text not null,
  manifest_blob_name text not null,
  mime_type text not null,
  original_file_name text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

alter table published_assets add column if not exists package_slug text;
alter table published_assets add column if not exists release_version text;

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

create table if not exists purchases (
  wallet_address text not null,
  package_id text not null,
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
create index if not exists idx_published_assets_owner_slug_created on published_assets (lower(owner_address), package_slug, created_at desc, id desc);
create index if not exists idx_published_assets_title_trgm on published_assets using gin (title gin_trgm_ops);
create index if not exists idx_published_assets_description_trgm on published_assets using gin (description gin_trgm_ops);
create index if not exists idx_published_assets_original_file_name_trgm on published_assets using gin (original_file_name gin_trgm_ops);
create index if not exists idx_published_assets_package_slug_trgm on published_assets using gin (package_slug gin_trgm_ops);
create index if not exists idx_published_assets_owner_address_trgm on published_assets using gin (lower(owner_address) gin_trgm_ops);
create index if not exists idx_purchases_wallet_address on purchases (lower(wallet_address));
create unique index if not exists idx_purchases_payment_tx_hash on purchases (lower(payment_tx_hash)) where payment_tx_hash is not null;
create index if not exists idx_installs_wallet_address on installs (lower(wallet_address));
create index if not exists idx_wallet_auth_nonces_wallet_address on wallet_auth_nonces (lower(wallet_address));
create index if not exists idx_publishers_slug_trgm on publishers using gin (slug gin_trgm_ops);
create index if not exists idx_publishers_summary_trgm on publishers using gin (summary gin_trgm_ops);
