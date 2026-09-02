import { asId } from "./sqlite";
import { getConvo, getOwnedBot } from "./repo";
import type { IConversation, IBot } from "./types";

/** Load a conversation whose bot belongs to the user. */
export async function ownedConvo(
  convoId: string,
  userId: string
): Promise<{ convo: IConversation; bot: IBot } | null> {
  if (!asId(convoId)) return null;
  const convo = getConvo(convoId);
  if (!convo) return null;
  const bot = getOwnedBot(convo.botId, userId);
  if (!bot) return null;
  return { convo, bot };
}

export type { IConversation };
