import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getUserById } from "@/lib/repo";
import { settingsSaveAction, smtpTestAction } from "@/app/actions/settings";
import PasswordInput from "@/components/PasswordInput";
import Flash from "@/components/Flash";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sessionUser = await requireUser();
  const user = getUserById(sessionUser.id)!;
  const isFail = user.lastEmailResult && user.lastEmailResult.startsWith("failed");

  return (
    <>
      <Link className="muted" href="/dashboard"><i className="fa-solid fa-arrow-left" /> Back to dashboard</Link>
      <div className="page-head"><h1><i className="fa-solid fa-gear" /> Settings</h1></div>
      <Flash searchParams={sp} />

      <section className="panel">
        <h2>SMTP &amp; notifications</h2>
        <p className="muted">Configure outbound email so you get notified when a visitor requests a live agent.</p>

        <form action={settingsSaveAction}>
          <fieldset>
            <legend>Where to send alerts</legend>
            <label>Notification email (your inbox)
              <input type="email" name="notify_email" defaultValue={user.notifyEmail} placeholder="you@example.com" />
            </label>
          </fieldset>

          <fieldset>
            <legend>SMTP server</legend>
            <div className="two-col-grid">
              <label>SMTP host <input name="smtp_host" defaultValue={user.smtpHost} placeholder="smtp.gmail.com" /></label>
              <label>SMTP port <input name="smtp_port" type="number" min={1} max={65535} defaultValue={user.smtpPort || 587} placeholder="587" /></label>
              <label>Username <input name="smtp_username" defaultValue={user.smtpUsername} placeholder="you@gmail.com" /></label>
              <label>Password / App password
                <PasswordInput name="smtp_password" defaultValue={user.smtpPassword} placeholder="••••••••" autoComplete="new-password" />
              </label>
              <label>From email <input type="email" name="smtp_from_email" defaultValue={user.smtpFromEmail} placeholder="bot@yourdomain.com" /></label>
              <label className="check">
                <input type="checkbox" name="smtp_use_tls" defaultChecked={user.smtpUseTls} /> Use TLS / STARTTLS (recommended)
              </label>
            </div>
            <p className="muted"><small>
              For Gmail: host <code>smtp.gmail.com</code>, port <code>587</code>, TLS on, use an{" "}
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener">App Password</a> (not your regular password).
            </small></p>
          </fieldset>

          <div className="actions">
            <button className="btn btn-primary" type="submit"><i className="fa-solid fa-floppy-disk" /> Save</button>
          </div>
        </form>

        <form action={smtpTestAction} style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
          <label style={{ flex: 1, minWidth: 220 }}>Send test email to
            <input type="email" name="to" defaultValue={user.notifyEmail || user.email} placeholder="you@example.com" />
          </label>
          <button className="btn" type="submit"><i className="fa-solid fa-paper-plane" /> Send test</button>
        </form>

        {user.lastEmailAt && (
          <div style={{
            marginTop: 16, padding: "10px 12px", borderRadius: 6,
            background: isFail ? "#fef2f2" : "#f0fdf4",
            border: `1px solid ${isFail ? "#fecaca" : "#bbf7d0"}`,
            fontSize: 13, color: "#374151",
          }}>
            <strong>Last email attempt ({new Date(user.lastEmailAt).toUTCString()}):</strong>
            <div style={{ marginTop: 4, fontFamily: "ui-monospace, monospace", wordBreak: "break-word" }}>{user.lastEmailResult}</div>
            {isFail && (
              <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                Common live-server causes: hosting provider blocks outbound SMTP ports, wrong port (Gmail = 587 STARTTLS or
                465 SSL), or regular password used instead of an App Password.
              </p>
            )}
          </div>
        )}
      </section>

      <style>{`.two-col-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } @media (max-width: 700px) { .two-col-grid { grid-template-columns: 1fr; } }`}</style>
    </>
  );
}
