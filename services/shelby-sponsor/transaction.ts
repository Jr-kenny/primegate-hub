import {
  AccountAddress,
  AccountAuthenticator,
  Aptos,
  AptosConfig,
  Deserializer,
  Ed25519Account,
  Ed25519PrivateKey,
  MultiAgentTransaction,
  Network,
  SimpleTransaction,
  TransactionPayloadEntryFunction,
  type PendingTransactionResponse,
} from "@aptos-labs/ts-sdk";
import {
  SHELBY_DEPLOYER,
  SHELBYUSD_FA_METADATA_ADDRESS,
} from "@shelby-protocol/sdk/node";

import {
  PRIMEGATE_DEPLOYED_REGISTRY_ADDRESS,
  encodePrimeGatePackageId,
} from "../../src/lib/primegate-registry-contract.js";

const PRIMEGATE_SPONSOR_MAX_TRANSACTION_BYTES = 64 * 1024;
const PRIMEGATE_SPONSOR_MAX_TRANSACTION_LIFETIME_SECONDS = 30 * 60;
const PRIMEGATE_SPONSOR_MAX_GAS_AMOUNT = 100_000n;
const PRIMEGATE_SPONSOR_ALLOWED_FUNCTION = "register_multiple_blobs_with_sponsor";
const PRIMEGATE_SPONSOR_DEFAULT_MIN_APT_OCTAS = 5_000_000n;
const MAX_U64 = 18_446_744_073_709_551_615n;

export type SponsoredShelbyTransactionInput = {
  operation: "shelby-registration";
  expectedBlobNames: string[];
  senderAuthenticatorHex: string;
  transactionHex: string;
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

export type SponsoredTransactionInput = SponsoredShelbyTransactionInput | SponsoredPrimeGateListingInput;

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

  if (transaction.rawTransaction.chain_id.chainId !== 2) {
    throw new SponsorTransactionError("The sponsor service only accepts Aptos testnet transactions.", 400);
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
  assertCommonTransactionFields(transaction, input.walletAddress, sponsorAccount);

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
  shelbyUsdReady: boolean;
};

export async function getSponsorFundingStatus(): Promise<SponsorFundingStatus> {
  const sponsorAddress = getSponsorAccountAddress();
  const aptos = new Aptos(
    new AptosConfig({
      network: Network.TESTNET,
    }),
  );
  const [aptosBalance, shelbyUsdBalance] = await Promise.all([
    aptos.getBalance({
      accountAddress: sponsorAddress,
      asset: "0x1::aptos_coin::AptosCoin",
    }),
    aptos.getBalance({
      accountAddress: sponsorAddress,
      asset: SHELBYUSD_FA_METADATA_ADDRESS,
    }),
  ]);

  return {
    aptosReady:
      BigInt(aptosBalance) >=
      readMinimumBalance("PRIMEGATE_SPONSOR_MIN_APT_OCTAS", PRIMEGATE_SPONSOR_DEFAULT_MIN_APT_OCTAS),
    shelbyUsdReady: BigInt(shelbyUsdBalance) > 0n,
  };
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

  assertCommonTransactionFields(transaction, input.walletAddress, sponsorAccount);

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
  const aptos = new Aptos(
    new AptosConfig({
      network: Network.TESTNET,
    }),
  );
  const sponsorAuthenticator = validated.sponsorAccount.signTransactionWithAuthenticator(validated.transaction);

  return aptos.transaction.submit.multiAgent({
    additionalSignersAuthenticators: [sponsorAuthenticator],
    feePayerAuthenticator: sponsorAuthenticator,
    senderAuthenticator: validated.senderAuthenticator,
    transaction: validated.transaction,
  });
}

export function validateSponsoredPrimeGateListingTransaction(input: SponsoredPrimeGateListingInput) {
  const sponsorAccount = parseSponsorAccount();
  return validatePrimeGateListingTransaction(input, sponsorAccount);
}

export async function submitSponsoredPrimeGateListingTransaction(
  input: SponsoredPrimeGateListingInput,
): Promise<PendingTransactionResponse> {
  const validated = validatePrimeGateListingTransaction(input, parseSponsorAccount());
  await assertSponsorFunding();
  const aptos = new Aptos(
    new AptosConfig({
      network: Network.TESTNET,
    }),
  );
  const sponsorAuthenticator = validated.sponsorAccount.signTransactionWithAuthenticator(validated.transaction);

  return aptos.transaction.submit.simple({
    feePayerAuthenticator: sponsorAuthenticator,
    senderAuthenticator: validated.senderAuthenticator,
    transaction: validated.transaction,
  });
}
