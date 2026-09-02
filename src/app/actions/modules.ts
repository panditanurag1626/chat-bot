"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasFeature } from "@/lib/access";
import { ownedBot } from "@/lib/owner";
import {
  createTrigger, updateTrigger, deleteTrigger, getTrigger,
  updateConvo, getConvo, getOwnedBot,
} from "@/lib/repo";
import { redirectWithFlash } from "@/lib/flash";

const f = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string, d = 0) => { const v = Number(fd.get(k)); return Number.isFinite(v) ? v : d; };
const checked = (fd: FormData, k: string) => fd.get(k) != null;

// ---------------- Triggers (per bot) ----------------
export async function triggerAddAction(botId: string, formData: FormData) {
  const user = await requireUser();
  if (!hasFeature(user, "triggers")) redirectWithFlash(`/bots/${botId}/apis`, "Triggers are not included in your plan.", "error");
  const bot = await ownedBot(botId, user.id);
  if (!bot) redirect("/bots");
  const message = f(formData, "message");
  if (!message) redirectWithFlash(`/bots/${botId}/apis`, "Trigger message is required.", "error");
  createTrigger({
    botId: bot._id,
    name: f(formData, "name") || "Trigger",
    conditionType: f(formData, "condition_type") || "time_on_page",
    conditionValue: f(formData, "condition_value"),
    message,
    delaySeconds: num(formData, "delay_seconds", 5),
    oncePerSession: checked(formData, "once_per_session"),
    enabled: checked(formData, "enabled"),
  });
  redirectWithFlash(`/bots/${botId}/apis`, "Trigger added.", "success");
}

export async function triggerToggleAction(formData: FormData) {
  const user = await requireUser();
  const trig = getTrigger(num(formData, "id"));
  if (!trig) redirect("/bots");
  const bot = await ownedBot(String(trig.botId), user.id);
  if (!bot) redirect("/bots");
  updateTrigger(trig._id, { enabled: !trig.enabled });
  redirectWithFlash(`/bots/${trig.botId}/apis`, "Trigger updated.", "success");
}

export async function triggerDeleteAction(formData: FormData) {
  const user = await requireUser();
  const trig = getTrigger(num(formData, "id"));
  if (!trig) redirect("/bots");
  const bot = await ownedBot(String(trig.botId), user.id);
  if (!bot) redirect("/bots");
  deleteTrigger(trig._id);
  redirectWithFlash(`/bots/${trig.botId}/apis`, "Trigger deleted.", "success");
}

// ---------------- Conversation tags (agent inbox) ----------------
async function ownsConvo(convoId: number, userId: string) {
  const convo = getConvo(convoId);
  if (!convo) return null;
  const bot = getOwnedBot(convo.botId, userId);
  return bot ? convo : null;
}

export async function convoTagAction(formData: FormData) {
  const user = await requireUser();
  const convoId = num(formData, "convo_id");
  const convo = await ownsConvo(convoId, user.id);
  if (!convo) redirect("/agent");
  const tags = f(formData, "tags").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12).join(",");
  updateConvo(convoId, { tags });
  redirect(`/agent/${convoId}`);
}
