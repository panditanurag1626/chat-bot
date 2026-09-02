import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ownedBot } from "@/lib/owner";
import { WEBSITE_TYPE_OPTIONS } from "@/lib/presets";
import { botEditAction } from "@/app/actions/bots";
import Flash from "@/components/Flash";

export default async function BotSettingsPage({
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

  let quickReplies: string[] = [];
  try { quickReplies = JSON.parse(bot.quickRepliesJson || "[]"); } catch { quickReplies = []; }

  return (
    <section className="panel">
      <h2><i className="fa-solid fa-sliders" /> Settings</h2>
      <Flash searchParams={sp} />
      <form action={botEditAction.bind(null, id)}>
        <fieldset>
          <legend>Basics</legend>
          <label>Name <input name="name" defaultValue={bot.name} required /></label>
          <label>Welcome message <textarea name="welcome_message" rows={2} defaultValue={bot.welcomeMessage} /></label>
          <label>
            Menu prompt
            <textarea name="menu_prompt" rows={2} placeholder="Select one of the options below or type your query:" defaultValue={bot.menuPrompt || ""} />
            <small className="muted">Shown above the clickable option buttons in the chat (Q&amp;A menu / sub-questions).</small>
          </label>
          <label>System prompt (LLM persona) <textarea name="system_prompt" rows={3} defaultValue={bot.systemPrompt} /></label>
        </fieldset>

        <fieldset>
          <legend>Appearance &amp; Avatars</legend>
          <label>Primary color <input name="primary_color" type="color" defaultValue={bot.primaryColor} style={{ height: 50 }} /></label>
          <label>Launcher bubble icon URL <input name="bubble_icon" defaultValue={bot.bubbleIcon} placeholder="https://...icon.png" /></label>
          <label>AI profile image URL <input name="bot_avatar" defaultValue={bot.botAvatar} placeholder="https://...avatar.png" /></label>
          <label>User avatar URL (optional) <input name="user_avatar" defaultValue={bot.userAvatar} placeholder="https://...user.png" /></label>
          <div className="preview-row">
            {bot.bubbleIcon && <div><div className="preview-circle" style={{ backgroundImage: `url('${bot.bubbleIcon}')` }} /><small>Launcher</small></div>}
            {bot.botAvatar && <div><div className="preview-circle" style={{ backgroundImage: `url('${bot.botAvatar}')` }} /><small>AI</small></div>}
            {bot.userAvatar && <div><div className="preview-circle" style={{ backgroundImage: `url('${bot.userAvatar}')` }} /><small>User</small></div>}
          </div>
          <label>
            Position
            <select name="position" defaultValue={bot.position}>
              <option value="bottom-right">Bottom right</option>
              <option value="bottom-left">Bottom left</option>
            </select>
          </label>
          <label>Header title <input name="header_title" defaultValue={bot.headerTitle} /></label>
          <label>Header subtitle <input name="header_subtitle" defaultValue={bot.headerSubtitle} /></label>
        </fieldset>

        <fieldset>
          <legend>Core</legend>
          <label>
            Website type
            <select name="website_type" defaultValue={bot.websiteType || "custom"}>
              {WEBSITE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <small className="muted">Used for smart defaults so this widget fits a blog, store, listing site, SaaS, or any site.</small>
          </label>
          <label>
            Quick replies (one per line or comma separated)
            <textarea name="quick_replies" rows={2} defaultValue={quickReplies.join("\n")} placeholder="Pricing&#10;Support&#10;Contact" />
          </label>
          <label>Allowed domains (comma separated, blank = all) <input name="allowed_domains" defaultValue={bot.allowedDomains} placeholder="example.com, mysite.in" /></label>
        </fieldset>

        <fieldset className="modules">
          <legend>Advanced modules</legend>
          <label className="check" style={{ background: "#fff7ed", border: "1px solid #fed7aa", padding: "8px 10px", borderRadius: 6 }}>
            <input type="checkbox" name="is_active" defaultChecked={bot.isActive} />
            <i className="fa-solid fa-power-off" /> <strong>Chatbot live on website</strong> — uncheck to hide the widget everywhere (kill switch).
          </label>
          <label className="check"><input type="checkbox" name="enable_voice" defaultChecked={bot.enableVoice} /> <i className="fa-solid fa-microphone" /> <strong>Voice</strong> — speech-to-text input + TTS</label>
          <label className="check"><input type="checkbox" name="enable_image_upload" defaultChecked={bot.enableImageUpload} /> <i className="fa-solid fa-image" /> <strong>Image upload + Vision AI</strong></label>
          <label className="check"><input type="checkbox" name="enable_feedback" defaultChecked={bot.enableFeedback} /> <i className="fa-solid fa-thumbs-up" /> <strong>Feedback</strong> — thumbs up/down on bot replies</label>
          <label className="check"><input type="checkbox" name="enable_human_handoff" defaultChecked={bot.enableHumanHandoff} /> <i className="fa-solid fa-headset" /> <strong>Human handoff</strong> — request a live agent</label>
          <label className="check"><input type="checkbox" name="enable_sound" defaultChecked={bot.enableSound} /> <i className="fa-solid fa-volume-high" /> <strong>Sound</strong> — play a chime on new messages</label>
          <label className="check"><input type="checkbox" name="auto_open" defaultChecked={bot.autoOpen} /> <i className="fa-solid fa-window-restore" /> <strong>Auto-open</strong> — open the widget automatically on page load</label>
          <label className="check"><input type="checkbox" name="enable_contact_form" defaultChecked={bot.enableContactForm} /> <i className="fa-solid fa-envelope-open-text" /> <strong>Contact form</strong> — collect name, email, phone, message</label>
          <label className="check"><input type="checkbox" name="enable_triggers" defaultChecked={bot.enableTriggers} /> <i className="fa-solid fa-bolt" /> <strong>Proactive triggers</strong> — auto-send messages based on visitor behaviour</label>
          <label>Contact form title <input name="contact_form_title" maxLength={120} defaultValue={bot.contactFormTitle || "Send us a message"} /></label>
          <label>Contact form subtitle <input name="contact_form_subtitle" maxLength={160} defaultValue={bot.contactFormSubtitle || ""} placeholder="We'll reply by email shortly" /></label>
        </fieldset>

        <button className="btn btn-primary" type="submit"><i className="fa-solid fa-floppy-disk" /> Save</button>
      </form>
    </section>
  );
}
