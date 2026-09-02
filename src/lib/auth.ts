import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserById } from "./repo";
import { accountState } from "./access";
import type { IUser } from "./types";
import { SESSION_COOKIE, signSession, verifySession } from "./jwt";

export async function hashPassword(raw: string): Promise<string> {
  return bcrypt.hash(raw, 10);
}

export async function verifyPassword(raw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(raw, hash);
}

/** Set the signed session cookie (login). httpOnly + SameSite=Lax, secure in prod. */
export async function startSession(userId: string): Promise<void> {
  const token = await signSession(userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Returns the logged-in User or null. */
export async function getCurrentUser(): Promise<(IUser & { id: string }) | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const uid = await verifySession(token);
  if (!uid) return null;
  const user = getUserById(uid);
  if (!user) return null;
  return { ...user, id: String(user._id) };
}

/**
 * Server-component / route-handler guard. Redirects to /login if unauthenticated,
 * and bounces banned / expired accounts to a notice page (super admin bypasses).
 */
export async function requireUser(): Promise<IUser & { id: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const state = accountState(user);
  if (!state.ok) redirect(`/suspended?reason=${state.reason}`);
  return user;
}

/** Guard for the super admin area. Redirects non-super-admins away. */
export async function requireSuperAdmin(): Promise<IUser & { id: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "superadmin") redirect("/dashboard");
  return user;
}
