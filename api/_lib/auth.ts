import { createHmac, timingSafeEqual } from "node:crypto";
import {
  Aptos,
  AptosConfig,
  AccountAddress,
  AccountPublicKey,
  Ed25519PublicKey,
  Ed25519Signature,
  Hex,
  MultiEd25519PublicKey,
  MultiEd25519Signature,
  MultiKey,
  MultiKeySignature,
  type PublicKey,
  type Signature,
  deserializePublicKey,
  deserializeSignature,
} from "@aptos-labs/ts-sdk";
import {
  deserializeSignInOutput,
  generateNonce,
  verifySignInMessage,
  verifySignInSignature,
  type SerializedAptosSignInOutput,
} from "@aptos-labs/siwa";

import { getSql } from "./database.js";
import {
  PRIMEGATE_APTOS_CHAIN_ID,
  PRIMEGATE_APTOS_NETWORK,
  PRIMEGATE_APTOS_NUMERIC_CHAIN_ID,
} from "../../src/config/primegate-network.js";
import { readPrimeGateEnvValue } from "../../src/lib/primegate-env.js";

const PRIMEGATE_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const PRIMEGATE_SIGN_IN_TTL_MS = 1000 * 60 * 5;
const PRIMEGATE_SIGN_IN_COOKIE = "primegate-siwa-input";
const PRIMEGATE_SIGN_MESSAGE_COOKIE = "primegate-sign-message-input";
const PRIMEGATE_SESSION_COOKIE = "primegate-session";
const PRIMEGATE_SIGN_IN_STATEMENT = "Sign in to PrimeGate.";
const SIWA_VERSION = "1";
const PRIMEGATE_MESSAGE_AUTH_CHAIN_IDS = new Set([
  1,
  2,
  PRIMEGATE_APTOS_NUMERIC_CHAIN_ID,
]);

const aptos = new Aptos(
  new AptosConfig({
    network: PRIMEGATE_APTOS_NETWORK,
  }),
);

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

type SessionClaims = {
  exp: number;
  iat: number;
  keyType: string;
  publicKeyHex: string;
  walletAddress: string;
};

type AptosSignInInput = {
  address?: string;
  chainId?: string;
  domain?: string;
  expirationTime?: string;
  issuedAt?: string;
  nonce?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
  statement?: string;
  uri?: string;
  version?: string;
};

type PrimeGateSignInInput = AptosSignInInput & {
  address: string;
  chainId: string;
  domain: string;
  nonce: string;
  version: string;
};

type PrimeGateSignMessageInput = {
  application: string;
  chainId: number;
  message: string;
  nonce: string;
  walletAddress: string;
};

type VerifyWalletMessagePayload = {
  address: string;
  application?: string;
  bitmap?: number[];
  chainId?: number;
  fullMessage: string;
  message: string;
  minKeysRequired?: number;
  nonce: string;
  prefix: string;
  publicKey: string | string[];
  signature: string | string[];
  walletAddress: string;
};

