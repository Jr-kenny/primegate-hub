import { ShelbyClient } from "@shelby-protocol/sdk/browser";

import {
  PRIMEGATE_APTOS_NETWORK,
  PRIMEGATE_SHELBY_API_KEY,
  PRIMEGATE_SHELBY_BASE_URL,
} from "@/config/web3-constants";

export const shelbyClient = new ShelbyClient({
  apiKey: PRIMEGATE_SHELBY_API_KEY || undefined,
  network: PRIMEGATE_APTOS_NETWORK as never,
  rpc: {
    baseUrl: PRIMEGATE_SHELBY_BASE_URL,
  },
});
