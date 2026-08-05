import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "mpm_session";
const LOCAL_AUTH_SECRET = "mpm-dashboard-local-auth-secret-change-me";

const publicPaths = new Set(["/login"]);

type SessionPayload = {
  exp?: number;
  m?: boolean;
};

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const authSecret = getAuthSecret();
  if (!authSecret) {
    return new NextResponse("AUTH_SECRET must be set in production.", {
      status: 500,
    });
  }

  const session = await readSession(
    request.cookies.get(SESSION_COOKIE)?.value,
    authSecret
  );
  if (!session) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("return_to", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (session.m && pathname !== "/change-password") {
    if (isApiPath(pathname)) {
      return NextResponse.json(
        { error: "Password change required" },
        { status: 403 }
      );
    }

    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sph-assets|window.svg|globe.svg|file.svg).*)",
  ],
};

function isPublicPath(pathname: string) {
  return publicPaths.has(pathname);
}

function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

async function readSession(value: string | undefined, authSecret: string) {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  if ((await createSignature(encodedPayload, authSecret)) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (!payload.exp || payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function createSignature(encodedPayload: string, authSecret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authSecret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encodedPayload)
  );

  return base64UrlFromBytes(new Uint8Array(signature));
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return LOCAL_AUTH_SECRET;
}

function base64UrlDecode(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64);
}

function base64UrlFromBytes(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