function getSessionSecret() {
  const secret = readPrimeGateEnvValue(process.env.PRIMEGATE_SESSION_SECRET);
  if (!secret) {
    throw new Error("PRIMEGATE_SESSION_SECRET is not configured.");
  }

  return secret;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function normalizeWalletAddress(address: string) {
  return AccountAddress.from(address).toStringLong().toLowerCase();
}

function normalizeHex(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("0x") ? normalized : `0x${normalized}`;
}

function getHexByteLength(value: string) {
  return Hex.fromHexInput(value).toUint8Array().length;
}

function parseSingleWalletPublicKey(value: string) {
  const normalized = normalizeHex(value);

  try {
    return deserializePublicKey(normalized);
  } catch {
    if (getHexByteLength(normalized) === 32) {
      return new Ed25519PublicKey(normalized);
    }

    throw new AuthError("Wallet message-sign public key format is invalid.");
  }
}

function parseWalletPublicKey(value: string | string[], minKeysRequired?: number) {
  if (!Array.isArray(value)) {
    const publicKey = parseSingleWalletPublicKey(value);
    return publicKey instanceof AccountPublicKey ? publicKey : null;
  }

  if (value.length === 0) {
    throw new AuthError("Wallet message-sign public key format is invalid.");
  }

  if (!Number.isInteger(minKeysRequired) || minKeysRequired < 1) {
    throw new AuthError("Wallet message-sign public key threshold is invalid.");
  }

  const publicKeys = value.map((entry) => parseSingleWalletPublicKey(entry));
  try {
    if (publicKeys.every((entry): entry is Ed25519PublicKey => entry instanceof Ed25519PublicKey)) {
      return new MultiEd25519PublicKey({
        publicKeys,
        threshold: minKeysRequired,
      });
    }

    return new MultiKey({
      publicKeys: publicKeys as PublicKey[],
      signaturesRequired: minKeysRequired,
    });
  } catch {
    throw new AuthError("Wallet message-sign public key format is invalid.");
  }
}

function parseSingleWalletSignature(value: string) {
  const normalized = normalizeHex(value);

  try {
    return deserializeSignature(normalized);
  } catch {
    if (normalized.startsWith("0x40") && getHexByteLength(normalized) === 65) {
      return new Ed25519Signature(`0x${normalized.slice(4)}`);
    }

    if (getHexByteLength(normalized) === 64) {
      return new Ed25519Signature(normalized);
    }

    throw new AuthError("Wallet message-sign signature format is invalid.");
  }
}

function parseWalletSignature(value: string | string[], bitmap?: number[]) {
  if (!Array.isArray(value)) {
    return parseSingleWalletSignature(value);
  }

  if (value.length === 0 || !bitmap?.length) {
    throw new AuthError("Wallet message-sign signature format is invalid.");
  }

  const signatures = value.map((entry) => parseSingleWalletSignature(entry));
  try {
    if (signatures.every((entry): entry is Ed25519Signature => entry instanceof Ed25519Signature)) {
      return new MultiEd25519Signature({
        bitmap,
        signatures,
      });
    }

    return new MultiKeySignature({
      bitmap,
      signatures: signatures as Signature[],
    });
  } catch {
    throw new AuthError("Wallet message-sign signature format is invalid.");
  }
}

function serializeAccountPublicKey(publicKey: AccountPublicKey) {
  if ("bcsToHex" in publicKey && typeof publicKey.bcsToHex === "function") {
    return normalizeHex(publicKey.bcsToHex().toString());
  }

  return normalizeHex(publicKey.toString());
}

function deriveWalletAddressFromPublicKey(publicKey: AccountPublicKey) {
  return publicKey.authKey().derivedAddress().toStringLong().toLowerCase();
}

function parseCookies(request: Request) {
  const header = request.headers.get("cookie");
  if (!header) {
    return new Map<string, string>();
  }

  return new Map(
    header
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf("=");
        if (separatorIndex === -1) {
          return [entry, ""];
        }

        return [
          entry.slice(0, separatorIndex),
          decodeURIComponent(entry.slice(separatorIndex + 1)),
        ];
      }),
  );
}

