import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ownedBot } from "@/lib/owner";
import { appBaseUrl } from "@/lib/util";
import EmbedTabs from "@/components/bot-edit/EmbedTabs";
import WidgetEmbed from "@/components/WidgetEmbed";

export default async function EmbedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const bot = await ownedBot(id, user.id);
  if (!bot) notFound();
  const base = appBaseUrl();

  return (
    <>
      <section className="panel">
        <h2><i className="fa-solid fa-code" /> Embed on your website</h2>
        <p className="muted">Copy this snippet and paste it just before the closing <code>&lt;/body&gt;</code> tag of any page — blog, store, listing or app.</p>
        <EmbedTabs base={base} publicId={bot.publicId} />
      </section>
      <WidgetEmbed botId={bot.publicId} base={base} />
    </>
  );
}
