import { NextResponse } from "next/server";

export const ALLOWED_IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
export const MAX_UPLOAD_MB = 5;

export function extOk(filename: string): boolean {
  if (!filename.includes(".")) return false;
  return ALLOWED_IMAGE_EXT.has(filename.split(".").pop()!.toLowerCase());
}

/** True if the request Origin is allowed for this bot (empty whitelist = all). */
export function domainAllowed(allowedDomains: string, origin: string): boolean {
  if (!allowedDomains || !allowedDomains.trim()) return true;
  if (!origin) return false;
  let host = "";
  try {
    host = new URL(origin).hostname || "";
  } catch {
    return false;
  }
  host = host.toLowerCase();
  const allowed = allowedDomains.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  return allowed.some((d) => host === d || host.endsWith("." + d));
}

export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** JSON response with permissive CORS — for the public widget endpoints. */
export function corsJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export function corsPreflight(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
