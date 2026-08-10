import {
  AccountAddress,
  AccountAuthenticator,
  Aptos,
  AptosConfig,
  Deserializer,
  Ed25519Account,
  Ed25519PrivateKey,
  MultiAgentTransaction,
  PrivateKey,
  PrivateKeyVariants,
  SimpleTransaction,
  TransactionPayloadEntryFunction,
  type PendingTransactionResponse,
} from "@aptos-labs/ts-sdk";
import { createHmac } from "node:crypto";
import {
  SHELBY_DEPLOYER,
  SHELBYUSD_FA_METADATA_ADDRESS,
  ShelbyBlobClient,
} from "@shelby-protocol/sdk/node";

import {
  PRIMEGATE_DEPLOYED_REGISTRY_ADDRESS,
  encodePrimeGatePackageId,
} from "../../src/lib/primegate-registry-contract.js";
import {
  PRIMEGATE_APTOS_NETWORK,
  PRIMEGATE_DEFAULT_APTOS_FULLNODE_URL,
  PRIMEGATE_APTOS_NETWORK_NAME,
  PRIMEGATE_APTOS_NUMERIC_CHAIN_ID,
  PRIMEGATE_SHELBY_APTOS_NETWORK,
  PRIMEGATE_SHELBY_APTOS_NUMERIC_CHAIN_ID,
  PRIMEGATE_DEFAULT_SHELBY_APTOS_FULLNODE_URL,
} from "../../src/config/primegate-network.js";

const PRIMEGATE_SPONSOR_MAX_TRANSACTION_BYTES = 64 * 1024;
const PRIMEGATE_SPONSOR_MAX_TRANSACTION_LIFETIME_SECONDS = 30 * 60;
const PRIMEGATE_SPONSOR_MAX_GAS_AMOUNT = 100_000n;
const PRIMEGATE_SPONSOR_ALLOWED_FUNCTION = "register_multiple_blobs_with_sponsor";
const PRIMEGATE_SPONSOR_DEFAULT_MIN_APT_OCTAS = 5_000_000n;
const MAX_U64 = 18_446_744_073_709_551_615n;

function createPrimeGateShelbyAptosClient() {
  return new Aptos(
    new AptosConfig({
      network: PRIMEGATE_SHELBY_APTOS_NETWORK,
      fullnode: PRIMEGATE_DEFAULT_SHELBY_APTOS_FULLNODE_URL,
    }),
  );
}

function createPrimeGateListingAptosClient() {
  return new Aptos(
    new AptosConfig({
      network: PRIMEGATE_APTOS_NETWORK,
      fullnode: PRIMEGATE_DEFAULT_APTOS_FULLNODE_URL,
    }),
  );
}

export type SponsoredShelbyTransactionInput = {
  operation: "shelby-registration";
  expectedBlobNames: string[];
  senderAuthenticatorHex: string;
  transactionHex: string;
  walletAddress: string;
};

export type ServerOwnedShelbyRegistrationInput = {
  blobs: Array<{
    blobMerkleRoot: string;
    blobName: string;
    blobSize: number;
    numChunksets: number;
  }>;
  encoding: number;
  expectedBlobNames: string[];
  expirationMicros: number;
  operation: "shelby-registration-v2";
  storageAccount: string;
  walletAddress: string;
};

export type ServerOwnedShelbyCommitInput = {
  blobName: string;
  operation: "shelby-commit-v2";
  storageAccount: string;
  storageProviderAcks: Array<{
    signature: string;
    slot: number;
  }>;
  uid: string;
  walletAddress: string;
};

export type SponsoredPrimeGateListingInput = {
  expectedPackageId: string;
  expectedPriceOctas: string;
  operation: "primegate-listing";
  senderAuthenticatorHex: string;
  transactionHex: string;
  walletAddress: string;
};

export type SponsoredTransactionInput =
  | SponsoredShelbyTransactionInput
  | ServerOwnedShelbyRegistrationInput
  | ServerOwnedShelbyCommitInput
  | SponsoredPrimeGateListingInput;

export type ValidatedSponsoredShelbyTransaction = {
  senderAuthenticator: AccountAuthenticator;
  sponsorAccount: Ed25519Account;
  transaction: MultiAgentTransaction;
};

