import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ownedBot } from "@/lib/owner";
import { listQasByBot } from "@/lib/repo";
import Flash from "@/components/Flash";
import QaSection, { QaNode, FlatOpt } from "@/components/bot-edit/QaSection";

const PER_PAGE = 15;

export default async function KnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const bot = await ownedBot(id, user.id);
  if (!bot) notFound();

  const allQa = listQasByBot(id);
  const byId = new Map<string, QaNode>();
  for (const q of allQa) {
    byId.set(String(q._id), {
      id: String(q._id),
      question: q.question,
      answer: q.answer,
      keywords: q.keywords,
      source: q.source,
      parentId: q.parentId ? String(q.parentId) : null,
      showInMenu: q.showInMenu,
      children: [],
    });
  }
  const rootsAll: QaNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node);
    else rootsAll.push(node);
  }

  const page = Math.max(1, Number(sp.page) || 1);
  const total = rootsAll.length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const offset = (page - 1) * PER_PAGE;
  const roots = rootsAll.slice(offset, offset + PER_PAGE);

  const flatOptions: FlatOpt[] = allQa.map((q) => ({
    id: String(q._id),
    question: q.question,
    parentId: q.parentId ? String(q.parentId) : null,
  }));

  return (
    <section className="panel">
      <Flash searchParams={sp} />
      <QaSection botId={id} roots={roots} flatOptions={flatOptions} pagination={{ page, pages, total, perPage: PER_PAGE, offset }} />
    </section>
  );
}
