import { ShelbyBlobClient } from "@shelby-protocol/sdk/browser";

type BatchRegisterBlobsParams = Parameters<
  typeof ShelbyBlobClient.createBatchRegisterBlobsPayload
>[0];

export function createPrimeGateBatchRegisterBlobsPayload(
  params: Omit<BatchRegisterBlobsParams, "useSponsoredUsdVariant">,
) {
  return ShelbyBlobClient.createBatchRegisterBlobsPayload({
    ...params,
    useSponsoredUsdVariant: true,
  });
}