export type ValidatedSponsoredPrimeGateListingTransaction = {
  senderAuthenticator: AccountAuthenticator;
  sponsorAccount: Ed25519Account;
  transaction: SimpleTransaction;
};

function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function readMinimumBalance(name: string, fallback: bigint) {
  const value = readEnv(name);
  return /^\d+$/.test(value) ? BigInt(value) : fallback;
}

function normalizeAddress(address: string) {
  return AccountAddress.from(address).toStringLong().toLowerCase();
}

function parseHex(value: string, label: string, maxBytes: number) {
  const trimmed = value.trim();

  if (!/^0x[0-9a-f]+$/i.test(trimmed) || (trimmed.length - 2) % 2 !== 0) {
    throw new SponsorTransactionError(`${label} must be a valid hexadecimal value.`, 400);
  }

  if (trimmed.length > 2 + maxBytes * 2) {
    throw new SponsorTransactionError(`${label} is too large.`, 400);
  }

  return trimmed;
}

function parseSponsorAccount() {
  const privateKey = readEnv("PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY");

  if (!privateKey) {
    throw new SponsorConfigurationError("PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY is not configured.");
  }

  let account: Ed25519Account;

  try {
    account = new Ed25519Account({
      privateKey: new Ed25519PrivateKey(privateKey),
    });
  } catch {
    throw new SponsorConfigurationError("PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY is invalid.");
  }
  const configuredAddress = readEnv("PRIMEGATE_SHELBY_SPONSOR_ADDRESS");

  if (configuredAddress) {
    try {
      if (normalizeAddress(configuredAddress) !== normalizeAddress(account.accountAddress.toString())) {
        throw new SponsorConfigurationError(
          "PRIMEGATE_SHELBY_SPONSOR_ADDRESS does not match the configured sponsor private key.",
        );
      }
    } catch (error) {
      if (error instanceof SponsorConfigurationError) {
        throw error;
      }

      throw new SponsorConfigurationError("PRIMEGATE_SHELBY_SPONSOR_ADDRESS is invalid.");
    }
  }

  return account;
}

function deriveManagedStorageAccount(walletAddress: string) {
  const sponsorAccount = parseSponsorAccount();

  let normalizedWallet: string;
  try {
    normalizedWallet = normalizeAddress(walletAddress);
  } catch {
    throw new SponsorTransactionError("The publisher wallet address is invalid.", 400);
  }

  const seed = createHmac("sha256", sponsorAccount.privateKey.toUint8Array())
    .update(`primegate-shelby-storage-v1:${normalizedWallet}`)
    .digest();

  return new Ed25519Account({
    privateKey: new Ed25519PrivateKey(
      PrivateKey.formatPrivateKey(`0x${seed.toString("hex")}`, PrivateKeyVariants.Ed25519),
    ),
  });
}

export function getManagedStorageAccountAddress(walletAddress: string) {
  return deriveManagedStorageAccount(walletAddress).accountAddress.toStringLong();
}

function assertManagedStorageAccount(input: { storageAccount: string; walletAddress: string }) {
  const account = deriveManagedStorageAccount(input.walletAddress);

  let requestedAddress: string;
  try {
    requestedAddress = normalizeAddress(input.storageAccount);
  } catch {
    throw new SponsorTransactionError("The managed Shelby storage account is invalid.", 400);
  }

  if (requestedAddress !== normalizeAddress(account.accountAddress.toString())) {
    throw new SponsorTransactionError(
      "The managed Shelby storage account does not match the authenticated publisher.",
      401,
    );
  }

  return account;
}

function deserializeTransaction(value: string) {
  try {
    const deserializer = Deserializer.fromHex(
      parseHex(value, "transactionHex", PRIMEGATE_SPONSOR_MAX_TRANSACTION_BYTES),
    );
    const transaction = MultiAgentTransaction.deserialize(deserializer);
    deserializer.assertFinished();
    return transaction;
  } catch (error) {
    if (error instanceof SponsorTransactionError) {
      throw error;
    }

    throw new SponsorTransactionError("transactionHex was not a valid sponsored transaction.", 400);
  }
}

