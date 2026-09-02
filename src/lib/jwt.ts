import { SignJWT, jwtVerify } from "jose";

// Edge-safe JWT helpers (used by both middleware and server code). HS256 with
// AUTH_SECRET — mirrors the role Flask's signed session cookie played.
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-only-secret-change-in-production"
);

export const SESSION_COOKIE = "session";

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifySession(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return (payload.uid as string) || null;
  } catch {
    return null;
  }
}
