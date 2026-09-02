"use server";

import { asId } from "@/lib/sqlite";
import { requireUser } from "@/lib/auth";
import { ownedBot, ownedBotForQa } from "@/lib/owner";
import {
  createBot, updateBot, deleteBot,
  createQa, getQaInBot, deleteQaTree, bulkSetShowInMenu, listQaIdParent,
  createApi, getApi, updateApi, deleteApi,
} from "@/lib/repo";
import { parseQaJson, insertQaRecursive } from "@/lib/qaimport";
import { canCreateBot } from "@/lib/access";
import { redirectWithFlash } from "@/lib/flash";
import { redirect } from "next/navigation";

const cap = (v: FormDataEntryValue | null, len: number) => String(v || "").trim().slice(0, len);
const checked = (fd: FormData, name: string) => fd.get(name) != null;

// ---------- Bots ----------
export async function botNewAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "superadmin") {
    redirectWithFlash("/bots", "Only superadmins can create new chatbots.", "error");
  }
  const quota = canCreateBot(user);
  if (!quota.ok) {
    redirectWithFlash("/bots", `Your plan allows up to ${quota.limit} bot${quota.limit === 1 ? "" : "s"}. Upgrade to add more.`, "error");
  }
  const name = String(formData.get("name") || "New Chatbot").trim();
  const websiteType = String(formData.get("website_type") || "custom").trim();
  const b = createBot({ userId: user.id, name, websiteType });
  redirect(`/bots/${b._id}`);
}

export async function botEditAction(botId: string, formData: FormData) {
  const user = await requireUser();
  const bot = await ownedBot(botId, user.id);
  if (!bot) redirect("/bots");

  const fields: Record<string, unknown> = {};
  for (const f of [
    "name", "welcomeMessage:welcome_message", "menuPrompt:menu_prompt", "systemPrompt:system_prompt",
    "primaryColor:primary_color", "bubbleIcon:bubble_icon", "botAvatar:bot_avatar", "userAvatar:user_avatar",
    "position", "headerTitle:header_title", "headerSubtitle:header_subtitle",
    "contactFormTitle:contact_form_title", "contactFormSubtitle:contact_form_subtitle",
    "allowedDomains:allowed_domains", "websiteType:website_type",
  ]) {
    const [field, formName] = f.includes(":") ? f.split(":") : [f, f];
    if (formData.has(formName)) fields[field] = String(formData.get(formName) || "");
  }
  if (formData.has("quick_replies")) {
    const items = String(formData.get("quick_replies") || "").split(/[\n,]/).map((x) => x.trim()).filter(Boolean).slice(0, 12);
    fields.quickRepliesJson = JSON.stringify(items);
  }
  fields.enableLlm = true;
  fields.enableTriggers = checked(formData, "enable_triggers");
  fields.isActive = checked(formData, "is_active");
  fields.enableVoice = checked(formData, "enable_voice");
  fields.enableImageUpload = checked(formData, "enable_image_upload");
  fields.enableFeedback = checked(formData, "enable_feedback");
  fields.enableHumanHandoff = checked(formData, "enable_human_handoff");
  fields.enableSound = checked(formData, "enable_sound");
  fields.autoOpen = checked(formData, "auto_open");
  fields.enableContactForm = checked(formData, "enable_contact_form");

  updateBot(botId, fields);
  redirectWithFlash(`/bots/${botId}`, "Saved.", "success");
}

export async function botDeleteAction(botId: string) {
  const user = await requireUser();
  const bot = await ownedBot(botId, user.id);
  if (!bot) redirect("/bots");
  deleteBot(botId);
  redirect("/bots");
}

// ---------- Q&A ----------
export async function qaAddAction(botId: string, formData: FormData) {
  const user = await requireUser();
  const bot = await ownedBot(botId, user.id);
  if (!bot) redirect("/bots");
  const q = String(formData.get("question") || "").trim();
  const a = String(formData.get("answer") || "").trim();
  const kw = String(formData.get("keywords") || "").trim();
  let parentId: number | null = null;
  const pid = asId(formData.get("parent_id"));
  if (pid && getQaInBot(pid, botId)) parentId = pid;
  if (q && a) createQa({ botId, question: q, answer: a, keywords: kw, parentId, source: "manual" });
  redirectWithFlash(`/bots/${botId}/knowledge`, "Q&A added.", "success");
}

export async function qaDeleteAction(qaId: string) {
  const user = await requireUser();
  const owned = await ownedBotForQa(qaId, user.id);
  if (!owned) redirect("/bots");
  deleteQaTree(qaId, owned.qaBotId);
  redirectWithFlash(`/bots/${owned.qaBotId}/knowledge`, "Q&A deleted.", "success");
}

export async function qaBulkToggleAction(botId: string, formData: FormData) {
  const user = await requireUser();
  const bot = await ownedBot(botId, user.id);
  if (!bot) redirect("/bots");
  const ids = String(formData.get("ids") || "").split(",").map((x) => asId(x)).filter((x): x is number => x != null);
  const show = checked(formData, "show_in_menu");
  if (ids.length) {
    bulkSetShowInMenu(botId, ids, show);
    redirectWithFlash(`/bots/${botId}/knowledge`, `${show ? "Showed" : "Hid"} ${ids.length} Q&A item${ids.length !== 1 ? "s" : ""}.`, "success");
  }
  redirectWithFlash(`/bots/${botId}/knowledge`, "No items selected.", "error");
}