function deserializeSimpleTransaction(value: string) {
  try {
    const deserializer = Deserializer.fromHex(
      parseHex(value, "transactionHex", PRIMEGATE_SPONSOR_MAX_TRANSACTION_BYTES),
    );
    const transaction = SimpleTransaction.deserialize(deserializer);
    deserializer.assertFinished();
    return transaction;
  } catch (error) {
    if (error instanceof SponsorTransactionError) {
      throw error;
    }

    throw new SponsorTransactionError("transactionHex was not a valid sponsored transaction.", 400);
  }
}

function deserializeAuthenticator(value: string) {
  try {
    const deserializer = Deserializer.fromHex(parseHex(value, "senderAuthenticatorHex", 8 * 1024));
    const authenticator = AccountAuthenticator.deserialize(deserializer);
    deserializer.assertFinished();
    return authenticator;
  } catch (error) {
    if (error instanceof SponsorTransactionError) {
      throw error;
    }

    throw new SponsorTransactionError("senderAuthenticatorHex was not a valid account authenticator.", 400);
  }
}

function readStringVector(bytes: Uint8Array) {
  try {
    const deserializer = new Deserializer(bytes);
    const count = deserializer.deserializeUleb128AsU32();
    const values: string[] = [];

    for (let index = 0; index < count; index += 1) {
      values.push(deserializer.deserializeStr());
    }

    deserializer.assertFinished();
    return values;
  } catch {
    throw new SponsorTransactionError("The Shelby blob-name payload was invalid.", 400);
  }
}

function readByteVector(bytes: Uint8Array) {
  try {
    const deserializer = new Deserializer(bytes);
    const value = deserializer.deserializeBytes();
    deserializer.assertFinished();
    return value;
  } catch {
    throw new SponsorTransactionError("The PrimeGate package-id payload was invalid.", 400);
  }
}

function readU64(bytes: Uint8Array) {
  try {
    const deserializer = new Deserializer(bytes);
    const value = deserializer.deserializeU64();
    deserializer.assertFinished();
    return value;
  } catch {
    throw new SponsorTransactionError("The PrimeGate listing price payload was invalid.", 400);
  }
}

function getEntryFunction(transaction: { rawTransaction: { payload: unknown } }) {
  if (!(transaction.rawTransaction.payload instanceof TransactionPayloadEntryFunction)) {
    throw new SponsorTransactionError("Only supported PrimeGate entry functions can be sponsored.", 400);
  }

  return transaction.rawTransaction.payload.entryFunction;
}

