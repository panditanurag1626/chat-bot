import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign up - ChatBotAI" };

export default function RegisterPage() {
  return (
    <div className="auth-card">
      <h1>Sign-up is by invitation</h1>
      <p className="muted">
        Accounts on this platform are created by an administrator. Please contact
        your administrator to get access, then sign in below.
      </p>
      <Link className="btn btn-primary" href="/login" style={{ marginTop: 12 }}>
        Go to login
      </Link>
    </div>
  );
}