function serializeCookie(
  name: string,
  value: string,
  options?: {
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    sameSite?: "Lax" | "Strict" | "None";
    secure?: boolean;
  },
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options?.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  parts.push(`Path=${options?.path ?? "/"}`);
  parts.push(`SameSite=${options?.sameSite ?? "Lax"}`);

  if (options?.httpOnly ?? true) {
    parts.push("HttpOnly");
  }

  if (options?.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function getRequestOrigin(request: Request) {
  const originHeader = request.headers.get("origin")?.trim();
  if (originHeader) {
    return originHeader.replace(/\/$/, "");
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const requestUrl = new URL(request.url);
  const protocol = forwardedProto ?? requestUrl.protocol.replace(/:$/, "");
  const originHost = host ?? requestUrl.host;

  return `${protocol}://${originHost}`;
}

function getRequestDomain(request: Request) {
  const origin = new URL(getRequestOrigin(request));
  return origin.host;
}

function getCookieSecurity(request: Request) {
  const origin = new URL(getRequestOrigin(request));
  return origin.protocol === "https:";
}

function buildPrimeGateSession(walletAddress: string, keyType: string, publicKeyHex: string) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + PRIMEGATE_SESSION_TTL_MS;
  const claims: SessionClaims = {
    exp: expiresAt,
    iat: issuedAt,
    keyType,
    publicKeyHex,
    walletAddress,
  };

  return {
    session: {
      expiresAt: new Date(expiresAt).toISOString(),
      keyType: claims.keyType,
      publicKeyHex: claims.publicKeyHex,
      token: createSessionToken(claims),
      walletAddress: claims.walletAddress,
    },
  };
}

function getPublicKeyKind(publicKey: AccountPublicKey) {
  return publicKey.constructor.name;
}

function createSessionToken(claims: SessionClaims) {
  const payload = encodeBase64Url(JSON.stringify(claims));
  const signature = signValue(payload);
  return `${payload}.${signature}`;
}

function createPrimeGateSignInInput(request: Request, walletAddress: string) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + PRIMEGATE_SIGN_IN_TTL_MS);
  const origin = getRequestOrigin(request);

  const input: PrimeGateSignInInput = {
    address: normalizedWalletAddress,
    chainId: PRIMEGATE_APTOS_CHAIN_ID,
    domain: getRequestDomain(request),
    issuedAt: issuedAt.toISOString(),
    nonce: generateNonce(),
    statement: PRIMEGATE_SIGN_IN_STATEMENT,
    uri: origin,
    version: SIWA_VERSION,
  };

  return {
    expiresAt: expiresAt.toISOString(),
    input: {
      ...input,
      expirationTime: expiresAt.toISOString(),
    },
  };
}

function getSignInInputCookie(request: Request) {
  const rawCookie = parseCookies(request).get(PRIMEGATE_SIGN_IN_COOKIE);
  if (!rawCookie) {
    throw new AuthError("PrimeGate sign-in challenge was not found.", 400);
  }

  const parsed = JSON.parse(rawCookie) as PrimeGateSignInInput;

  if (!parsed.nonce || !parsed.domain || !parsed.address || !parsed.chainId || !parsed.version) {
    throw new AuthError("PrimeGate sign-in challenge is invalid.", 400);
  }

  return parsed;
}

function getSignMessageInputCookie(request: Request) {
  const rawCookie = parseCookies(request).get(PRIMEGATE_SIGN_MESSAGE_COOKIE);
  if (!rawCookie) {
    throw new AuthError("PrimeGate message-sign challenge was not found.", 400);
  }

  const parsed = JSON.parse(rawCookie) as PrimeGateSignMessageInput;

  if (
    !parsed.application ||
    !Number.isInteger(parsed.chainId) ||
    !parsed.message ||
    !parsed.nonce ||
    !parsed.walletAddress
  ) {
    throw new AuthError("PrimeGate message-sign challenge is invalid.", 400);
  }

  if (!PRIMEGATE_MESSAGE_AUTH_CHAIN_IDS.has(parsed.chainId)) {
    throw new AuthError("PrimeGate message-sign challenge network is not supported.", 400);
  }

  return parsed;
}

function normalizePrimeGateMessageAuthChainId(chainId?: number | null) {
  if (chainId === undefined || chainId === null) {
    return PRIMEGATE_APTOS_NUMERIC_CHAIN_ID;
  }

  if (!Number.isInteger(chainId) || !PRIMEGATE_MESSAGE_AUTH_CHAIN_IDS.has(chainId)) {
    throw new AuthError("PrimeGate message-sign network is not supported.", 400);
  }

  return chainId;
}

