import { ShelbyClient } from "@shelby-protocol/sdk/browser";

import {
  PRIMEGATE_SHELBY_API_KEY,
  PRIMEGATE_SHELBY_BASE_URL,
} from "@/config/web3-constants";
import { PRIMEGATE_SHELBY_APTOS_NETWORK } from "@/config/primegate-network";

export const shelbyClient = new ShelbyClient({
  apiKey: PRIMEGATE_SHELBY_API_KEY || undefined,
  network: PRIMEGATE_SHELBY_APTOS_NETWORK,
  rpc: {
    baseUrl: PRIMEGATE_SHELBY_BASE_URL,
  },
});
