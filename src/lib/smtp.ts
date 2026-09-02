import nodemailer from "nodemailer";
import { updateUser } from "./repo";
import type { IUser } from "./types";

export interface SmtpCreds {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  useTls: boolean;
}

export function smtpCreds(user: IUser): SmtpCreds {
  let port = 587;
  const p = Number(user.smtpPort);
  if (Number.isFinite(p) && p > 0) port = p;
  return {
    host: user.smtpHost || "",
    port,
    username: user.smtpUsername || "",
    password: user.smtpPassword || "",
    fromEmail: user.smtpFromEmail || "",
    useTls: !!user.smtpUseTls,
  };
}

export async function sendSmtpEmailSync(
  creds: SmtpCreds,
  toAddr: string,
  subject: string,
  body: string
): Promise<{ ok: boolean; err: string }> {
  if (!creds.host || !creds.fromEmail || !toAddr) {
    const missing: string[] = [];
    if (!creds.host) missing.push("smtp_host");
    if (!creds.fromEmail) missing.push("smtp_from_email");
    if (!toAddr) missing.push("recipient");
    const err = `SMTP not configured (missing: ${missing.join(", ")})`;
    return { ok: false, err };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: creds.host,
      port: creds.port,
      secure: creds.port === 465, // implicit TLS on 465
      requireTLS: creds.port !== 465 && creds.useTls,
      auth: creds.username ? { user: creds.username, pass: creds.password } : undefined,
      connectionTimeout: 12000,
    });
    await transporter.sendMail({ from: creds.fromEmail, to: toAddr, subject, text: body });
    return { ok: true, err: "" };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, err: msg };
  }
}

async function recordEmailResult(userId: string, toAddr: string, ok: boolean, err: string): Promise<void> {
  const summary = (ok ? `sent to ${toAddr}` : `failed to ${toAddr}: ${err}`).slice(0, 1000);
  try {
    updateUser(userId, { lastEmailAt: new Date(), lastEmailResult: summary });
  } catch (e) {
    console.warn("[smtp] could not record result on user:", e);
  }
}

/** Blocking send used by the Settings test page (synchronous result needed). */
export async function sendSmtpEmail(
  user: IUser & { id?: string },
  toAddr: string,
  subject: string,
  body: string
): Promise<{ ok: boolean; err: string }> {
  const userId = user.id || String(user._id);
  const { ok, err } = await sendSmtpEmailSync(smtpCreds(user), toAddr, subject, body);
  await recordEmailResult(userId, toAddr, ok, err);
  return { ok, err };
}

/** Fire-and-forget — used by contact form + handoff alerts so the HTTP
 *  response isn't held up by slow SMTP. */
export function sendSmtpEmailAsync(
  user: IUser & { id?: string },
  toAddr: string,
  subject: string,
  body: string
): void {
  const userId = user.id || String(user._id);
  const creds = smtpCreds(user);
  void (async () => {
    const { ok, err } = await sendSmtpEmailSync(creds, toAddr, subject, body);
    await recordEmailResult(userId, toAddr, ok, err);
  })();
}
