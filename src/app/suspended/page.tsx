import type { Metadata } from "next";
import { logoutAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Account unavailable - ChatBotAI" };

export default async function SuspendedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const reason = typeof sp.reason === "string" ? sp.reason : "";
  const expired = reason === "expired";
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f5f6f8" }}>
      <div className="auth-card" style={{ maxWidth: 460, textAlign: "center" }}>
        <div style={{ fontSize: 44, color: "#e60012", marginBottom: 8 }}>
          <i className={`fa-solid ${expired ? "fa-clock-rotate-left" : "fa-ban"}`} />
        </div>
        <h1>{expired ? "Subscription expired" : "Account suspended"}</h1>
        <p className="muted">
          {expired
            ? "Your subscription has expired. Please contact your administrator to renew your plan and restore access."
            : "Your account has been suspended by the administrator. Please get in touch with them for more information."}
        </p>
        <form action={logoutAction} style={{ marginTop: 16 }}>
          <button className="btn btn-primary" type="submit">
            <i className="fa-solid fa-right-from-bracket" /> Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