function assertCommonTransactionFields(
  transaction: {
    feePayerAddress?: AccountAddress;
    rawTransaction: {
      chain_id: { chainId: number };
      expiration_timestamp_secs: bigint;
      max_gas_amount: bigint;
      sender: AccountAddress;
    };
  },
  walletAddress: string,
  sponsorAccount: Ed25519Account,
  expectedChainId: number,
  expectedNetworkName: string,
) {
  const wallet = AccountAddress.from(walletAddress);

  if (!transaction.rawTransaction.sender.equals(wallet)) {
    throw new SponsorTransactionError("The transaction sender does not match the authenticated wallet.", 401);
  }

  if (transaction.rawTransaction.sender.equals(sponsorAccount.accountAddress)) {
    throw new SponsorTransactionError(
      "The PrimeGate sponsor account must be different from the publishing wallet.",
      400,
    );
  }

  if (transaction.rawTransaction.chain_id.chainId !== expectedChainId) {
    throw new SponsorTransactionError(
      `The sponsor service only accepts ${expectedNetworkName} transactions for this operation.`,
      400,
    );
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = Number(transaction.rawTransaction.expiration_timestamp_secs);

  if (!Number.isSafeInteger(expiresAt) || expiresAt <= nowInSeconds) {
    throw new SponsorTransactionError("The transaction has expired.", 400);
  }

  if (expiresAt > nowInSeconds + PRIMEGATE_SPONSOR_MAX_TRANSACTION_LIFETIME_SECONDS) {
    throw new SponsorTransactionError("The transaction expires too far in the future.", 400);
  }

  if (transaction.rawTransaction.max_gas_amount > PRIMEGATE_SPONSOR_MAX_GAS_AMOUNT) {
    throw new SponsorTransactionError("The transaction gas limit is above the sponsor service limit.", 400);
  }

  if (!transaction.feePayerAddress || !transaction.feePayerAddress.equals(sponsorAccount.accountAddress)) {
    throw new SponsorTransactionError("The PrimeGate sponsor is not the Aptos fee payer for this transaction.", 400);
  }
}

function getConfiguredRegistryAddress() {
  const configuredAddress = readEnv("PRIMEGATE_REGISTRY_ADDRESS") || readEnv("VITE_PRIMEGATE_REGISTRY_ADDRESS");

  try {
    return AccountAddress.from(configuredAddress || PRIMEGATE_DEPLOYED_REGISTRY_ADDRESS);
  } catch {
    throw new SponsorConfigurationError("The configured PrimeGate registry address is invalid.");
  }
}

function validatePrimeGateListingTransaction(
  input: SponsoredPrimeGateListingInput,
  sponsorAccount: Ed25519Account,
): ValidatedSponsoredPrimeGateListingTransaction {
  if (!input.expectedPackageId.trim()) {
    throw new SponsorTransactionError("The PrimeGate listing package id is required.", 400);
  }

  if (!/^\d+$/.test(input.expectedPriceOctas) || input.expectedPriceOctas.length > 20) {
    throw new SponsorTransactionError("The PrimeGate listing price must be a valid u64 value.", 400);
  }

  const transaction = deserializeSimpleTransaction(input.transactionHex);
  const senderAuthenticator = deserializeAuthenticator(input.senderAuthenticatorHex);
  assertCommonTransactionFields(
    transaction,
    input.walletAddress,
    sponsorAccount,
    PRIMEGATE_APTOS_NUMERIC_CHAIN_ID,
    PRIMEGATE_APTOS_NETWORK_NAME,
  );

  const entryFunction = getEntryFunction(transaction);

  if (
    !entryFunction.module_name.address.equals(getConfiguredRegistryAddress()) ||
    entryFunction.module_name.name.identifier !== "registry" ||
    entryFunction.function_name.identifier !== "upsert_listing"
  ) {
    throw new SponsorTransactionError("The transaction is not a PrimeGate listing update.", 400);
  }

  const packageIdArgument = entryFunction.args[0] as { value?: { value?: Uint8Array } } | undefined;
  const priceArgument = entryFunction.args[1] as { value?: { value?: Uint8Array } } | undefined;
  const packageIdBytes = packageIdArgument?.value?.value;
  const priceBytes = priceArgument?.value?.value;

  if (!packageIdBytes || !priceBytes) {
    throw new SponsorTransactionError("The PrimeGate listing payload was incomplete.", 400);
  }

  const expectedPackageIdBytes = encodePrimeGatePackageId(input.expectedPackageId);
  const actualPackageIdBytes = readByteVector(packageIdBytes);
  const expectedPriceOctas = BigInt(input.expectedPriceOctas);
  const actualPriceOctas = readU64(priceBytes);

  if (expectedPriceOctas > MAX_U64) {
    throw new SponsorTransactionError("The PrimeGate listing price must be a valid u64 value.", 400);
  }

  if (
    actualPackageIdBytes.length !== expectedPackageIdBytes.length ||
    actualPackageIdBytes.some((value, index) => value !== expectedPackageIdBytes[index])
  ) {
    throw new SponsorTransactionError("The listing package does not match the PrimeGate release.", 400);
  }

  if (actualPriceOctas !== expectedPriceOctas || actualPriceOctas <= 0n) {
    throw new SponsorTransactionError("The listing price does not match the PrimeGate release.", 400);
  }

  return {
    senderAuthenticator,
    sponsorAccount,
    transaction,
  };
}

function assertExpectedBlobNames(transaction: MultiAgentTransaction, expectedBlobNames: string[]) {
  const payload = transaction.rawTransaction.payload;

  if (!(payload instanceof TransactionPayloadEntryFunction)) {
    throw new SponsorTransactionError("Only Shelby entry-function registrations can be sponsored.", 400);
  }

  const blobNameArgument = payload.entryFunction.args[0] as
    | { value?: { value?: Uint8Array } }
    | undefined;
  const blobNameBytes = blobNameArgument?.value?.value;

  if (!blobNameBytes) {
    throw new SponsorTransactionError("The Shelby registration payload did not contain blob names.", 400);
  }

  const transactionBlobNames = readStringVector(blobNameBytes);
  const normalizedExpected = expectedBlobNames.map((name) => name.trim());

  if (
    normalizedExpected.length === 0 ||
    normalizedExpected.some((name) => !name) ||
    transactionBlobNames.length !== normalizedExpected.length ||
    transactionBlobNames.some((name, index) => name !== normalizedExpected[index])
  ) {
    throw new SponsorTransactionError("The Shelby registration does not match the active PrimeGate publish intent.", 400);
  }
}

export class SponsorTransactionError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SponsorTransactionError";
    this.status = status;
  }
}

