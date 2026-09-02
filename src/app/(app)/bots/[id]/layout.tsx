import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ownedBot } from "@/lib/owner";

export default async function BotLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const bot = await ownedBot(id, user.id);
  if (!bot) notFound();

  return (
    <>
      <div className="bot-head">
        <div className="bot-head-title">
          <span className="bot-dot" style={{ background: bot.primaryColor }} />
          <div>
            <h1>{bot.name}</h1>
            <span className="muted bot-head-sub">
              {bot.isActive ? <span className="badge badge-ok">Live</span> : <span className="badge badge-warn">Disabled</span>}
              <code style={{ marginLeft: 8 }}>{bot.publicId}</code>
            </span>
          </div>
        </div>
      </div>
      <div className="bot-tab-body">{children}</div>
    </>
  );
}
