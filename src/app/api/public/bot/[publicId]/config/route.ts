import { NextRequest } from "next/server";
import { getBotByPublicId, listMenu, getUserById, listTriggers } from "@/lib/repo";
import { accountState, hasFeature } from "@/lib/access";
import { corsJson, corsPreflight, domainAllowed } from "@/lib/util";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const bot = getBotByPublicId(publicId);
  if (!bot) return corsJson({ error: "not found" }, 404);
  if (!bot.isActive) return corsJson({ error: "bot disabled" }, 423);
  // Respect the owning account's subscription: a banned / expired account's bots go dark.
  const owner = getUserById(bot.userId);
  if (!owner || !accountState(owner).ok) return corsJson({ error: "subscription inactive" }, 423);
  if (!domainAllowed(bot.allowedDomains, req.headers.get("Origin") || "")) {
    return corsJson({ error: "domain not allowed" }, 403);
  }

  const menu = listMenu(bot._id).map((q) => ({ id: String(q._id), question: q.question }));

  let quickReplies: string[] = [];
  try { quickReplies = JSON.parse(bot.quickRepliesJson || "[]"); } catch { quickReplies = []; }

  // Proactive triggers (Crisp/tawk style) — only when enabled on the bot and plan.
  const triggersOn = bot.enableTriggers && hasFeature(owner, "triggers");
  const triggers = triggersOn
    ? listTriggers(bot._id, true).map((t) => ({
        id: String(t._id),
        condition_type: t.conditionType,
        condition_value: t.conditionValue,
        message: t.message,
        delay_seconds: t.delaySeconds,
        once_per_session: t.oncePerSession,
      }))
    : [];

  return corsJson({
    id: bot.publicId,
    name: bot.name,
    welcome_message: bot.welcomeMessage,
    menu_prompt: bot.menuPrompt,
    primary_color: bot.primaryColor,
    bubble_icon: bot.bubbleIcon,
    bot_avatar: bot.botAvatar,
    user_avatar: bot.userAvatar,
    position: bot.position,
    header_title: bot.headerTitle,
    header_subtitle: bot.headerSubtitle,
    contact_form_title: bot.contactFormTitle,
    contact_form_subtitle: bot.contactFormSubtitle,
    website_type: bot.websiteType,
    quick_replies: quickReplies,
    triggers,
    menu,
    features: {
      voice: bot.enableVoice,
      image_upload: bot.enableImageUpload,
      feedback: bot.enableFeedback,
      human_handoff: bot.enableHumanHandoff,
      sound: bot.enableSound,
      auto_open: bot.autoOpen,
      contact_form: bot.enableContactForm,
    },
  });
}
