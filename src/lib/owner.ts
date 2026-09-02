import { asId } from "./sqlite";
import { getOwnedBot, getQa } from "./repo";
import type { IBot } from "./types";

/** Fetch a bot owned by the user, or null. */
export async function ownedBot(botId: string, userId: string): Promise<IBot | null> {
  if (!asId(botId)) return null;
  return getOwnedBot(botId, userId);
}

/** Fetch the bot that owns a QA, verifying the user owns that bot. */
export async function ownedBotForQa(qaId: string, userId: string): Promise<{ bot: IBot; qaBotId: string } | null> {
  if (!asId(qaId)) return null;
  const qa = getQa(qaId);
  if (!qa) return null;
  const bot = getOwnedBot(qa.botId, userId);
  if (!bot) return null;
  return { bot, qaBotId: String(qa.botId) };
}
