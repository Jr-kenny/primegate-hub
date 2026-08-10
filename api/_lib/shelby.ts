import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";
import {
  PRIMEGATE_SHELBY_APTOS_NETWORK,
  PRIMEGATE_DEFAULT_SHELBY_RPC_BASE_URL,
} from "../../src/config/primegate-network.js";
import { readPrimeGateEnvValue } from "../../src/lib/primegate-env.js";

const PRIMEGATE_DEFAULT_APP_ORIGIN = "https://primegatelive.vercel.app";

export function getShelbyRpcBaseUrl() {
  return (
    readPrimeGateEnvValue(process.env.SHELBY_RPC_BASE_URL) ||
    readPrimeGateEnvValue(process.env.VITE_SHELBY_RPC_BASE_URL) ||
    PRIMEGATE_DEFAULT_SHELBY_RPC_BASE_URL
  );
}

export function getShelbyApiKey() {
  return (
    readPrimeGateEnvValue(process.env.SHELBY_API_KEY) ||
    readPrimeGateEnvValue(process.env.VITE_SHELBY_API_KEY) ||
    undefined
  );
}

export function getShelbyRequestOrigin() {
  const configuredOrigin =
    readPrimeGateEnvValue(process.env.PRIMEGATE_APP_ORIGIN) ||
    readPrimeGateEnvValue(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    PRIMEGATE_DEFAULT_APP_ORIGIN;

  return configuredOrigin.startsWith("http://") || configuredOrigin.startsWith("https://")
    ? configuredOrigin
    : `https://${configuredOrigin}`;
}

function encodeShelbyBlobName(blobName: string) {
  return blobName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export async function downloadShelbyBlob({
  account,
  blobName,
  range,
}: {
  account: string;
  blobName: string;
  range?: { end?: number; start: number };
}) {
  const baseUrl = getShelbyRpcBaseUrl().replace(/\/$/, "");
  const url = `${baseUrl}/v1/blobs/${encodeURIComponent(account)}/${encodeShelbyBlobName(blobName)}`;
  const headers: Record<string, string> = { Origin: getShelbyRequestOrigin() };
  const apiKey = getShelbyApiKey();

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  if (range) {
    headers.Range = `bytes=${range.start}-${range.end ?? ""}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download blob: ${response.status} ${response.statusText}`);
  }

  return { readable: response.body };
}

let shelbyClient: ShelbyNodeClient | null = null;

export function getShelbyClient() {
  if (!shelbyClient) {
    shelbyClient = new ShelbyNodeClient({
      apiKey: getShelbyApiKey(),
      aptos: {
        fullnodeConfig: {
          HEADERS: {
            Origin: getShelbyRequestOrigin(),
          },
        },
      },
      network: PRIMEGATE_SHELBY_APTOS_NETWORK,
      rpc: {
        baseUrl: getShelbyRpcBaseUrl(),
      },
    });
  }

  return shelbyClient;
}
