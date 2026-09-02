"use client";

import { useEffect } from "react";

/** Injects the embeddable widget loader (the same /embed.js customers use). */
export default function WidgetEmbed({
  botId,
  base,
  fullscreen = false,
}: {
  botId: string;
  base: string;
  fullscreen?: boolean;
}) {
  useEffect(() => {
    const s = document.createElement("script");
    s.src = `${base}/embed.js`;
    s.dataset.botId = botId;
    if (fullscreen) s.dataset.fullscreen = "1";
    s.defer = true;
    document.body.appendChild(s);
    return () => {
      s.remove();
      // Tear down the mounted widget + its loaded flag so re-mounts re-init.
      document.getElementById("chatbotai-root")?.remove();
      // @ts-expect-error cleanup of the global guard set by embed.js
      delete window.__ChatBotAI_loaded;
    };
  }, [botId, base, fullscreen]);
  return null;
}
