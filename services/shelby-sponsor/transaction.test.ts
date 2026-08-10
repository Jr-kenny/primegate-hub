import {
  Account,
  AccountAddress,
  ChainId,
  EntryFunction,
  MultiAgentTransaction,
  RawTransaction,
  Serialized,
  SimpleTransaction,
  Serializer,
  TransactionPayloadEntryFunction,
} from "@aptos-labs/ts-sdk";
import { SHELBY_DEPLOYER } from "@shelby-protocol/sdk/node";

import {
  PRIMEGATE_APTOS_NUMERIC_CHAIN_ID,
  PRIMEGATE_SHELBY_APTOS_NUMERIC_CHAIN_ID,
} from "../../src/config/primegate-network.js";
import { PRIMEGATE_DEPLOYED_REGISTRY_ADDRESS } from "../../src/lib/primegate-registry-contract.js";
import {
  validateSponsoredPrimeGateListingTransaction,
  validateSponsoredShelbyTransaction,
  validateServerOwnedShelbyCommit,
  validateServerOwnedShelbyRegistration,
  getManagedStorageAccountAddress,
} from "./transaction.js";

function buildSponsoredTransaction() {
  const sender = Account.generate();
  const sponsor = Account.generate();
  const expectedBlobNames = [
    "primegate/content/test-id/asset.bin",
    "primegate/content/test-id/manifest.bin",
  ];
  const serializeStringVector = (values: string[]) => {
    const serializer = new Serializer();
    serializer.serializeU32AsUleb128(values.length);
    values.forEach((value) => serializer.serializeStr(value));
    return serializer.toUint8Array();
  };
  const serializeU64Vector = (values: number[]) => {
    const serializer = new Serializer();
    serializer.serializeU32AsUleb128(values.length);
    values.forEach((value) => serializer.serializeU64(value));
    return serializer.toUint8Array();
  };
  const serializeRootVector = (values: Uint8Array[]) => {
    const serializer = new Serializer();
    serializer.serializeU32AsUleb128(values.length);
    values.forEach((value) => serializer.serializeBytes(value));
    return serializer.toUint8Array();
  };
  const functionEntry = EntryFunction.build(
    `${SHELBY_DEPLOYER}::blob_metadata`,
    "register_multiple_blobs_with_sponsor",
    [],
    [
      new Serialized(serializeStringVector(expectedBlobNames)),
      new Serialized(new Uint8Array([0])),
      new Serialized(serializeRootVector([new Uint8Array(32).fill(0x11), new Uint8Array(32).fill(0x22)])),
      new Serialized(serializeU64Vector([1, 1])),
      new Serialized(serializeU64Vector([128, 96])),
      new Serialized(new Uint8Array([0])),
      new Serialized(new Uint8Array([0])),
    ],
  );
  const rawTransaction = new RawTransaction(
    AccountAddress.from(sender.accountAddress),
    0n,
    new TransactionPayloadEntryFunction(functionEntry),
    50_000n,
    100n,
    BigInt(Math.floor(Date.now() / 1000) + 600),
    new ChainId(PRIMEGATE_SHELBY_APTOS_NUMERIC_CHAIN_ID),
  );

  return {
    expectedBlobNames,
    sender,
    sponsor,
    transaction: new MultiAgentTransaction(rawTransaction, [sponsor.accountAddress], sponsor.accountAddress),
  };
}

function buildSponsoredListingTransaction() {
  const sender = Account.generate();
  const sponsor = Account.generate();
  const packageId = "primegate-package-test";
  const priceOctas = "125000000";
  const packageIdSerializer = new Serializer();
  packageIdSerializer.serializeBytes(new TextEncoder().encode(packageId));
  const priceSerializer = new Serializer();
  priceSerializer.serializeU64(BigInt(priceOctas));
  const functionEntry = EntryFunction.build(
    `${PRIMEGATE_DEPLOYED_REGISTRY_ADDRESS}::registry`,
    "upsert_listing",
    [],
    [new Serialized(packageIdSerializer.toUint8Array()), new Serialized(priceSerializer.toUint8Array())],
  );
  const rawTransaction = new RawTransaction(
    AccountAddress.from(sender.accountAddress),
    0n,
    new TransactionPayloadEntryFunction(functionEntry),
    10_000n,
    100n,
    BigInt(Math.floor(Date.now() / 1000) + 600),
    new ChainId(PRIMEGATE_APTOS_NUMERIC_CHAIN_ID),
  );

  return {
    packageId,
    priceOctas,
    sender,
    sponsor,
    transaction: new SimpleTransaction(rawTransaction, sponsor.accountAddress),
  };
}

