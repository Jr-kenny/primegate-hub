import { AccountAddress, type AccountAddressInput } from "@aptos-labs/ts-sdk";

export function normalizeAptosAddress(address: AccountAddressInput): string {
  return AccountAddress.from(address).toStringLong().toLowerCase();
}
