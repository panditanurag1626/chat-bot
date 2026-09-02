"use server";

import { getUserByEmail } from "@/lib/repo";
import { verifyPassword, startSession, destroySession } from "@/lib/auth";
import { accountState } from "@/lib/access";
import { redirectWithFlash } from "@/lib/flash";
import { redirect } from "next/navigation";

/**
 * Public self-registration is disabled — accounts are provisioned by the super
 * admin (Admin → Accounts → New account). This stub keeps the route safe.
 */
export async function registerAction() {
  redirectWithFlash("/login", "Public sign-up is disabled. Please ask your administrator for an account.", "error");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const user = getUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirectWithFlash("/login", "Invalid credentials", "error");
  }
  const state = accountState(user!);
  if (!state.ok) {
    const msg = state.reason === "banned"
      ? "Your account has been suspended. Contact your administrator."
      : "Your subscription has expired. Contact your administrator to renew.";
    redirectWithFlash("/login", msg, "error");
  }
  await startSession(String(user!._id));
  redirect(user!.role === "superadmin" ? "/admin" : "/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
