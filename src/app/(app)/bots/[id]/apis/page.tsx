import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasFeature } from "@/lib/access";
import { ownedBot } from "@/lib/owner";
import { listApisByBot, listTriggers } from "@/lib/repo";
import Flash from "@/components/Flash";
import BotApisSection, { ApiView } from "@/components/bot-edit/BotApisSection";
import TriggersSection from "@/components/bot-edit/TriggersSection";

export default async function ApisPage({
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

  const apis: ApiView[] = listApisByBot(id).map((a) => ({
    id: String(a._id),
    name: a.name,
    description: a.description,
    url: a.url,
    method: a.method,
    authType: a.authType,
    token: a.token,
    headerName: a.headerName,
    keywords: a.keywords,
    enabled: a.enabled,
    alwaysInclude: a.alwaysInclude,
    useVisitorToken: a.useVisitorToken,
  }));

  const triggers = listTriggers(id);
  const triggersAllowed = hasFeature(user, "triggers");

  return (
    <>
      <section className="panel">
        <Flash searchParams={sp} />
        <BotApisSection botId={id} apis={apis} />
      </section>
      <section className="panel">
        <TriggersSection botId={id} triggers={triggers} allowed={triggersAllowed} />
      </section>
    </>
  );
}