export class SponsorConfigurationError extends SponsorTransactionError {
  constructor(message: string) {
    super(message, 503);
    this.name = "SponsorConfigurationError";
  }
}

export function getSponsorAccountAddress() {
  return parseSponsorAccount().accountAddress.toStringLong();
}

export type SponsorFundingStatus = {
  aptosReady: boolean;
  listingAptosReady: boolean;
  shelbyUsdReady: boolean;
};

export async function getSponsorFundingStatus(): Promise<SponsorFundingStatus> {
  const sponsorAddress = getSponsorAccountAddress();
  const shelbyAptos = createPrimeGateShelbyAptosClient();
  const listingAptos = createPrimeGateListingAptosClient();
  const [aptosBalance, listingAptosBalance, shelbyUsdBalance] = await Promise.all([
    shelbyAptos.getBalance({
      accountAddress: sponsorAddress,
      asset: "0x1::aptos_coin::AptosCoin",
    }),
    listingAptos.getBalance({
      accountAddress: sponsorAddress,
      asset: "0x1::aptos_coin::AptosCoin",
    }),
    shelbyAptos.getBalance({
      accountAddress: sponsorAddress,
      asset: SHELBYUSD_FA_METADATA_ADDRESS,
    }),
  ]);

  return {
    aptosReady:
      BigInt(aptosBalance) >=
      readMinimumBalance("PRIMEGATE_SPONSOR_MIN_APT_OCTAS", PRIMEGATE_SPONSOR_DEFAULT_MIN_APT_OCTAS),
    listingAptosReady:
      BigInt(listingAptosBalance) >=
      readMinimumBalance("PRIMEGATE_SPONSOR_MIN_APT_OCTAS", PRIMEGATE_SPONSOR_DEFAULT_MIN_APT_OCTAS),
    shelbyUsdReady: BigInt(shelbyUsdBalance) > 0n,
  };
}

async function assertListingSponsorFunding() {
  let funding: SponsorFundingStatus;

  try {
    funding = await getSponsorFundingStatus();
  } catch {
    throw new SponsorConfigurationError("The PrimeGate sponsor funding check is unavailable.");
  }

  if (!funding.listingAptosReady) {
    throw new SponsorConfigurationError("The PrimeGate sponsor account needs Aptos Testnet APT to pay listing fees.");
  }
}

async function assertSponsorFunding() {
  let funding: SponsorFundingStatus;

  try {
    funding = await getSponsorFundingStatus();
  } catch {
    throw new SponsorConfigurationError("The PrimeGate sponsor funding check is unavailable.");
  }

  if (!funding.aptosReady) {
    throw new SponsorConfigurationError("The PrimeGate sponsor account needs more APT to pay transaction fees.");
  }

  if (!funding.shelbyUsdReady) {
    throw new SponsorConfigurationError("The PrimeGate sponsor account needs ShelbyUSD to register blobs.");
  }
}

