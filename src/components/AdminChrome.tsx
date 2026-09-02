"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/actions/auth";

const CHIME_SRC =
  "data:audio/wav;base64,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";

interface Notif {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  conversation_id: string | null;
  bot_id: string | null;
  created_at: string;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

type NavItem = { href: string; icon: string; label: string; match: (p: string) => boolean };

const USER_NAV: NavItem[] = [
  { href: "/dashboard", icon: "fa-gauge-high", label: "Dashboard", match: (p: string) => p === "/dashboard" },
  { href: "/bots", icon: "fa-robot", label: "Chatbots", match: (p: string) => p.startsWith("/bots") },
  { href: "/agent", icon: "fa-headset", label: "Live Chat", match: (p: string) => p.startsWith("/agent") },
  { href: "/messages", icon: "fa-envelope-open-text", label: "Messages", match: (p: string) => p.startsWith("/messages") },
  { href: "/settings", icon: "fa-gear", label: "Settings", match: (p: string) => p.startsWith("/settings") },
  // { href: "/demo", icon: "fa-eye", label: "Demo Widget", match: (p: string) => p === "/demo" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", icon: "fa-gauge-high", label: "Overview", match: (p: string) => p === "/admin" },
  { href: "/admin/accounts", icon: "fa-users-gear", label: "Accounts", match: (p: string) => p.startsWith("/admin/accounts") },
  { href: "/admin/plans", icon: "fa-box-open", label: "Plans", match: (p: string) => p.startsWith("/admin/plans") },
  { href: "/admin/analytics", icon: "fa-chart-line", label: "Analytics", match: (p: string) => p.startsWith("/admin/analytics") },
  { href: "/admin/database", icon: "fa-database", label: "Database", match: (p: string) => p.startsWith("/admin/database") },
];

// Per-bot sections — shown contextually in the sidebar when a chatbot is open.
function botSections(id: string): NavItem[] {
  const base = `/bots/${id}`;
  const seg = (s: string): NavItem => ({
    href: `${base}/${s}`,
    icon: SECTION_ICONS[s] ?? "fa-circle",
    label: SECTION_LABELS[s],
    match: (p: string) => p === `${base}/${s}` || p.startsWith(`${base}/${s}/`),
  });
  return [
    { href: base, icon: "fa-sliders", label: "Settings", match: (p: string) => p === base },
    seg("knowledge"), seg("embed"), seg("apis"), seg("train"), seg("analytics"), seg("conversations"),
  ];
}
const SECTION_ICONS: Record<string, string> = {
  knowledge: "fa-book", embed: "fa-code", apis: "fa-plug", train: "fa-graduation-cap",
  analytics: "fa-chart-line", conversations: "fa-comments",
};
const SECTION_LABELS: Record<string, string> = {
  knowledge: "Knowledge Base", embed: "Embed Snippet", apis: "APIs & Triggers", train: "Auto-train",
  analytics: "Analytics", conversations: "Conversations",
};

export default function AdminChrome({
  user,
  children,
}: {
  user: { name: string; email: string; role?: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = user.role === "superadmin";
  // When a user opens a specific chatbot, the sidebar becomes contextual to it.
  const botMatch = !isAdmin ? pathname.match(/^\/bots\/(\d+)(?:\/|$)/) : null;
  const botId = botMatch?.[1];
  const nav = isAdmin ? ADMIN_NAV : USER_NAV;
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const lastUnread = useRef(0);
  const chime = useRef<HTMLAudioElement | null>(null);

  const refresh = useCallback(async (playOnIncrease: boolean) => {
    try {
      const r = await fetch("/api/notifications");
      const data = await r.json();
      const u = data.unread || 0;
      setUnread(u);
      setItems(data.items || []);
      if (playOnIncrease && u > lastUnread.current && u > 0) {
        try {
          chime.current?.play().catch(() => {});
        } catch {}
      }
      lastUnread.current = u;
    } catch {}
  }, []);

  useEffect(() => {
    chime.current = new Audio(CHIME_SRC);
    refresh(false);
    const t = setInterval(() => refresh(true), 15000);
    return () => clearInterval(t);
  }, [refresh]);

  // Restore the sidebar collapsed preference (desktop).
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("cb_sidebar_collapsed") === "1"); } catch {}
  }, []);
  const toggleCollapsed = () =>
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("cb_sidebar_collapsed", next ? "1" : "0"); } catch {}
      return next;
    });

  // Close dropdowns on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("#profile")) setProfileOpen(false);
      if (!t.closest("#notif")) setNotifOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const markRead = async (id: string) => {
    fetch(`/api/notifications/${id}/read`, { method: "POST" }).catch(() => {});
  };
  const markAll = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    refresh(false);
  };

  const displayName = user.name || user.email.split("@")[0];

  return (
    <div className={`layout${navOpen ? " nav-open" : ""}${collapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar" id="sidebar">
        <div className="sidebar-head">
          <Link className="brand" href={isAdmin ? "/admin" : "/dashboard"}>
            ChatBot<span>AI</span>
          </Link>
          <button className="sidebar-close" type="button" aria-label="Close menu" onClick={() => setNavOpen(false)}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <nav className="sidebar-nav">
          {botId ? (
            <>
              <Link href="/bots" className="sidebar-back" onClick={() => setNavOpen(false)}>
                <i className="fa-solid fa-arrow-left" /> <span>All Chatbots</span>
              </Link>
              <div className="sidebar-section">Chatbot</div>
              {botSections(botId).map((n) => (
                <Link key={n.href} href={n.href} className={n.match(pathname) ? "active" : ""} onClick={() => setNavOpen(false)}>
                  <i className={`fa-solid ${n.icon}`} /> <span>{n.label}</span>
                </Link>
              ))}
              <div className="sidebar-section">Workspace</div>
              {USER_NAV.filter((n) => n.href !== "/bots").map((n) => (
                <Link key={n.href} href={n.href} className={n.match(pathname) ? "active" : ""} onClick={() => setNavOpen(false)}>
                  <i className={`fa-solid ${n.icon}`} /> <span>{n.label}</span>
                </Link>
              ))}
            </>
          ) : (
            nav.map((n) => (
              <Link key={n.href} href={n.href} className={n.match(pathname) ? "active" : ""} onClick={() => setNavOpen(false)}>
                <i className={`fa-solid ${n.icon}`} /> <span>{n.label}</span>
              </Link>
            ))
          )}
        </nav>
        <div className="sidebar-foot muted">v3 · ChatBotAI</div>
      </aside>

      <div className="layout-main">
        <header className="topbar">
          <button className="sidebar-toggle" type="button" aria-label={collapsed ? "Show sidebar" : "Hide sidebar"} title={collapsed ? "Show sidebar" : "Hide sidebar"} onClick={toggleCollapsed}>
            <i className={`fa-solid ${collapsed ? "fa-bars-staggered" : "fa-bars"}`} />
          </button>
          <button className="hamburger" type="button" aria-label="Toggle menu" onClick={() => setNavOpen((o) => !o)}>
            <i className="fa-solid fa-bars" />
          </button>
          <div className="topbar-spacer" />

          <div className={`notif${notifOpen ? " open" : ""}`} id="notif">
            <button
              type="button"
              className="notif-btn"
              aria-label="Notifications"
              onClick={(e) => {
                e.stopPropagation();
                const next = !notifOpen;
                setNotifOpen(next);
                if (next) refresh(false);
              }}
            >
              <i className="fa-solid fa-bell" />
              {unread > 0 && <span className="notif-badge">{unread}</span>}
            </button>
            <div className="notif-menu">
              <div className="notif-menu-head">
                <strong>Notifications</strong>
                <button type="button" className="notif-mark-all" onClick={(e) => { e.stopPropagation(); markAll(); }}>
                  Mark all read
                </button>
              </div>
              <div className="notif-list">
                {items.length === 0 ? (
                  <div className="notif-empty muted">No notifications yet.</div>
                ) : (
                  items.map((n) => (
                    <Link
                      key={n.id}
                      className={`notif-item${n.is_read ? "" : " unread"}`}
                      href={n.type === "expiry" ? "/admin/accounts" : n.type === "contact" ? "/messages" : n.conversation_id ? `/agent/${n.conversation_id}` : "#"}
                      onClick={() => markRead(n.id)}
                    >
                      <div className="notif-icon">
                        <i className={`fa-solid ${n.type === "expiry" ? "fa-clock-rotate-left" : n.type === "contact" ? "fa-envelope" : "fa-headset"}`} />
                      </div>
                      <div className="notif-body">
                        <strong>{n.title}</strong>
                        <div className="notif-text muted">{n.body}</div>
                        <div className="notif-time muted">{timeAgo(n.created_at)}</div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className={`profile${profileOpen ? " open" : ""}`} id="profile">
            <button type="button" className="profile-btn" onClick={() => setProfileOpen((o) => !o)}>
              <span className="profile-avatar">{(user.name || user.email)[0]?.toUpperCase()}</span>
              <span className="profile-meta">
                <span className="profile-name">{displayName}</span>
                <span className="profile-email muted">{user.email}</span>
              </span>
              <i className="fa-solid fa-chevron-down profile-chevron" />
            </button>
            <div className="profile-menu">
              {nav.slice(0, 4).map((n) => (
                <Link key={n.href} href={n.href}><i className={`fa-solid ${n.icon}`} /> {n.label}</Link>
              ))}
              <hr />
              <form action={logoutAction}>
                <button type="submit" style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", fontSize: 13, color: "#333", width: "100%", boxSizing: "border-box" }}>
                  <i className="fa-solid fa-right-from-bracket" /> Logout
                </button>
              </form>
            </div>
          </div>
        </header>

        <div className="nav-overlay" onClick={() => setNavOpen(false)} />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