export async function qaBulkDeleteAction(botId: string, formData: FormData) {
  const user = await requireUser();
  const bot = await ownedBot(botId, user.id);
  if (!bot) redirect("/bots");
  const ids = String(formData.get("ids") || "").split(",").map((x) => asId(x)).filter((x): x is number => x != null);
  if (!ids.length) redirectWithFlash(`/bots/${botId}/knowledge`, "No items selected.", "error");

  const idSet = new Set(ids);
  const parentMap = new Map(listQaIdParent(botId).map((q) => [q.id, q.parentId]));
  const hasSelectedAncestor = (id: number) => {
    let pid = parentMap.get(id) ?? null;
    while (pid != null) {
      if (idSet.has(pid)) return true;
      pid = parentMap.get(pid) ?? null;
    }
    return false;
  };
  const roots = ids.filter((id) => !hasSelectedAncestor(id));
  for (const id of roots) deleteQaTree(id, botId);
  redirectWithFlash(`/bots/${botId}/knowledge`, `Deleted ${ids.length} Q&A item${ids.length !== 1 ? "s" : ""}.`, "success");
}

// ---------- JSON / CSV import ----------
export async function qaImportJsonAction(botId: string, formData: FormData) {
  const user = await requireUser();
  const bot = await ownedBot(botId, user.id);
  if (!bot) redirect("/bots");
  let text = "";
  const file = formData.get("file");
  if (file instanceof File && file.name) text = (await file.text()).replace(/^﻿/, "");
  if (!text) text = String(formData.get("data") || "").trim();
  if (!text) redirectWithFlash(`/bots/${botId}`, "Provide JSON via paste or file.", "error");
  try {
    const items = parseQaJson(text);
    const count = insertQaRecursive(botId, items, null, "json");
    redirectWithFlash(`/bots/${botId}`, `Imported ${count} Q&A entries from JSON.`, "success");
  } catch (e) {
    redirectWithFlash(`/bots/${botId}`, `Invalid JSON: ${e instanceof Error ? e.message : e}`, "error");
  }
}

export async function qaImportCsvAction(botId: string, formData: FormData) {
  const user = await requireUser();
  const bot = await ownedBot(botId, user.id);
  if (!bot) redirect("/bots");
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name) redirectWithFlash(`/bots/${botId}`, "Please choose a CSV file.", "error");
  const text = (await (file as File).text()).replace(/^﻿/, "");
  const rows = parseCsv(text);
  if (!rows.length) redirectWithFlash(`/bots/${botId}`, "CSV is empty.", "error");
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const qi = header.indexOf("question");
  const ai = header.indexOf("answer");
  const ki = header.indexOf("keywords");
  if (qi === -1 || ai === -1) redirectWithFlash(`/bots/${botId}`, "CSV must include 'question' and 'answer' columns.", "error");
  let added = 0;
  for (const row of rows.slice(1)) {
    const q = (row[qi] || "").trim();
    const a = (row[ai] || "").trim();
    const kw = (ki >= 0 ? row[ki] || "" : "").trim();
    if (q && a) { createQa({ botId, question: q, answer: a, keywords: kw, source: "csv" }); added += 1; }
  }
  redirectWithFlash(`/bots/${botId}`, `Imported ${added} Q&A row(s).`, "success");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f !== "")) rows.push(row);
      row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f !== "")) rows.push(row); }
  return rows;
}

// ---------- External APIs ----------
export async function botapiAddAction(botId: string, formData: FormData) {
  const user = await requireUser();
  const bot = await ownedBot(botId, user.id);
  if (!bot) redirect("/bots");
  const name = cap(formData.get("name"), 120);
  const url = cap(formData.get("url"), 500);
  if (!name || !url) redirectWithFlash(`/bots/${botId}/apis`, "API name and URL are required.", "error");
  createApi({
    botId: Number(botId),
    name,
    description: cap(formData.get("description"), 2000),
    url,
    method: cap(formData.get("method"), 10).toUpperCase() || "GET",
    authType: cap(formData.get("auth_type"), 20) || "none",
    token: cap(formData.get("token"), 500),
    headerName: cap(formData.get("header_name"), 120),
    keywords: String(formData.get("keywords") || "").trim(),
    enabled: checked(formData, "enabled"),
    alwaysInclude: checked(formData, "always_include"),
    useVisitorToken: checked(formData, "use_visitor_token"),
  });
  redirectWithFlash(`/bots/${botId}/apis`, `API '${name}' added.`, "success");
}

export async function botapiEditAction(apiId: string, formData: FormData) {
  const user = await requireUser();
  if (!asId(apiId)) redirect("/bots");
  const api = getApi(apiId);
  if (!api) redirect("/bots");
  const bot = await ownedBot(String(api.botId), user.id);
  if (!bot) redirect("/bots");
  updateApi(apiId, {
    name: cap(formData.get("name"), 120) || api.name,
    description: cap(formData.get("description"), 2000),
    url: cap(formData.get("url"), 500) || api.url,
    method: (cap(formData.get("method"), 10) || "GET").toUpperCase(),
    authType: cap(formData.get("auth_type"), 20) || "none",
    token: cap(formData.get("token"), 500),
    headerName: cap(formData.get("header_name"), 120),
    keywords: String(formData.get("keywords") || "").trim(),
    enabled: checked(formData, "enabled"),
    alwaysInclude: checked(formData, "always_include"),
    useVisitorToken: checked(formData, "use_visitor_token"),
  });
  redirectWithFlash(`/bots/${api.botId}/apis`, "API updated.", "success");
}

export async function botapiDeleteAction(apiId: string) {
  const user = await requireUser();
  if (!asId(apiId)) redirect("/bots");
  const api = getApi(apiId);
  if (!api) redirect("/bots");
  const bot = await ownedBot(String(api.botId), user.id);
  if (!bot) redirect("/bots");
  const botId = String(api.botId);
  deleteApi(apiId);
  redirectWithFlash(`/bots/${botId}/apis`, "API removed.", "success");
}
