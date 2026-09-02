"use server";

import { requireUser } from "@/lib/auth";
import { ownedConvo } from "@/lib/agentAuth";
import { updateConvo, createMessage } from "@/lib/repo";
import { redirect } from "next/navigation";

export async function agentReleaseAction(convoId: string) {
  const user = await requireUser();
  const owned = await ownedConvo(convoId, user.id);
  if (!owned) redirect("/agent");
  updateConvo(convoId, { mode: "ai" });
  createMessage(convoId, "system", "The agent ended the chat. You're back to chatting with the AI.");
  redirect("/agent");
}