function getVerificationErrorMessage(result: { valid: boolean; errors?: string[] }) {
  return result.valid ? "Verification failed." : result.errors?.join(", ") || "Verification failed.";
}

async function storePrimeGateSignMessageChallenge(input: PrimeGateSignMessageInput, expiresAt: Date) {
  const sql = getSql();
  if (!sql) {
    throw new AuthError("PrimeGate wallet authentication requires a configured database.", 503);
  }

  await sql`
    insert into wallet_auth_nonces (wallet_address, nonce, message, expires_at)
    values (${input.walletAddress}, ${input.nonce}, ${input.message}, ${expiresAt.toISOString()})
    on conflict (wallet_address, nonce) do nothing
  `;
}

async function getPrimeGateSignMessageChallenge(walletAddress: string, nonce: string) {
  const sql = getSql();
  if (!sql) {
    throw new AuthError("PrimeGate wallet authentication requires a configured database.", 503);
  }

  const rows = (await sql`
    select wallet_address, nonce, message
    from wallet_auth_nonces
    where lower(wallet_address) = lower(${walletAddress})
      and nonce = ${nonce}
      and consumed_at is null
      and expires_at > now()
    limit 1
  `) as Array<{ message: string; nonce: string; wallet_address: string }>;

  const challenge = rows[0];
  if (!challenge) {
    throw new AuthError("PrimeGate message-sign challenge was not found, expired, or already used.", 400);
  }

  return {
    message: challenge.message,
    nonce: challenge.nonce,
    walletAddress: normalizeWalletAddress(challenge.wallet_address),
  };
}

async function consumePrimeGateSignMessageChallenge(walletAddress: string, nonce: string) {
  const sql = getSql();
  if (!sql) {
    throw new AuthError("PrimeGate wallet authentication requires a configured database.", 503);
  }

  const rows = (await sql`
    update wallet_auth_nonces
    set consumed_at = now()
    where lower(wallet_address) = lower(${walletAddress})
      and nonce = ${nonce}
      and consumed_at is null
      and expires_at > now()
    returning nonce
  `) as unknown as Array<{ nonce: string }>;

  if (rows.length === 0) {
    throw new AuthError("PrimeGate message-sign challenge was already used or expired.", 400);
  }
}

function buildPrimeGateSignMessages(
  address: string,
  input: Pick<PrimeGateSignMessageInput, "application" | "chainId" | "message" | "nonce">,
) {
  return [
    [
      "APTOS",
      `address: ${address}`,
      `application: ${input.application}`,
      `chainId: ${input.chainId}`,
      `message: ${input.message}`,
      `nonce: ${input.nonce}`,
    ].join("\n"),
    [
      "APTOS",
      `address: ${address}`,
      `application: ${input.application}`,
      `chain_id: ${input.chainId}`,
      `message: ${input.message}`,
      `nonce: ${input.nonce}`,
    ].join("\n"),
    [
      "APTOS",
      `address: ${address}`,
      `chain_id: ${input.chainId}`,
      `application: ${input.application}`,
      `nonce: ${input.nonce}`,
      `message: ${input.message}`,
    ].join("\n"),
  ];
}

function isExpectedPrimeGateSignMessage(
  fullMessage: string,
  address: string,
  input: Pick<PrimeGateSignMessageInput, "application" | "chainId" | "message" | "nonce">,
) {
  return buildPrimeGateSignMessages(address, input).some((expectedMessage) => expectedMessage === fullMessage);
}

export function createPrimeGateSignInResponse(request: Request, walletAddress: string) {
  const { expiresAt, input } = createPrimeGateSignInInput(request, walletAddress);
  const secure = getCookieSecurity(request);

  return {
    cookie: serializeCookie(PRIMEGATE_SIGN_IN_COOKIE, JSON.stringify(input), {
      httpOnly: true,
      maxAge: Math.floor(PRIMEGATE_SIGN_IN_TTL_MS / 1000),
      sameSite: "Lax",
      secure,
    }),
    payload: {
      expiresAt,
      input,
      walletAddress: input.address,
    },
  };
}

