"use server";

import { createHmac, pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db";
import { randomId } from "../db/id";
import { appLoginAttempts, appUsers } from "../db/schema";

const pbkdf2Async = promisify(pbkdf2);
const SESSION_COOKIE = "mpm_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const LOGIN_RATE_LIMIT_MAX_FAILURES = 5;
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = "sha256";
const LOCAL_AUTH_SECRET = "mpm-dashboard-local-auth-secret-change-me";

type UserRole = "superadmin" | "user";

export type AuthUser = {
  id: string;
  mustChangePassword: boolean;
  role: UserRole;
  username: string;
};

type SessionPayload = {
  exp: number;
  iat: number;
  m: boolean;
  r: UserRole;
  u: string;
};

const defaultUsers: Array<{
  password: string;
  role: UserRole;
  username: string;
}> = [
  { password: "Arestriputr4!", role: "superadmin", username: "superadmin" },
  { password: "password", role: "user", username: "guntur" },
  { password: "password", role: "user", username: "sisi" },
  { password: "password", role: "user", username: "egha" },
];

export async function ensureDefaultUsers() {
  const db = await getDb();

  for (const user of defaultUsers) {
    const existing = await db.query.appUsers.findFirst({
      where: eq(appUsers.username, user.username),
    });

    if (existing) {
      continue;
    }

    await db.insert(appUsers).values({
      id: randomId(),
      mustChangePassword: true,
      passwordHash: await hashPassword(user.password),
      role: user.role,
      username: user.username,
    });
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const session = await readSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) {
    return null;
  }

  const db = await getDb();
  const user = await db.query.appUsers.findFirst({
    where: eq(appUsers.username, session.u),
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    mustChangePassword: user.mustChangePassword,
    role: user.role,
    username: user.username,
  };
}

export async function requireUser(returnTo = "/dashboard") {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?return_to=${encodeURIComponent(returnTo)}`);
  }

  if (user.mustChangePassword && returnTo !== "/change-password") {
    redirect("/change-password");
  }

  return user;
}

export async function requireSuperadmin() {
  const user = await requireUser("/admin/users");
  if (user.role !== "superadmin") {
    redirect("/dashboard");
  }

  return user;
}

export async function authenticateUser(username: string, password: string) {
  await ensureDefaultUsers();

  const db = await getDb();
  const normalizedUsername = normalizeUsername(username);
  const ipAddress = await getRequestIp();

  if (await isLoginRateLimited(normalizedUsername, ipAddress)) {
    return {
      message: "Terlalu banyak percobaan login gagal. Coba lagi dalam 15 menit.",
      ok: false,
      user: null,
    };
  }

  const user = await db.query.appUsers.findFirst({
    where: eq(appUsers.username, normalizedUsername),
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await recordFailedLogin(normalizedUsername, ipAddress);
    return {
      message: "Username atau password tidak sesuai.",
      ok: false,
      user: null,
    };
  }

  const authUser: AuthUser = {
    id: user.id,
    mustChangePassword: user.mustChangePassword,
    role: user.role,
    username: user.username,
  };
  await clearFailedLogins(normalizedUsername, ipAddress);
  await setSessionCookie(authUser);

  return { message: "", ok: true, user: authUser };
}

export async function updateOwnPassword(
  user: AuthUser,
  currentPassword: string,
  newPassword: string
) {
  const db = await getDb();
  const storedUser = await db.query.appUsers.findFirst({
    where: eq(appUsers.id, user.id),
  });

  if (!storedUser || !(await verifyPassword(currentPassword, storedUser.passwordHash))) {
    return { ok: false, message: "Password lama tidak sesuai." };
  }

  const validation = validateNewPassword(newPassword);
  if (validation) {
    return { ok: false, message: validation };
  }

  await db
    .update(appUsers)
    .set({
      mustChangePassword: false,
      passwordHash: await hashPassword(newPassword),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(appUsers.id, user.id));

  await setSessionCookie({ ...user, mustChangePassword: false });

  return { ok: true, message: "" };
}

export async function setUserPassword(
  targetUserId: string,
  newPassword: string
) {
  const validation = validateNewPassword(newPassword);
  if (validation) {
    return { ok: false, message: validation };
  }

  const db = await getDb();
  await db
    .update(appUsers)
    .set({
      mustChangePassword: true,
      passwordHash: await hashPassword(newPassword),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(appUsers.id, targetUserId));

  return { ok: true, message: "" };
}

export async function listUsers() {
  await ensureDefaultUsers();
  const db = await getDb();

  return db
    .select({
      createdAt: appUsers.createdAt,
      id: appUsers.id,
      mustChangePassword: appUsers.mustChangePassword,
      role: appUsers.role,
      updatedAt: appUsers.updatedAt,
      username: appUsers.username,
    })
    .from(appUsers)
    .orderBy(appUsers.username);
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function setSessionCookie(user: AuthUser) {
  const cookieStore = await cookies();
  const payload: SessionPayload = {
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
    iat: Date.now(),
    m: user.mustChangePassword,
    r: user.role,
    u: user.username,
  };
  cookieStore.set(SESSION_COOKIE, await signSession(payload), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function readSession(value: string | undefined) {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = createSignature(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
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

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const key = await pbkdf2Async(
    password,
    salt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST
  );

  return [
    "pbkdf2",
    PASSWORD_DIGEST,
    PASSWORD_ITERATIONS,
    salt,
    key.toString("base64url"),
  ].join("$");
}

async function verifyPassword(password: string, passwordHash: string) {
  const [scheme, digest, iterations, salt, storedKey] = passwordHash.split("$");
  if (scheme !== "pbkdf2" || digest !== PASSWORD_DIGEST || !salt || !storedKey) {
    return false;
  }

  const key = await pbkdf2Async(
    password,
    salt,
    Number(iterations),
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST
  );
  const storedBuffer = Buffer.from(storedKey, "base64url");

  return (
    key.length === storedBuffer.length &&
    timingSafeEqual(key, storedBuffer)
  );
}

function validateNewPassword(password: string) {
  if (password.length < 6) {
    return "Password baru minimal 6 karakter.";
  }

  return "";
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

async function signSession(payload: SessionPayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${createSignature(encodedPayload)}`;
}

function createSignature(encodedPayload: string) {
  return createHmac("sha256", getAuthSecret())
    .update(encodedPayload)
    .digest("base64url");
}

async function isLoginRateLimited(username: string, ipAddress: string) {
  const db = await getDb();
  const cutoff = new Date(Date.now() - LOGIN_RATE_LIMIT_WINDOW_MS).toISOString();

  await db
    .delete(appLoginAttempts)
    .where(lt(appLoginAttempts.attemptedAt, cutoff));

  const recentFailures = await db
    .select({ id: appLoginAttempts.id })
    .from(appLoginAttempts)
    .where(
      and(
        eq(appLoginAttempts.username, username),
        eq(appLoginAttempts.ipAddress, ipAddress),
        eq(appLoginAttempts.success, false),
        gt(appLoginAttempts.attemptedAt, cutoff)
      )
    );

  return recentFailures.length >= LOGIN_RATE_LIMIT_MAX_FAILURES;
}

async function recordFailedLogin(username: string, ipAddress: string) {
  const db = await getDb();
  await db.insert(appLoginAttempts).values({
    id: randomId(),
    ipAddress,
    success: false,
    username,
  });
}

async function clearFailedLogins(username: string, ipAddress: string) {
  const db = await getDb();
  await db
    .delete(appLoginAttempts)
    .where(
      and(
        eq(appLoginAttempts.username, username),
        eq(appLoginAttempts.ipAddress, ipAddress),
        eq(appLoginAttempts.success, false)
      )
    );
}

async function getRequestIp() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const ip =
    requestHeaders.get("cf-connecting-ip") ??
    requestHeaders.get("x-real-ip") ??
    forwardedFor?.split(",")[0]?.trim();

  return ip || "unknown";
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set in production.");
  }

  return LOCAL_AUTH_SECRET;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}