export function validateSponsoredShelbyTransaction(
  input: SponsoredShelbyTransactionInput,
): ValidatedSponsoredShelbyTransaction {
  const sponsorAccount = parseSponsorAccount();
  const transaction = deserializeTransaction(input.transactionHex);
  const senderAuthenticator = deserializeAuthenticator(input.senderAuthenticatorHex);

  if (!transaction.feePayerAddress || !transaction.feePayerAddress.equals(sponsorAccount.accountAddress)) {
    throw new SponsorTransactionError("The PrimeGate sponsor is not the Aptos fee payer for this transaction.", 400);
  }

  if (
    transaction.secondarySignerAddresses.length !== 1 ||
    !transaction.secondarySignerAddresses[0].equals(sponsorAccount.accountAddress)
  ) {
    throw new SponsorTransactionError("The PrimeGate sponsor is not the Shelby transaction signer.", 400);
  }

  assertCommonTransactionFields(
    transaction,
    input.walletAddress,
    sponsorAccount,
    PRIMEGATE_SHELBY_APTOS_NUMERIC_CHAIN_ID,
    "shelbynet",
  );

  const entryFunction = getEntryFunction(transaction);

  if (
    !entryFunction.module_name.address.equals(AccountAddress.from(SHELBY_DEPLOYER)) ||
    entryFunction.module_name.name.identifier !== "blob_metadata" ||
    entryFunction.function_name.identifier !== PRIMEGATE_SPONSOR_ALLOWED_FUNCTION
  ) {
    throw new SponsorTransactionError("The transaction is not a supported Shelby registration.", 400);
  }

  assertExpectedBlobNames(transaction, input.expectedBlobNames);

  return {
    senderAuthenticator,
    sponsorAccount,
    transaction,
  };
}

export async function submitSponsoredShelbyTransaction(
  input: SponsoredShelbyTransactionInput,
): Promise<PendingTransactionResponse> {
  const validated = validateSponsoredShelbyTransaction(input);
  await assertSponsorFunding();
  const aptos = createPrimeGateShelbyAptosClient();
  const sponsorAuthenticator = validated.sponsorAccount.signTransactionWithAuthenticator(validated.transaction);

  return aptos.transaction.submit.multiAgent({
    additionalSignersAuthenticators: [sponsorAuthenticator],
    feePayerAuthenticator: sponsorAuthenticator,
    senderAuthenticator: validated.senderAuthenticator,
    transaction: validated.transaction,
  });
}

export function validateServerOwnedShelbyRegistration(input: ServerOwnedShelbyRegistrationInput) {
  const expectedNames = input.expectedBlobNames.map((name) => name.trim());
  if (
    expectedNames.length === 0 ||
    input.blobs.length !== expectedNames.length ||
    input.blobs.some((blob, index) => blob.blobName !== expectedNames[index])
  ) {
    throw new SponsorTransactionError(
      "The Shelby registration does not match the active PrimeGate publish intent.",
      400,
    );
  }

  if (
    !Number.isSafeInteger(input.expirationMicros) ||
    input.expirationMicros <= Date.now() * 1000 ||
    input.expirationMicros > Date.now() * 1000 + 366 * 24 * 60 * 60 * 1_000_000
  ) {
    throw new SponsorTransactionError("The Shelby registration expiration is invalid.", 400);
  }

  if (!Number.isInteger(input.encoding) || input.encoding < 0 || input.encoding > 255) {
    throw new SponsorTransactionError("The Shelby registration encoding is invalid.", 400);
  }

  for (const blob of input.blobs) {
    if (
      !/^0x[a-f0-9]{64}$/i.test(blob.blobMerkleRoot) ||
      !Number.isSafeInteger(blob.blobSize) ||
      blob.blobSize <= 0 ||
      !Number.isSafeInteger(blob.numChunksets) ||
      blob.numChunksets <= 0
    ) {
      throw new SponsorTransactionError("The Shelby blob registration data is invalid.", 400);
    }
  }
}

