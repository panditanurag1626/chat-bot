import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBotByPublicId } from "@/lib/repo";
import { appBaseUrl } from "@/lib/util";
import WidgetEmbed from "@/components/WidgetEmbed";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ publicId: string }> }): Promise<Metadata> {
  const { publicId } = await params;
  const bot = getBotByPublicId(publicId);
  return { title: bot ? bot.headerTitle || bot.name : "Chat" };
}

export default async function WidgetFullscreenPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const bot = getBotByPublicId(publicId);
  if (!bot) notFound();
  const base = appBaseUrl();
  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff" }}>
      <WidgetEmbed botId={bot.publicId} base={base} fullscreen />
    </div>
  );
}
