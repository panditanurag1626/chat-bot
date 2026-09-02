import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listBotsByUser } from "@/lib/repo";
import { appBaseUrl } from "@/lib/util";
import { botNewAction, botDeleteAction } from "@/app/actions/bots";
import Flash from "@/components/Flash";

export const metadata: Metadata = { title: "My Bots - ChatBotAI" };

export default async function BotsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const bots = listBotsByUser(user.id);
  const base = appBaseUrl();

  return (
    <>
      <Flash searchParams={sp} />
      <div className="page-head">
        <h1>
          <i className="fa-solid fa-robot" /> My Chatbots
        </h1>
        {user.role === "superadmin" && (
          <form action={botNewAction} className="inline">
            <input name="name" placeholder="New chatbot name" required />
            <button className="btn btn-primary" type="submit">
              <i className="fa-solid fa-plus" /> Create
            </button>
          </form>
        )}
      </div>

      {bots.length === 0 ? (
        <div className="empty">
          {user.role === "superadmin" 
            ? "No bots yet. Create your first one above." 
            : "No chatbots assigned to your account."}
        </div>
      ) : (
        <div className="grid">
          {bots.map((b) => (
            <div className="card" key={b._id}>
              <div className="card-head" style={{ background: b.primaryColor }}>
                <h3>{b.name}</h3>
                <span className="pill">{b.publicId}</span>
              </div>
              <div className="card-body">
                <p className="muted">
                  {b.welcomeMessage.slice(0, 80)}
                  {b.welcomeMessage.length > 80 ? "…" : ""}
                </p>
                <div className="actions">
                  <Link className="btn" href={`/bots/${b._id}`}><i className="fa-solid fa-pen-to-square" /> Edit</Link>
                  <Link className="btn" href={`/bots/${b._id}/analytics`}><i className="fa-solid fa-chart-line" /> Analytics</Link>
                  <Link className="btn" href={`/bots/${b._id}/train`}><i className="fa-solid fa-robot" /> Train</Link>
                  <Link className="btn" href={`/bots/${b._id}/conversations`}><i className="fa-solid fa-comments" /> Chats</Link>
                  <form action={botDeleteAction.bind(null, String(b._id))} className="inline">
                    <button className="btn btn-danger" type="submit">Delete</button>
                  </form>
                </div>
                <details className="embed">
                  <summary>Embed snippet</summary>
                  <pre>
                    <code>{`<script src="${base}/embed.js" data-bot-id="${b.publicId}" defer></script>`}</code>
                  </pre>
                </details>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