export async function submitServerOwnedShelbyRegistration(
  input: ServerOwnedShelbyRegistrationInput,
): Promise<PendingTransactionResponse> {
  validateServerOwnedShelbyRegistration(input);
  await assertSponsorFunding();

  const sponsorAccount = parseSponsorAccount();
  const storageAccount = assertManagedStorageAccount(input);
  const aptos = createPrimeGateShelbyAptosClient();
  const transaction = await aptos.transaction.build.multiAgent({
    data: ShelbyBlobClient.createBatchRegisterBlobsPayload({
      account: storageAccount.accountAddress,
      blobs: input.blobs,
      encoding: input.encoding,
      expirationMicros: input.expirationMicros,
      useSponsoredUsdVariant: true,
    }),
    options: {
      maxGasAmount: Number(PRIMEGATE_SPONSOR_MAX_GAS_AMOUNT),
    },
    secondarySignerAddresses: [sponsorAccount.accountAddress],
    sender: storageAccount.accountAddress,
    withFeePayer: true,
  });
  transaction.feePayerAddress = sponsorAccount.accountAddress;
  const senderAuthenticator = storageAccount.signTransactionWithAuthenticator(transaction);
  const sponsorAuthenticator = sponsorAccount.signTransactionWithAuthenticator(transaction);

  return aptos.transaction.submit.multiAgent({
    additionalSignersAuthenticators: [sponsorAuthenticator],
    feePayerAuthenticator: sponsorAuthenticator,
    senderAuthenticator,
    transaction,
  });
}

export async function submitServerOwnedShelbyCommit(
  input: ServerOwnedShelbyCommitInput,
): Promise<PendingTransactionResponse> {
  validateServerOwnedShelbyCommit(input);
  await assertSponsorFunding();
  const sponsorAccount = parseSponsorAccount();
  const storageAccount = assertManagedStorageAccount(input);
  const aptos = createPrimeGateShelbyAptosClient();
  const transaction = await aptos.transaction.build.simple({
    data: ShelbyBlobClient.createCommitObjectPayload({
      blobName: input.blobName,
      overwrite: true,
      storageProviderAcks: input.storageProviderAcks.map((ack) => ({
        signature: Uint8Array.from(Buffer.from(ack.signature.slice(2), "hex")),
        slot: ack.slot,
      })),
      uid: BigInt(input.uid),
    }),
    options: {
      maxGasAmount: Number(PRIMEGATE_SPONSOR_MAX_GAS_AMOUNT),
    },
    sender: storageAccount.accountAddress,
    withFeePayer: true,
  });
  transaction.feePayerAddress = sponsorAccount.accountAddress;
  const senderAuthenticator = storageAccount.signTransactionWithAuthenticator(transaction);
  const sponsorAuthenticator = sponsorAccount.signTransactionWithAuthenticator(transaction);

  return aptos.transaction.submit.simple({
    feePayerAuthenticator: sponsorAuthenticator,
    senderAuthenticator,
    transaction,
  });
}

export function validateServerOwnedShelbyCommit(input: ServerOwnedShelbyCommitInput) {
  if (!/^\d+$/.test(input.uid) || !input.blobName.trim()) {
    throw new SponsorTransactionError("The Shelby commit target is invalid.", 400);
  }

  if (
    input.storageProviderAcks.length === 0 ||
    input.storageProviderAcks.some(
      (ack) =>
        !Number.isInteger(ack.slot) ||
        ack.slot < 0 ||
        ack.slot > 31 ||
        !/^0x(?:[a-f0-9]{2})+$/i.test(ack.signature),
    )
  ) {
    throw new SponsorTransactionError("The Shelby storage provider acknowledgements are invalid.", 400);
  }

  const uniqueSlots = new Set(input.storageProviderAcks.map((ack) => ack.slot));
  if (uniqueSlots.size !== input.storageProviderAcks.length) {
    throw new SponsorTransactionError("The Shelby storage provider acknowledgements contain duplicate slots.", 400);
  }
}

export function validateSponsoredPrimeGateListingTransaction(input: SponsoredPrimeGateListingInput) {
  const sponsorAccount = parseSponsorAccount();
  return validatePrimeGateListingTransaction(input, sponsorAccount);
}

export async function submitSponsoredPrimeGateListingTransaction(
  input: SponsoredPrimeGateListingInput,
): Promise<PendingTransactionResponse> {
  const validated = validatePrimeGateListingTransaction(input, parseSponsorAccount());
  await assertListingSponsorFunding();
  const aptos = createPrimeGateListingAptosClient();
  const sponsorAuthenticator = validated.sponsorAccount.signTransactionWithAuthenticator(validated.transaction);

  return aptos.transaction.submit.simple({
    feePayerAuthenticator: sponsorAuthenticator,
    senderAuthenticator: validated.senderAuthenticator,
    transaction: validated.transaction,
  });
}
