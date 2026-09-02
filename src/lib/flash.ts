import { redirect } from "next/navigation";

/** Redirect to `path` carrying a one-shot flash message in the query string.
 *  Mirrors Flask's flash() + redirect pattern. Read with readFlash(). */
export function redirectWithFlash(path: string, message: string, category: "success" | "error" = "success"): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}flash=${encodeURIComponent(message)}&fcat=${category}`);
}

export interface FlashData {
  message: string;
  category: string;
}

export function readFlash(searchParams: Record<string, string | string[] | undefined>): FlashData | null {
  const message = typeof searchParams.flash === "string" ? searchParams.flash : "";
  if (!message) return null;
  const category = typeof searchParams.fcat === "string" ? searchParams.fcat : "success";
  return { message, category };
}
