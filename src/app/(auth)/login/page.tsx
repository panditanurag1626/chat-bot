import type { Metadata } from "next";
import { loginAction } from "@/app/actions/auth";
import PasswordInput from "@/components/PasswordInput";
import Flash from "@/components/Flash";

export const metadata: Metadata = { title: "Login - ChatBotAI" };

const HIGHLIGHTS = [
  { icon: "fa-robot", title: "AI chatbots for any site", text: "Blogs, e-commerce, listings & SaaS." },
  { icon: "fa-headset", title: "Live agent handoff", text: "Step in when a human is needed." },
  { icon: "fa-bolt", title: "Proactive & canned replies", text: "Engage visitors and reply faster." },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <div className="auth-split">
      {/* Brand / marketing panel */}
      <aside className="auth-aside">
        <div className="auth-aside-inner">
          <div className="auth-logo">ChatBot<span>AI</span></div>
          <h2 className="auth-tagline">The all-in-one customer conversation platform.</h2>
          <p className="auth-sub">Deploy intelligent chatbots, capture leads and talk to your visitors in real time — on any website.</p>
          <ul className="auth-highlights">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title}>
                <span className="auth-hl-icon"><i className={`fa-solid ${h.icon}`} /></span>
                <span>
                  <strong>{h.title}</strong>
                  <small>{h.text}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="auth-aside-foot">© ChatBotAI · Secure admin platform</div>
      </aside>

      {/* Form panel */}
      <main className="auth-main">
        <div className="auth-form-card">
          <div className="auth-logo auth-logo-mobile">ChatBot<span>AI</span></div>
          <h1>Welcome back</h1>
          <p className="auth-lead">Sign in to your dashboard to manage your bots and conversations.</p>

          <Flash searchParams={sp} />

          <form action={loginAction} className="auth-form">
            <label>
              <span className="auth-label">Email address</span>
              <div className="auth-input">
                <i className="fa-solid fa-envelope" />
                <input name="email" type="email" placeholder="you@company.com" required autoFocus />
              </div>
            </label>
            <label>
              <span className="auth-label">Password</span>
              <PasswordInput name="password" required placeholder="••••••••" />
            </label>
            <button className="btn btn-primary auth-submit" type="submit">
              <i className="fa-solid fa-right-to-bracket" /> Sign in
            </button>
          </form>

          <p className="auth-note">
            <i className="fa-solid fa-circle-info" /> Accounts are provisioned by your administrator. Contact them if you need access.
          </p>
        </div>
      </main>
    </div>
  );
}