export function clearPrimeGateSignInCookie(request: Request) {
  return serializeCookie(PRIMEGATE_SIGN_IN_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    sameSite: "Lax",
    secure: getCookieSecurity(request),
  });
}

export async function createPrimeGateSignMessageResponse(
  request: Request,
  walletAddress: string,
  chainId?: number,
) {
  const input: PrimeGateSignMessageInput = {
    application: getRequestOrigin(request),
    chainId: normalizePrimeGateMessageAuthChainId(chainId),
    message: PRIMEGATE_SIGN_IN_STATEMENT,
    nonce: generateNonce(),
    walletAddress: normalizeWalletAddress(walletAddress),
  };
  const expiresAt = new Date(Date.now() + PRIMEGATE_SIGN_IN_TTL_MS);

  await storePrimeGateSignMessageChallenge(input, expiresAt);

  return {
    cookie: serializeCookie(PRIMEGATE_SIGN_MESSAGE_COOKIE, JSON.stringify(input), {
      httpOnly: true,
      maxAge: Math.floor(PRIMEGATE_SIGN_IN_TTL_MS / 1000),
      sameSite: "Lax",
      secure: getCookieSecurity(request),
    }),
    payload: input,
  };
}

export function clearPrimeGateSignMessageCookie(request: Request) {
  return serializeCookie(PRIMEGATE_SIGN_MESSAGE_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    sameSite: "Lax",
    secure: getCookieSecurity(request),
  });
}

export function createPrimeGateSessionCookie(request: Request, token: string) {
  return serializeCookie(PRIMEGATE_SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: Math.floor(PRIMEGATE_SESSION_TTL_MS / 1000),
    sameSite: "Lax",
    secure: getCookieSecurity(request),
  });
}

export function clearPrimeGateSessionCookie(request: Request) {
  return serializeCookie(PRIMEGATE_SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    sameSite: "Lax",
    secure: getCookieSecurity(request),
  });
}

export function verifySessionToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    throw new AuthError("Session token is malformed.");
  }

  const expectedSignature = signValue(payload);
  const actual = Buffer.from(signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new AuthError("Session token signature is invalid.");
  }

  const claims = JSON.parse(decodeBase64Url(payload)) as SessionClaims;

  if (!claims.walletAddress || !claims.publicKeyHex || !claims.keyType || !claims.exp) {
    throw new AuthError("Session token payload is invalid.");
  }

  if (claims.exp <= Date.now()) {
    throw new AuthError("Session token has expired.");
  }

  return claims;
}

export async function verifyWalletSession(
  request: Request,
  serializedOutput: SerializedAptosSignInOutput,
) {
  const expectedInput = getSignInInputCookie(request);
  const output = await deserializeSignInOutput(serializedOutput);
  const siwaOptions = {
    aptos: aptos as unknown as Parameters<typeof verifySignInMessage>[1]["aptos"],
  };

  const signatureVerification = await verifySignInSignature(output, siwaOptions);
  if (!signatureVerification.valid) {
    throw new AuthError(getVerificationErrorMessage(signatureVerification));
  }

  const messageVerification = await verifySignInMessage(
    {
      expected: expectedInput,
      input: output.input,
      publicKey: output.publicKey,
    },
    siwaOptions,
  );

  if (!messageVerification.valid) {
    throw new AuthError(getVerificationErrorMessage(messageVerification));
  }

  const walletAddress = normalizeWalletAddress(output.input.address);
  return buildPrimeGateSession(walletAddress, output.type, normalizeHex(serializedOutput.publicKey));
}

