"use server";

import { requireUser } from "@/lib/auth";
import { getUserById, updateUser } from "@/lib/repo";
import { sendSmtpEmail } from "@/lib/smtp";
import { redirectWithFlash } from "@/lib/flash";

export async function settingsSaveAction(formData: FormData) {
  const user = await requireUser();
  let port = 587;
  const p = Number(formData.get("smtp_port"));
  if (Number.isFinite(p) && p > 0) port = p;
  updateUser(user.id, {
    smtpHost: String(formData.get("smtp_host") || "").trim(),
    smtpUsername: String(formData.get("smtp_username") || "").trim(),
    smtpPassword: String(formData.get("smtp_password") || "").trim(),
    smtpFromEmail: String(formData.get("smtp_from_email") || "").trim(),
    notifyEmail: String(formData.get("notify_email") || "").trim(),
    smtpPort: port,
    smtpUseTls: formData.get("smtp_use_tls") != null,
  });
  redirectWithFlash("/settings", "Settings saved.", "success");
}

export async function smtpTestAction(formData: FormData) {
  const user = await requireUser();
  const fresh = getUserById(user.id);
  if (!fresh) redirectWithFlash("/settings", "User not found.", "error");
  const to = (String(formData.get("to") || "") || fresh!.notifyEmail || fresh!.email).trim();
  if (!to) redirectWithFlash("/settings", "No recipient address.", "error");
  const { ok, err } = await sendSmtpEmail(
    { ...fresh!, id: user.id },
    to,
    "ChatBotAI SMTP test",
    "If you received this, your SMTP settings are working correctly."
  );
  if (ok) redirectWithFlash("/settings", `Test email sent to ${to}.`, "success");
  redirectWithFlash("/settings", `SMTP test failed: ${err}`, "error");
}
