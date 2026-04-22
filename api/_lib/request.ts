export function getPathParam(request: Request) {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  return decodeURIComponent(segments.at(-1) ?? "");
}

export function jsonResponse(
  body: unknown,
  init?: ResponseInit,
  cacheControl?: string,
) {
  const headers = new Headers(init?.headers);

  if (!headers.has("X-Content-Type-Options")) {
    headers.set("X-Content-Type-Options", "nosniff");
  }

  if (!headers.has("X-Frame-Options")) {
    headers.set("X-Frame-Options", "DENY");
  }

  if (!headers.has("Referrer-Policy")) {
    headers.set("Referrer-Policy", "no-referrer");
  }

  if (!headers.has("Permissions-Policy")) {
    headers.set("Permissions-Policy", "interest-cohort=()");
  }

  if (cacheControl) {
    headers.set("Cache-Control", cacheControl);
  }

  if (!headers.has("Cache-Control") && headers.has("Set-Cookie")) {
    headers.set("Cache-Control", "no-store");
  }

  return Response.json(body, {
    ...init,
    headers,
  });
}

export function errorResponse(
  message: string,
  status: number,
  init?: Omit<ResponseInit, "status">,
) {
  return jsonResponse(
    {
      error: message,
    },
    {
      ...init,
      status,
    },
  );
}

export function methodNotAllowed(methods: string[]) {
  return errorResponse("Method not allowed.", 405, {
    headers: {
      Allow: methods.join(", "),
    },
  });
}

export function getRequestOrigin(request: Request) {
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

export function toAbsoluteUrl(request: Request, path: string) {
  return `${getRequestOrigin(request)}${path.startsWith("/") ? path : `/${path}`}`;
}