export async function verifyWalletMessageSession(
  request: Request,
  payload: VerifyWalletMessagePayload,
) {
  const walletAddress = normalizeWalletAddress(payload.walletAddress);
  const responseAddress = normalizeWalletAddress(payload.address);
  const storedChallenge = await getPrimeGateSignMessageChallenge(walletAddress, payload.nonce);
  const challengeInput = getSignMessageInputCookie(request);
  const expectedChainId = normalizePrimeGateMessageAuthChainId(challengeInput.chainId);
  const expectedInput: PrimeGateSignMessageInput = {
    application: getRequestOrigin(request),
    chainId: expectedChainId,
    message: storedChallenge.message,
    nonce: storedChallenge.nonce,
    walletAddress: storedChallenge.walletAddress,
  };

  if (walletAddress !== expectedInput.walletAddress) {
    throw new AuthError("Wallet message-sign address does not match the requested wallet.");
  }

  if (responseAddress !== expectedInput.walletAddress) {
    throw new AuthError("Wallet message-sign response address does not match the requested wallet.");
  }

  if (payload.application !== expectedInput.application) {
    throw new AuthError("Wallet message-sign application does not match the expected challenge.");
  }

  if (challengeInput.application !== expectedInput.application) {
    throw new AuthError("Wallet message-sign application does not match the expected challenge.");
  }

  if (challengeInput.chainId !== expectedInput.chainId) {
    throw new AuthError("Wallet message-sign chain ID does not match the requested network.");
  }

  if (challengeInput.walletAddress !== expectedInput.walletAddress) {
    throw new AuthError("Wallet message-sign address does not match the requested wallet.");
  }

  if (challengeInput.message !== expectedInput.message) {
    throw new AuthError("Wallet message-sign message does not match the expected challenge.");
  }

  if (challengeInput.nonce !== expectedInput.nonce) {
    throw new AuthError("Wallet message-sign nonce does not match the expected challenge.");
  }

  if (payload.chainId !== expectedInput.chainId) {
    throw new AuthError("Wallet message-sign chain ID does not match the expected network.");
  }

  if (payload.message !== expectedInput.message) {
    throw new AuthError("Wallet message-sign message does not match the expected challenge.");
  }

  if (payload.nonce !== expectedInput.nonce) {
    throw new AuthError("Wallet message-sign nonce does not match the expected challenge.");
  }

  if (payload.prefix !== "APTOS") {
    throw new AuthError("Wallet message-sign prefix is invalid.");
  }

  if (!isExpectedPrimeGateSignMessage(payload.fullMessage, payload.address, expectedInput)) {
    throw new AuthError("Wallet message-sign full message does not match the expected challenge.");
  }

  const publicKey = parseWalletPublicKey(payload.publicKey, payload.minKeysRequired);
  if (!(publicKey instanceof AccountPublicKey)) {
    throw new AuthError("Wallet message-sign public key type is invalid.");
  }

  if (deriveWalletAddressFromPublicKey(publicKey) !== responseAddress) {
    throw new AuthError("Wallet message-sign public key does not match the signed wallet address.");
  }

  const signature = parseWalletSignature(payload.signature, payload.bitmap);
  const verified = await publicKey.verifySignatureAsync({
    aptosConfig: aptos.config,
    message: new TextEncoder().encode(payload.fullMessage),
    signature,
  });

  if (!verified) {
    throw new AuthError("Wallet message-sign signature is invalid.");
  }

  await consumePrimeGateSignMessageChallenge(walletAddress, storedChallenge.nonce);

  return buildPrimeGateSession(
    responseAddress,
    getPublicKeyKind(publicKey),
    serializeAccountPublicKey(publicKey),
  );
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return parseCookies(request).get(PRIMEGATE_SESSION_COOKIE) ?? null;
}

export function requireAuthenticatedWallet(request: Request, walletAddress?: string | null) {
  const token = getBearerToken(request);
  if (!token) {
    throw new AuthError("Wallet session is required.");
  }

  const claims = verifySessionToken(token);
  if (walletAddress && claims.walletAddress !== normalizeWalletAddress(walletAddress)) {
    throw new AuthError("Wallet session does not match the requested wallet address.");
  }

  return claims;
}

export function getAuthenticatedWallet(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}
