import { getDb, genPublicId, nowIso, bool, toDate } from "./sqlite";
import type {
  IUser, IBot, IBotApi, IQA, IConversation, IMessage, IRating, INotification,
  IPlan, ICannedResponse, ITrigger, IDepartment, UserRole, UserStatus,
} from "./types";

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => Number(v || 0);
const b = (v: unknown) => !!v;

function placeholders(ids: (number | string)[]): string {
  return ids.map(() => "?").join(",");
}

// Generic UPDATE builder driven by a camel→column map.
type ColMap = Record<string, { col: string; type?: "bool" | "date" }>;
function buildSet(fields: Record<string, unknown>, map: ColMap): { sql: string; vals: unknown[] } {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    const m = map[k];
    if (!m) continue;
    sets.push(`${m.col} = ?`);
    if (m.type === "bool") vals.push(bool(v));
    else if (m.type === "date") vals.push(v ? new Date(v as string | number | Date).toISOString() : null);
    else vals.push(v as unknown);
  }
  return { sql: sets.join(", "), vals };
}

// ---------------- Users ----------------
function mapUser(r: Row | undefined): IUser | null {
  if (!r) return null;
  return {
    _id: n(r.id), email: s(r.email), passwordHash: s(r.password_hash), name: s(r.name),
    createdAt: toDate(r.created_at), smtpHost: s(r.smtp_host), smtpPort: n(r.smtp_port),
    smtpUsername: s(r.smtp_username), smtpPassword: s(r.smtp_password), smtpFromEmail: s(r.smtp_from_email),
    smtpUseTls: b(r.smtp_use_tls), notifyEmail: s(r.notify_email),
    lastEmailAt: toDate(r.last_email_at), lastEmailResult: s(r.last_email_result),
    role: (s(r.role) || "user") as UserRole, status: (s(r.status) || "active") as UserStatus,
    company: s(r.company), planId: r.plan_id == null ? null : n(r.plan_id),
    planStartedAt: toDate(r.plan_started_at), planExpiresAt: toDate(r.plan_expires_at),
    createdBy: r.created_by == null ? null : n(r.created_by),
  };
}
export function getUserById(id: number | string): IUser | null {
  return mapUser(getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as Row);
}
export function getUserByEmail(email: string): IUser | null {
  return mapUser(getDb().prepare("SELECT * FROM users WHERE email = ?").get(email) as Row);
}
export function createUser(data: {
  email: string; name: string; passwordHash: string;
  role?: UserRole; company?: string; createdBy?: number | string | null;
  planId?: number | string | null; planStartedAt?: string | null; planExpiresAt?: string | null;
}): IUser {
  const info = getDb()
    .prepare(
      `INSERT INTO users (email, name, password_hash, role, status, company, created_by, plan_id, plan_started_at, plan_expires_at, created_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.email, data.name, data.passwordHash, data.role ?? "user", data.company ?? "",
      data.createdBy ?? null, data.planId ?? null, data.planStartedAt ?? null, data.planExpiresAt ?? null, nowIso()
    );
  return getUserById(Number(info.lastInsertRowid))!;
}
const USER_MAP: ColMap = {
  name: { col: "name" }, company: { col: "company" }, passwordHash: { col: "password_hash" },
  smtpHost: { col: "smtp_host" }, smtpUsername: { col: "smtp_username" }, smtpPassword: { col: "smtp_password" },
  smtpFromEmail: { col: "smtp_from_email" }, notifyEmail: { col: "notify_email" }, smtpPort: { col: "smtp_port" },
  smtpUseTls: { col: "smtp_use_tls", type: "bool" },
  lastEmailAt: { col: "last_email_at", type: "date" }, lastEmailResult: { col: "last_email_result" },
  role: { col: "role" }, status: { col: "status" }, planId: { col: "plan_id" },
  planStartedAt: { col: "plan_started_at", type: "date" }, planExpiresAt: { col: "plan_expires_at", type: "date" },
};
export function updateUser(id: number | string, fields: Record<string, unknown>): void {
  const { sql, vals } = buildSet(fields, USER_MAP);
  if (!sql) return;
  getDb().prepare(`UPDATE users SET ${sql} WHERE id = ?`).run(...vals, id);
}

// --- Account management (super admin) ---
export function listUsers(opts: { role?: UserRole; search?: string } = {}): IUser[] {
  let sql = "SELECT * FROM users WHERE 1=1";
  const args: unknown[] = [];
  if (opts.role) { sql += " AND role = ?"; args.push(opts.role); }
  if (opts.search) { sql += " AND (email LIKE ? OR name LIKE ? OR company LIKE ?)"; const q = `%${opts.search}%`; args.push(q, q, q); }
  sql += " ORDER BY id DESC";
  return (getDb().prepare(sql).all(...args) as Row[]).map((r) => mapUser(r)!);
}
export function countUsers(role?: UserRole): number {
  const sql = role ? "SELECT COUNT(*) AS c FROM users WHERE role = ?" : "SELECT COUNT(*) AS c FROM users";
  const r = (role ? getDb().prepare(sql).get(role) : getDb().prepare(sql).get()) as Row;
  return n(r.c);
}
export function setUserStatus(id: number | string, status: UserStatus): void {
  getDb().prepare("UPDATE users SET status = ? WHERE id = ?").run(status, id);
}
export function deleteUser(id: number | string): void {
  const db = getDb();
  const bots = db.prepare("SELECT id FROM bots WHERE user_id = ?").all(id) as Row[];
  for (const bbot of bots) deleteBot(n(bbot.id));
  db.prepare("DELETE FROM canned_responses WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM departments WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM notifications WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM usage_monthly WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
}
export function countBotsByUser(userId: number | string): number {
  return n((getDb().prepare("SELECT COUNT(*) AS c FROM bots WHERE user_id = ?").get(userId) as Row).c);
}

// ---------------- Bots ----------------
function mapBot(r: Row | undefined): IBot | null {
  if (!r) return null;
  return {
    _id: n(r.id), publicId: s(r.public_id), userId: n(r.user_id), name: s(r.name), isActive: b(r.is_active),
    welcomeMessage: s(r.welcome_message), menuPrompt: s(r.menu_prompt), systemPrompt: s(r.system_prompt),
    primaryColor: s(r.primary_color), bubbleIcon: s(r.bubble_icon), botAvatar: s(r.bot_avatar),
    userAvatar: s(r.user_avatar), position: s(r.position), headerTitle: s(r.header_title),
    headerSubtitle: s(r.header_subtitle), enableLlm: b(r.enable_llm), quickRepliesJson: s(r.quick_replies_json),
    enableVoice: b(r.enable_voice), enableImageUpload: b(r.enable_image_upload), visionModel: s(r.vision_model),
    enableFeedback: b(r.enable_feedback), enableHumanHandoff: b(r.enable_human_handoff), enableSound: b(r.enable_sound),
    autoOpen: b(r.auto_open), enableContactForm: b(r.enable_contact_form), contactFormTitle: s(r.contact_form_title),
    contactFormSubtitle: s(r.contact_form_subtitle), trainedFromUrl: s(r.trained_from_url),
    allowedDomains: s(r.allowed_domains), domainCacheText: s(r.domain_cache_text), domainCacheAt: toDate(r.domain_cache_at),
    websiteType: s(r.website_type) || "custom", enableTriggers: r.enable_triggers == null ? true : b(r.enable_triggers),
    createdAt: toDate(r.created_at), updatedAt: toDate(r.updated_at),
  };
}
export function getBotById(id: number | string): IBot | null {
  return mapBot(getDb().prepare("SELECT * FROM bots WHERE id = ?").get(id) as Row);
}
export function getBotByPublicId(publicId: string): IBot | null {
  return mapBot(getDb().prepare("SELECT * FROM bots WHERE public_id = ?").get(publicId) as Row);
}
export function getOwnedBot(id: number | string, userId: number | string): IBot | null {
  return mapBot(getDb().prepare("SELECT * FROM bots WHERE id = ? AND user_id = ?").get(id, userId) as Row);
}
export function listBotsByUser(userId: number | string): IBot[] {
  return (getDb().prepare("SELECT * FROM bots WHERE user_id = ? ORDER BY id ASC").all(userId) as Row[]).map((r) => mapBot(r)!);
}
export function getAnyBot(): IBot | null {
  return mapBot(getDb().prepare("SELECT * FROM bots ORDER BY id ASC LIMIT 1").get() as Row);
}
export function createBot(data: { userId: number | string; name: string; websiteType?: string }): IBot {
  const info = getDb()
    .prepare("INSERT INTO bots (public_id, user_id, name, website_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(genPublicId(), data.userId, data.name, data.websiteType ?? "custom", nowIso(), nowIso());
  return getBotById(Number(info.lastInsertRowid))!;
}
const BOT_MAP: ColMap = {
  name: { col: "name" }, isActive: { col: "is_active", type: "bool" }, welcomeMessage: { col: "welcome_message" },
  menuPrompt: { col: "menu_prompt" }, systemPrompt: { col: "system_prompt" }, primaryColor: { col: "primary_color" },
  bubbleIcon: { col: "bubble_icon" }, botAvatar: { col: "bot_avatar" }, userAvatar: { col: "user_avatar" },
  position: { col: "position" }, headerTitle: { col: "header_title" }, headerSubtitle: { col: "header_subtitle" },
  quickRepliesJson: { col: "quick_replies_json" },
  enableLlm: { col: "enable_llm", type: "bool" }, enableVoice: { col: "enable_voice", type: "bool" },
  enableImageUpload: { col: "enable_image_upload", type: "bool" }, visionModel: { col: "vision_model" },
  enableFeedback: { col: "enable_feedback", type: "bool" }, enableHumanHandoff: { col: "enable_human_handoff", type: "bool" },
  enableSound: { col: "enable_sound", type: "bool" }, autoOpen: { col: "auto_open", type: "bool" },
  enableContactForm: { col: "enable_contact_form", type: "bool" }, contactFormTitle: { col: "contact_form_title" },
  contactFormSubtitle: { col: "contact_form_subtitle" }, trainedFromUrl: { col: "trained_from_url" },
  allowedDomains: { col: "allowed_domains" }, domainCacheText: { col: "domain_cache_text" },
  domainCacheAt: { col: "domain_cache_at", type: "date" },
  websiteType: { col: "website_type" }, enableTriggers: { col: "enable_triggers", type: "bool" },
};
export function updateBot(id: number | string, fields: Record<string, unknown>): void {
  const { sql, vals } = buildSet(fields, BOT_MAP);
  if (!sql) return;
  getDb().prepare(`UPDATE bots SET ${sql}, updated_at = ? WHERE id = ?`).run(...vals, nowIso(), id);
}
export function deleteBot(id: number | string): void {
  const db = getDb();
  db.prepare("DELETE FROM qas WHERE bot_id = ?").run(id);
  db.prepare("DELETE FROM bot_apis WHERE bot_id = ?").run(id);
  db.prepare("DELETE FROM bots WHERE id = ?").run(id);
}

// ---------------- Bot APIs ----------------
function mapApi(r: Row | undefined): IBotApi | null {
  if (!r) return null;
  return {
    _id: n(r.id), botId: n(r.bot_id), name: s(r.name), description: s(r.description), url: s(r.url),
    method: s(r.method), authType: s(r.auth_type), token: s(r.token), headerName: s(r.header_name),
    keywords: s(r.keywords), enabled: b(r.enabled), alwaysInclude: b(r.always_include),
    useVisitorToken: b(r.use_visitor_token), createdAt: toDate(r.created_at),
  };
}
export function listApisByBot(botId: number | string): IBotApi[] {
  return (getDb().prepare("SELECT * FROM bot_apis WHERE bot_id = ? ORDER BY id ASC").all(botId) as Row[]).map((r) => mapApi(r)!);
}
export function getApi(id: number | string): IBotApi | null {
  return mapApi(getDb().prepare("SELECT * FROM bot_apis WHERE id = ?").get(id) as Row);
}
export function createApi(data: Omit<IBotApi, "_id" | "createdAt">): IBotApi {
  const info = getDb()
    .prepare(
      `INSERT INTO bot_apis (bot_id, name, description, url, method, auth_type, token, header_name, keywords, enabled, always_include, use_visitor_token, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(data.botId, data.name, data.description, data.url, data.method, data.authType, data.token,
      data.headerName, data.keywords, bool(data.enabled), bool(data.alwaysInclude), bool(data.useVisitorToken), nowIso());
  return getApi(Number(info.lastInsertRowid))!;
}
const API_MAP: ColMap = {
  name: { col: "name" }, description: { col: "description" }, url: { col: "url" }, method: { col: "method" },
  authType: { col: "auth_type" }, token: { col: "token" }, headerName: { col: "header_name" }, keywords: { col: "keywords" },
  enabled: { col: "enabled", type: "bool" }, alwaysInclude: { col: "always_include", type: "bool" },
  useVisitorToken: { col: "use_visitor_token", type: "bool" },
};
export function updateApi(id: number | string, fields: Record<string, unknown>): void {
  const { sql, vals } = buildSet(fields, API_MAP);
  if (!sql) return;
  getDb().prepare(`UPDATE bot_apis SET ${sql} WHERE id = ?`).run(...vals, id);
}
export function deleteApi(id: number | string): void {
  getDb().prepare("DELETE FROM bot_apis WHERE id = ?").run(id);
}

// ---------------- QAs ----------------
function mapQa(r: Row | undefined): IQA | null {
  if (!r) return null;
  return {
    _id: n(r.id), botId: n(r.bot_id), parentId: r.parent_id == null ? null : n(r.parent_id),
    position: n(r.position), question: s(r.question), answer: s(r.answer), keywords: s(r.keywords),
    source: s(r.source), showInMenu: b(r.show_in_menu),
  };
}
export function listQasByBot(botId: number | string): IQA[] {
  return (getDb().prepare("SELECT * FROM qas WHERE bot_id = ? ORDER BY position ASC, id ASC").all(botId) as Row[]).map((r) => mapQa(r)!);
}
export function listMenu(botId: number | string): IQA[] {
  return (getDb().prepare("SELECT * FROM qas WHERE bot_id = ? AND parent_id IS NULL AND show_in_menu = 1 ORDER BY position ASC, id ASC").all(botId) as Row[]).map((r) => mapQa(r)!);
}
export function listChildren(botId: number | string, parentId: number | string, onlyMenu = false): IQA[] {
  const extra = onlyMenu ? "AND show_in_menu = 1" : "";
  return (getDb().prepare(`SELECT * FROM qas WHERE bot_id = ? AND parent_id = ? ${extra} ORDER BY position ASC, id ASC`).all(botId, parentId) as Row[]).map((r) => mapQa(r)!);
}
export function getQa(id: number | string): IQA | null {
  return mapQa(getDb().prepare("SELECT * FROM qas WHERE id = ?").get(id) as Row);
}
export function getQaInBot(id: number | string, botId: number | string): IQA | null {
  return mapQa(getDb().prepare("SELECT * FROM qas WHERE id = ? AND bot_id = ?").get(id, botId) as Row);
}
export function createQa(data: {
  botId: number | string; question: string; answer: string; keywords?: string;
  parentId?: number | string | null; source?: string; position?: number; showInMenu?: boolean;
}): IQA {
  const info = getDb()
    .prepare("INSERT INTO qas (bot_id, parent_id, position, question, answer, keywords, source, show_in_menu) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(data.botId, data.parentId ?? null, data.position ?? 0, data.question, data.answer,
      data.keywords ?? "", data.source ?? "manual", bool(data.showInMenu ?? true));
  return getQa(Number(info.lastInsertRowid))!;
}
export function updateQaContent(id: number | string, fields: { question?: string; answer?: string; keywords?: string; parentId?: number | null }): void {
  const map: ColMap = { question: { col: "question" }, answer: { col: "answer" }, keywords: { col: "keywords" }, parentId: { col: "parent_id" } };
  const { sql, vals } = buildSet(fields as Record<string, unknown>, map);
  if (!sql) return;
  getDb().prepare(`UPDATE qas SET ${sql} WHERE id = ?`).run(...vals, id);
}
export function setQaShowInMenu(id: number | string, show: boolean): void {
  getDb().prepare("UPDATE qas SET show_in_menu = ? WHERE id = ?").run(bool(show), id);
}
export function setQaParentPosition(id: number | string, parentId: number | null, position: number): void {
  getDb().prepare("UPDATE qas SET parent_id = ?, position = ? WHERE id = ?").run(parentId, position, id);
}
export function bulkSetShowInMenu(botId: number | string, ids: number[], show: boolean): void {
  if (!ids.length) return;
  getDb().prepare(`UPDATE qas SET show_in_menu = ? WHERE bot_id = ? AND id IN (${placeholders(ids)})`).run(bool(show), botId, ...ids);
}
export function deleteQaTree(id: number | string, botId: number | string): void {
  const db = getDb();
  const children = db.prepare("SELECT id FROM qas WHERE bot_id = ? AND parent_id = ?").all(botId, id) as Row[];
  for (const c of children) deleteQaTree(n(c.id), botId);
  db.prepare("DELETE FROM qas WHERE id = ?").run(id);
}
export function listQaIdParent(botId: number | string): { id: number; parentId: number | null }[] {
  return (getDb().prepare("SELECT id, parent_id FROM qas WHERE bot_id = ?").all(botId) as Row[]).map((r) => ({ id: n(r.id), parentId: r.parent_id == null ? null : n(r.parent_id) }));
}
export function listSiblings(botId: number | string, parentId: number | null, exceptId: number | string): IQA[] {
  const cond = parentId == null ? "parent_id IS NULL" : "parent_id = ?";
  const args = parentId == null ? [botId, exceptId] : [botId, parentId, exceptId];
  return (getDb().prepare(`SELECT * FROM qas WHERE bot_id = ? AND ${cond} AND id != ? ORDER BY position ASC, id ASC`).all(...args) as Row[]).map((r) => mapQa(r)!);
}
export function countQasByBots(botIds: (number | string)[]): number {
  if (!botIds.length) return 0;
  const r = getDb().prepare(`SELECT COUNT(*) AS c FROM qas WHERE bot_id IN (${placeholders(botIds)})`).get(...botIds) as Row;
  return n(r.c);
}

// ---------------- Conversations ----------------
function mapConvo(r: Row | undefined): IConversation | null {
  if (!r) return null;
  return {
    _id: n(r.id), botId: n(r.bot_id), sessionId: s(r.session_id), pageUrl: s(r.page_url), mode: s(r.mode),
    agentId: r.agent_id == null ? null : n(r.agent_id), agentJoinedAt: toDate(r.agent_joined_at),
    visitorName: s(r.visitor_name), createdAt: toDate(r.created_at),
    tags: s(r.tags), departmentId: r.department_id == null ? null : n(r.department_id),
    visitorEmail: s(r.visitor_email), visitorMeta: s(r.visitor_meta),
  };
}
export function getConvo(id: number | string): IConversation | null {
  return mapConvo(getDb().prepare("SELECT * FROM conversations WHERE id = ?").get(id) as Row);
}
export function getConvoBySession(botId: number | string, sessionId: string): IConversation | null {
  return mapConvo(getDb().prepare("SELECT * FROM conversations WHERE bot_id = ? AND session_id = ?").get(botId, sessionId) as Row);
}
export function createConvo(data: { botId: number | string; sessionId: string; pageUrl?: string; visitorMeta?: string }): IConversation {
  const info = getDb()
    .prepare("INSERT INTO conversations (bot_id, session_id, page_url, mode, visitor_meta, created_at) VALUES (?, ?, ?, 'ai', ?, ?)")
    .run(data.botId, data.sessionId, data.pageUrl ?? "", data.visitorMeta ?? "", nowIso());
  return getConvo(Number(info.lastInsertRowid))!;
}
export function listConvosByBots(botIds: (number | string)[]): IConversation[] {
  if (!botIds.length) return [];
  return (getDb().prepare(`SELECT * FROM conversations WHERE bot_id IN (${placeholders(botIds)})`).all(...botIds) as Row[]).map((r) => mapConvo(r)!);
}
export function listConvosByBot(botId: number | string, limit = 100): IConversation[] {
  return (getDb().prepare("SELECT * FROM conversations WHERE bot_id = ? ORDER BY created_at DESC, id DESC LIMIT ?").all(botId, limit) as Row[]).map((r) => mapConvo(r)!);
}
export function listLiveConvos(botIds: (number | string)[], limit = 100): IConversation[] {
  if (!botIds.length) return [];
  return (getDb().prepare(`SELECT * FROM conversations WHERE bot_id IN (${placeholders(botIds)}) AND mode != 'ai' ORDER BY id DESC LIMIT ?`).all(...botIds, limit) as Row[]).map((r) => mapConvo(r)!);
}
const CONVO_MAP: ColMap = {
  mode: { col: "mode" }, agentId: { col: "agent_id" }, agentJoinedAt: { col: "agent_joined_at", type: "date" },
  visitorName: { col: "visitor_name" }, pageUrl: { col: "page_url" },
  tags: { col: "tags" }, departmentId: { col: "department_id" }, visitorEmail: { col: "visitor_email" },
};
export function updateConvo(id: number | string, fields: Record<string, unknown>): void {
  const { sql, vals } = buildSet(fields, CONVO_MAP);
  if (!sql) return;
  getDb().prepare(`UPDATE conversations SET ${sql} WHERE id = ?`).run(...vals, id);
}

// ---------------- Messages ----------------
function mapMessage(r: Row | undefined): IMessage | null {
  if (!r) return null;
  return {
    _id: n(r.id), conversationId: n(r.conversation_id), role: s(r.role), content: s(r.content),
    imageUrl: s(r.image_url), createdAt: toDate(r.created_at),
  };
}
export function createMessage(conversationId: number | string, role: string, content: string, imageUrl = ""): IMessage {
  const info = getDb()
    .prepare("INSERT INTO messages (conversation_id, role, content, image_url, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(conversationId, role, content, imageUrl, nowIso());
  return getMessage(Number(info.lastInsertRowid))!;
}
export function getMessage(id: number | string): IMessage | null {
  return mapMessage(getDb().prepare("SELECT * FROM messages WHERE id = ?").get(id) as Row);
}
export function hasAgentMessage(conversationId: number | string): boolean {
  return !!getDb().prepare("SELECT 1 FROM messages WHERE conversation_id = ? AND role = 'agent' LIMIT 1").get(conversationId);
}
export function lastAgentMessageAt(conversationId: number | string): Date | null {
  const r = getDb().prepare("SELECT created_at FROM messages WHERE conversation_id = ? AND role = 'agent' ORDER BY id DESC LIMIT 1").get(conversationId) as Row | undefined;
  return r ? toDate(r.created_at) : null;
}
export function listMessages(conversationId: number | string): IMessage[] {
  return (getDb().prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC").all(conversationId) as Row[]).map((r) => mapMessage(r)!);
}
export function listMessagesAfter(conversationId: number | string, afterId: number): IMessage[] {
  return (getDb().prepare("SELECT * FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id ASC").all(conversationId, afterId) as Row[]).map((r) => mapMessage(r)!);
}
export function listMessagesByConvos(convoIds: (number | string)[]): IMessage[] {
  if (!convoIds.length) return [];
  return (getDb().prepare(`SELECT * FROM messages WHERE conversation_id IN (${placeholders(convoIds)}) ORDER BY id ASC`).all(...convoIds) as Row[]).map((r) => mapMessage(r)!);
}
export function recentBotMessages(conversationId: number | string, limit: number): IMessage[] {
  return (getDb().prepare("SELECT * FROM messages WHERE conversation_id = ? AND role = 'bot' ORDER BY id DESC LIMIT ?").all(conversationId, limit) as Row[]).map((r) => mapMessage(r)!);
}

// ---------------- Ratings ----------------
function mapRating(r: Row | undefined): IRating | null {
  if (!r) return null;
  return { _id: n(r.id), messageId: n(r.message_id), score: n(r.score), comment: s(r.comment), createdAt: toDate(r.created_at) };
}
export function getRatingByMessage(messageId: number | string): IRating | null {
  return mapRating(getDb().prepare("SELECT * FROM ratings WHERE message_id = ?").get(messageId) as Row);
}
export function upsertRating(messageId: number | string, score: number, comment: string): void {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM ratings WHERE message_id = ?").get(messageId) as Row | undefined;
  if (existing) db.prepare("UPDATE ratings SET score = ?, comment = ? WHERE message_id = ?").run(score, comment, messageId);
  else db.prepare("INSERT INTO ratings (message_id, score, comment, created_at) VALUES (?, ?, ?, ?)").run(messageId, score, comment, nowIso());
}
export function countRatings(messageIds: (number | string)[], score: number): number {
  if (!messageIds.length) return 0;
  const r = getDb().prepare(`SELECT COUNT(*) AS c FROM ratings WHERE score = ? AND message_id IN (${placeholders(messageIds)})`).get(score, ...messageIds) as Row;
  return n(r.c);
}
export function listRatingsByMessages(messageIds: (number | string)[]): IRating[] {
  if (!messageIds.length) return [];
  return (getDb().prepare(`SELECT * FROM ratings WHERE message_id IN (${placeholders(messageIds)})`).all(...messageIds) as Row[]).map((r) => mapRating(r)!);
}

// ---------------- Notifications ----------------
function mapNote(r: Row | undefined): INotification | null {
  if (!r) return null;
  return {
    _id: n(r.id), userId: n(r.user_id), botId: r.bot_id == null ? null : n(r.bot_id),
    conversationId: r.conversation_id == null ? null : n(r.conversation_id), type: s(r.type),
    title: s(r.title), body: s(r.body), isRead: b(r.is_read), createdAt: toDate(r.created_at),
  };
}
export function createNotification(data: { userId: number | string; botId?: number | string | null; conversationId?: number | string | null; type: string; title: string; body: string }): INotification {
  const info = getDb()
    .prepare("INSERT INTO notifications (user_id, bot_id, conversation_id, type, title, body, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)")
    .run(data.userId, data.botId ?? null, data.conversationId ?? null, data.type, data.title, data.body, nowIso());
  return mapNote(getDb().prepare("SELECT * FROM notifications WHERE id = ?").get(Number(info.lastInsertRowid)) as Row)!;
}
export function listRecentNotifications(userId: number | string, limit: number, unreadOnly: boolean): INotification[] {
  const cond = unreadOnly ? "AND is_read = 0" : "";
  return (getDb().prepare(`SELECT * FROM notifications WHERE user_id = ? ${cond} ORDER BY created_at DESC, id DESC LIMIT ?`).all(userId, limit) as Row[]).map((r) => mapNote(r)!);
}
export function listNotificationsByType(userId: number | string, type: string, limit: number, offset: number): INotification[] {
  return (getDb().prepare("SELECT * FROM notifications WHERE user_id = ? AND type = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?").all(userId, type, limit, offset) as Row[]).map((r) => mapNote(r)!);
}
export function countNotifications(userId: number | string, opts: { type?: string; unread?: boolean } = {}): number {
  let sql = "SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?";
  const args: unknown[] = [userId];
  if (opts.type) { sql += " AND type = ?"; args.push(opts.type); }
  if (opts.unread) sql += " AND is_read = 0";
  return n((getDb().prepare(sql).get(...args) as Row).c);
}
export function markNotificationRead(id: number | string, userId: number | string): boolean {
  return getDb().prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}
export function markNotificationsRead(ids: number[]): void {
  if (!ids.length) return;
  getDb().prepare(`UPDATE notifications SET is_read = 1 WHERE id IN (${placeholders(ids)})`).run(...ids);
}
export function markAllNotificationsRead(userId: number | string): void {
  getDb().prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0").run(userId);
}
export function deleteNotification(id: number | string, userId: number | string): boolean {
  return getDb().prepare("DELETE FROM notifications WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}
/** True if a notification of `type` whose body contains `marker` already exists for the user (dedupe). */
export function hasNotificationMarker(userId: number | string, type: string, marker: string): boolean {
  return !!getDb()
    .prepare("SELECT 1 FROM notifications WHERE user_id = ? AND type = ? AND body LIKE ? LIMIT 1")
    .get(userId, type, `%${marker}%`);
}

// ---------------- Customer accounts whose subscription is about to lapse ----------------
export function listAccountsExpiringWithin(days: number): IUser[] {
  const now = nowIso();
  const until = new Date(Date.now() + days * 86400000).toISOString();
  return (getDb()
    .prepare(
      `SELECT * FROM users WHERE role != 'superadmin' AND status = 'active'
       AND plan_expires_at IS NOT NULL AND plan_expires_at > ? AND plan_expires_at <= ?
       ORDER BY plan_expires_at ASC`
    )
    .all(now, until) as Row[]).map((r) => mapUser(r)!);
}

// ---------------- Plans (subscription packages) ----------------
function mapPlan(r: Row | undefined): IPlan | null {
  if (!r) return null;
  return {
    _id: n(r.id), name: s(r.name), description: s(r.description), price: Number(r.price || 0),
    billingPeriod: s(r.billing_period), durationDays: n(r.duration_days), maxBots: n(r.max_bots),
    maxMessagesPerMonth: n(r.max_messages_per_month), maxAgents: n(r.max_agents), featuresJson: s(r.features_json) || "{}",
    isActive: b(r.is_active), sortOrder: n(r.sort_order), createdAt: toDate(r.created_at),
  };
}
export function listPlans(activeOnly = false): IPlan[] {
  const cond = activeOnly ? "WHERE is_active = 1" : "";
  return (getDb().prepare(`SELECT * FROM plans ${cond} ORDER BY sort_order ASC, id ASC`).all() as Row[]).map((r) => mapPlan(r)!);
}
export function getPlan(id: number | string): IPlan | null {
  return mapPlan(getDb().prepare("SELECT * FROM plans WHERE id = ?").get(id) as Row);
}
export function createPlan(data: Omit<IPlan, "_id" | "createdAt">): IPlan {
  const info = getDb().prepare(
    `INSERT INTO plans (name, description, price, billing_period, duration_days, max_bots, max_messages_per_month, max_agents, features_json, is_active, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(data.name, data.description, data.price, data.billingPeriod, data.durationDays, data.maxBots,
    data.maxMessagesPerMonth, data.maxAgents, data.featuresJson, bool(data.isActive), data.sortOrder, nowIso());
  return getPlan(Number(info.lastInsertRowid))!;
}
const PLAN_MAP: ColMap = {
  name: { col: "name" }, description: { col: "description" }, price: { col: "price" },
  billingPeriod: { col: "billing_period" }, durationDays: { col: "duration_days" }, maxBots: { col: "max_bots" },
  maxMessagesPerMonth: { col: "max_messages_per_month" }, maxAgents: { col: "max_agents" },
  featuresJson: { col: "features_json" }, isActive: { col: "is_active", type: "bool" }, sortOrder: { col: "sort_order" },
};
export function updatePlan(id: number | string, fields: Record<string, unknown>): void {
  const { sql, vals } = buildSet(fields, PLAN_MAP);
  if (!sql) return;
  getDb().prepare(`UPDATE plans SET ${sql} WHERE id = ?`).run(...vals, id);
}
export function deletePlan(id: number | string): void {
  const db = getDb();
  db.prepare("UPDATE users SET plan_id = NULL WHERE plan_id = ?").run(id);
  db.prepare("DELETE FROM plans WHERE id = ?").run(id);
}
export function countUsersOnPlan(planId: number | string): number {
  return n((getDb().prepare("SELECT COUNT(*) AS c FROM users WHERE plan_id = ?").get(planId) as Row).c);
}

// ---------------- Canned / shortcut responses ----------------
function mapCanned(r: Row | undefined): ICannedResponse | null {
  if (!r) return null;
  return { _id: n(r.id), userId: n(r.user_id), shortcut: s(r.shortcut), title: s(r.title), content: s(r.content), createdAt: toDate(r.created_at) };
}
export function listCanned(userId: number | string): ICannedResponse[] {
  return (getDb().prepare("SELECT * FROM canned_responses WHERE user_id = ? ORDER BY id ASC").all(userId) as Row[]).map((r) => mapCanned(r)!);
}
export function getCanned(id: number | string): ICannedResponse | null {
  return mapCanned(getDb().prepare("SELECT * FROM canned_responses WHERE id = ?").get(id) as Row);
}
export function createCanned(data: { userId: number | string; shortcut: string; title: string; content: string }): ICannedResponse {
  const info = getDb().prepare("INSERT INTO canned_responses (user_id, shortcut, title, content, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(data.userId, data.shortcut, data.title, data.content, nowIso());
  return getCanned(Number(info.lastInsertRowid))!;
}
export function updateCanned(id: number | string, userId: number | string, fields: { shortcut?: string; title?: string; content?: string }): void {
  const map: ColMap = { shortcut: { col: "shortcut" }, title: { col: "title" }, content: { col: "content" } };
  const { sql, vals } = buildSet(fields as Record<string, unknown>, map);
  if (!sql) return;
  getDb().prepare(`UPDATE canned_responses SET ${sql} WHERE id = ? AND user_id = ?`).run(...vals, id, userId);
}
export function deleteCanned(id: number | string, userId: number | string): void {
  getDb().prepare("DELETE FROM canned_responses WHERE id = ? AND user_id = ?").run(id, userId);
}

// ---------------- Triggers (proactive auto-messages) ----------------
function mapTrigger(r: Row | undefined): ITrigger | null {
  if (!r) return null;
  return {
    _id: n(r.id), botId: n(r.bot_id), name: s(r.name), enabled: b(r.enabled), conditionType: s(r.condition_type),
    conditionValue: s(r.condition_value), message: s(r.message), delaySeconds: n(r.delay_seconds),
    oncePerSession: b(r.once_per_session), createdAt: toDate(r.created_at),
  };
}
export function listTriggers(botId: number | string, enabledOnly = false): ITrigger[] {
  const cond = enabledOnly ? "AND enabled = 1" : "";
  return (getDb().prepare(`SELECT * FROM triggers WHERE bot_id = ? ${cond} ORDER BY id ASC`).all(botId) as Row[]).map((r) => mapTrigger(r)!);
}
export function getTrigger(id: number | string): ITrigger | null {
  return mapTrigger(getDb().prepare("SELECT * FROM triggers WHERE id = ?").get(id) as Row);
}
export function createTrigger(data: { botId: number | string; name: string; conditionType: string; conditionValue: string; message: string; delaySeconds: number; oncePerSession: boolean; enabled: boolean }): ITrigger {
  const info = getDb().prepare(
    `INSERT INTO triggers (bot_id, name, enabled, condition_type, condition_value, message, delay_seconds, once_per_session, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(data.botId, data.name, bool(data.enabled), data.conditionType, data.conditionValue, data.message, data.delaySeconds, bool(data.oncePerSession), nowIso());
  return getTrigger(Number(info.lastInsertRowid))!;
}
const TRIGGER_MAP: ColMap = {
  name: { col: "name" }, enabled: { col: "enabled", type: "bool" }, conditionType: { col: "condition_type" },
  conditionValue: { col: "condition_value" }, message: { col: "message" }, delaySeconds: { col: "delay_seconds" },
  oncePerSession: { col: "once_per_session", type: "bool" },
};
export function updateTrigger(id: number | string, fields: Record<string, unknown>): void {
  const { sql, vals } = buildSet(fields, TRIGGER_MAP);
  if (!sql) return;
  getDb().prepare(`UPDATE triggers SET ${sql} WHERE id = ?`).run(...vals, id);
}
export function deleteTrigger(id: number | string): void {
  getDb().prepare("DELETE FROM triggers WHERE id = ?").run(id);
}

// ---------------- Departments ----------------
function mapDept(r: Row | undefined): IDepartment | null {
  if (!r) return null;
  return { _id: n(r.id), userId: n(r.user_id), name: s(r.name), description: s(r.description), createdAt: toDate(r.created_at) };
}
export function listDepartments(userId: number | string): IDepartment[] {
  return (getDb().prepare("SELECT * FROM departments WHERE user_id = ? ORDER BY id ASC").all(userId) as Row[]).map((r) => mapDept(r)!);
}
export function createDepartment(data: { userId: number | string; name: string; description?: string }): IDepartment {
  const info = getDb().prepare("INSERT INTO departments (user_id, name, description, created_at) VALUES (?, ?, ?, ?)")
    .run(data.userId, data.name, data.description ?? "", nowIso());
  return mapDept(getDb().prepare("SELECT * FROM departments WHERE id = ?").get(Number(info.lastInsertRowid)) as Row)!;
}
export function deleteDepartment(id: number | string, userId: number | string): void {
  const db = getDb();
  db.prepare("UPDATE conversations SET department_id = NULL WHERE department_id = ?").run(id);
  db.prepare("DELETE FROM departments WHERE id = ? AND user_id = ?").run(id, userId);
}

// ---------------- Monthly usage (plan quota) ----------------
export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}
export function incrementMonthlyUsage(userId: number | string, period: string, by = 1): void {
  getDb().prepare(
    `INSERT INTO usage_monthly (user_id, period, message_count) VALUES (?, ?, ?)
     ON CONFLICT(user_id, period) DO UPDATE SET message_count = message_count + ?`
  ).run(userId, period, by, by);
}
export function getMonthlyUsage(userId: number | string, period: string): number {
  const r = getDb().prepare("SELECT message_count AS c FROM usage_monthly WHERE user_id = ? AND period = ?").get(userId, period) as Row | undefined;
  return r ? n(r.c) : 0;
}
export function getUserIdForBot(botId: number | string): number | null {
  const r = getDb().prepare("SELECT user_id FROM bots WHERE id = ?").get(botId) as Row | undefined;
  return r ? n(r.user_id) : null;
}
