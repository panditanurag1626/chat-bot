import Link from "next/link";
import type { Metadata } from "next";
import { getAnyBot } from "@/lib/repo";
import { appBaseUrl } from "@/lib/util";
import WidgetEmbed from "@/components/WidgetEmbed";

export const metadata: Metadata = { title: "Demo - ChatBotAI Embed" };
export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const bot = getAnyBot();
  const base = appBaseUrl();

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 800, margin: "40px auto", padding: 20, lineHeight: 1.6, color: "#222" }}>
      <h1 style={{ color: "#e60012" }}>ChatBotAI Demo Page</h1>
      <p>This page demonstrates the embedded widget on a third-party-style site.</p>
      {bot ? (
        <>
          <p>
            Currently embedded bot: <code>{bot.publicId}</code> — open the bubble at the bottom-right.
          </p>
          <h3>Embed snippet used on this page:</h3>
          <pre style={{ background: "#f4f4f7", padding: 12, borderRadius: 8, overflowX: "auto" }}>
            <code>{`<script src="${base}/embed.js" data-bot-id="${bot.publicId}" defer></script>`}</code>
          </pre>
          <WidgetEmbed botId={bot.publicId} base={base} />
        </>
      ) : (
        <p>
          Create a bot first at <Link href="/register">/register</Link>.
        </p>
      )}
    </div>
  );
}
