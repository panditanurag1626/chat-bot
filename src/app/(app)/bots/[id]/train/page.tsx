import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ownedBot } from "@/lib/owner";
import { listQasByBot } from "@/lib/repo";
import TrainForm from "@/components/bot-edit/TrainForm";

export default async function TrainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const bot = await ownedBot(id, user.id);
  if (!bot) notFound();
  const options = listQasByBot(id).map((q) => ({
    id: String(q._id),
    question: q.question,
    parentId: q.parentId ? String(q.parentId) : null,
  }));

  return (
    <>
      <h2><i className="fa-solid fa-graduation-cap" /> Auto-train from a website</h2>
      <p className="muted">Scrape a URL to auto-generate Q&amp;A pairs, or import nested JSON.</p>
      <TrainForm botId={id} trainedFromUrl={bot.trainedFromUrl} options={options} />
    </>
  );
}