describe("PrimeGate Shelby sponsor transaction validation", () => {
  const originalPrivateKey = process.env.PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY;
  const originalAddress = process.env.PRIMEGATE_SHELBY_SPONSOR_ADDRESS;

  afterEach(() => {
    if (originalPrivateKey === undefined) {
      delete process.env.PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY;
    } else {
      process.env.PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY = originalPrivateKey;
    }

    if (originalAddress === undefined) {
      delete process.env.PRIMEGATE_SHELBY_SPONSOR_ADDRESS;
    } else {
      process.env.PRIMEGATE_SHELBY_SPONSOR_ADDRESS = originalAddress;
    }
  });

  it("accepts a publisher-signed Shelby registration for the configured sponsor", async () => {
    const { expectedBlobNames, sender, sponsor, transaction } = await buildSponsoredTransaction();
    process.env.PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY = sponsor.privateKey.toString();
    process.env.PRIMEGATE_SHELBY_SPONSOR_ADDRESS = sponsor.accountAddress.toString();

    const validated = validateSponsoredShelbyTransaction({
      expectedBlobNames,
      operation: "shelby-registration",
      senderAuthenticatorHex: sender.signTransactionWithAuthenticator(transaction).bcsToHex().toString(),
      transactionHex: transaction.bcsToHex().toString(),
      walletAddress: sender.accountAddress.toString(),
    });

    expect(validated.transaction.rawTransaction.sender.equals(sender.accountAddress)).toBe(true);
    expect(validated.sponsorAccount.accountAddress.equals(sponsor.accountAddress)).toBe(true);
  });

  it("rejects a transaction with a different publish intent blob name", async () => {
    const { sender, sponsor, transaction } = await buildSponsoredTransaction();
    process.env.PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY = sponsor.privateKey.toString();
    process.env.PRIMEGATE_SHELBY_SPONSOR_ADDRESS = sponsor.accountAddress.toString();

    expect(() =>
      validateSponsoredShelbyTransaction({
        expectedBlobNames: [
          "primegate/content/another-id/asset.bin",
          "primegate/content/another-id/manifest.bin",
        ],
        operation: "shelby-registration",
        senderAuthenticatorHex: sender.signTransactionWithAuthenticator(transaction).bcsToHex().toString(),
        transactionHex: transaction.bcsToHex().toString(),
        walletAddress: sender.accountAddress.toString(),
      }),
    ).toThrow("active PrimeGate publish intent");
  });

  it("rejects a publisher wallet reused as the sponsor account", async () => {
    const { expectedBlobNames, sender, transaction } = await buildSponsoredTransaction();
    const sameAccountTransaction = new MultiAgentTransaction(
      transaction.rawTransaction,
      [sender.accountAddress],
      sender.accountAddress,
    );
    process.env.PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY = sender.privateKey.toString();
    process.env.PRIMEGATE_SHELBY_SPONSOR_ADDRESS = sender.accountAddress.toString();

    expect(() =>
      validateSponsoredShelbyTransaction({
        expectedBlobNames,
        operation: "shelby-registration",
        senderAuthenticatorHex: sender.signTransactionWithAuthenticator(sameAccountTransaction).bcsToHex().toString(),
        transactionHex: sameAccountTransaction.bcsToHex().toString(),
        walletAddress: sender.accountAddress.toString(),
      }),
    ).toThrow("different from the publishing wallet");
  });

  it("accepts a publisher-signed paid listing for the configured registry", () => {
    const { packageId, priceOctas, sender, sponsor, transaction } = buildSponsoredListingTransaction();
    process.env.PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY = sponsor.privateKey.toString();
    process.env.PRIMEGATE_SHELBY_SPONSOR_ADDRESS = sponsor.accountAddress.toString();

    const validated = validateSponsoredPrimeGateListingTransaction({
      expectedPackageId: packageId,
      expectedPriceOctas: priceOctas,
      operation: "primegate-listing",
      senderAuthenticatorHex: sender.signTransactionWithAuthenticator(transaction).bcsToHex().toString(),
      transactionHex: transaction.bcsToHex().toString(),
      walletAddress: sender.accountAddress.toString(),
    });

    expect(validated.transaction.rawTransaction.sender.equals(sender.accountAddress)).toBe(true);
    expect(validated.transaction.rawTransaction.payload).toBeInstanceOf(TransactionPayloadEntryFunction);
  });

  it("accepts sponsor-owned registration and commit data", () => {
    const blobName = "primegate/content/test-id/asset.bin";
    const walletAddress = Account.generate().accountAddress.toString();
    const sponsor = Account.generate();
    process.env.PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY = sponsor.privateKey.toString();
    process.env.PRIMEGATE_SHELBY_SPONSOR_ADDRESS = sponsor.accountAddress.toString();
    const storageAccount = getManagedStorageAccountAddress(walletAddress);

    expect(() =>
      validateServerOwnedShelbyRegistration({
        blobs: [{
          blobMerkleRoot: `0x${"11".repeat(32)}`,
          blobName,
          blobSize: 128,
          numChunksets: 1,
        }],
        encoding: 0,
        expectedBlobNames: [blobName],
        expirationMicros: Date.now() * 1000 + 86_400_000_000,
        operation: "shelby-registration-v2",
        storageAccount,
        walletAddress,
      }),
    ).not.toThrow();

    expect(() =>
      validateServerOwnedShelbyCommit({
        blobName,
        operation: "shelby-commit-v2",
        storageAccount,
        storageProviderAcks: [{ signature: `0x${"22".repeat(64)}`, slot: 0 }],
        uid: "1",
        walletAddress,
      }),
    ).not.toThrow();
  });

  it("assigns stable and isolated managed storage accounts", () => {
    const sponsor = Account.generate();
    const publisher = Account.generate();
    const otherPublisher = Account.generate();
    process.env.PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY = sponsor.privateKey.toString();
    process.env.PRIMEGATE_SHELBY_SPONSOR_ADDRESS = sponsor.accountAddress.toString();

    const first = getManagedStorageAccountAddress(publisher.accountAddress.toString());
    const repeated = getManagedStorageAccountAddress(publisher.accountAddress.toString());
    const other = getManagedStorageAccountAddress(otherPublisher.accountAddress.toString());

    expect(first).toBe(repeated);
    expect(first).not.toBe(other);
    expect(first).not.toBe(sponsor.accountAddress.toStringLong());
  });
});
