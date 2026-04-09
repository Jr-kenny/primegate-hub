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

  if (cacheControl) {
    headers.set("Cache-Control", cacheControl);
  }

  return Response.json(body, {
    ...init,
    headers,
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
