// Plain row types returned by the repository layer (camelCase, JS booleans,
// Date objects). `_id` mirrors the integer primary key as a number so existing
// `String(x._id)` call-sites keep working.

export type UserRole = "superadmin" | "user";
export type UserStatus = "active" | "banned";

export interface IUser {
  _id: number;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date | null;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  smtpFromEmail: string;
  smtpUseTls: boolean;
  notifyEmail: string;
  lastEmailAt: Date | null;
  lastEmailResult: string;
  // Roles & subscription (added in v3 — super admin / multi-tenant)
  role: UserRole;
  status: UserStatus;
  company: string;
  planId: number | null;
  planStartedAt: Date | null;
  planExpiresAt: Date | null;
  createdBy: number | null;
}

export interface IPlan {
  _id: number;
  name: string;
  description: string;
  price: number;
  billingPeriod: string;
  durationDays: number;
  maxBots: number;
  maxMessagesPerMonth: number;
  maxAgents: number;
  featuresJson: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date | null;
}

export interface ICannedResponse {
  _id: number;
  userId: number;
  shortcut: string;
  title: string;
  content: string;
  createdAt: Date | null;
}

export interface ITrigger {
  _id: number;
  botId: number;
  name: string;
  enabled: boolean;
  conditionType: string;
  conditionValue: string;
  message: string;
  delaySeconds: number;
  oncePerSession: boolean;
  createdAt: Date | null;
}

export interface IDepartment {
  _id: number;
  userId: number;
  name: string;
  description: string;
  createdAt: Date | null;
}

export interface IBot {
  _id: number;
  publicId: string;
  userId: number;
  name: string;
  isActive: boolean;
  welcomeMessage: string;
  menuPrompt: string;
  systemPrompt: string;
  primaryColor: string;
  bubbleIcon: string;
  botAvatar: string;
  userAvatar: string;
  position: string;
  headerTitle: string;
  headerSubtitle: string;
  enableLlm: boolean;
  quickRepliesJson: string;
  enableVoice: boolean;
  enableImageUpload: boolean;
  visionModel: string;
  enableFeedback: boolean;
  enableHumanHandoff: boolean;
  enableSound: boolean;
  autoOpen: boolean;
  enableContactForm: boolean;
  contactFormTitle: string;
  contactFormSubtitle: string;
  trainedFromUrl: string;
  allowedDomains: string;
  domainCacheText: string;
  domainCacheAt: Date | null;
  websiteType: string;
  enableTriggers: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface IBotApi {
  _id: number;
  botId: number;
  name: string;
  description: string;
  url: string;
  method: string;
  authType: string;
  token: string;
  headerName: string;
  keywords: string;
  enabled: boolean;
  alwaysInclude: boolean;
  useVisitorToken: boolean;
  createdAt: Date | null;
}

export interface IQA {
  _id: number;
  botId: number;
  parentId: number | null;
  position: number;
  question: string;
  answer: string;
  keywords: string;
  source: string;
  showInMenu: boolean;
}

export interface IConversation {
  _id: number;
  botId: number;
  sessionId: string;
  pageUrl: string;
  mode: string;
  agentId: number | null;
  agentJoinedAt: Date | null;
  visitorName: string;
  createdAt: Date | null;
  tags: string;
  departmentId: number | null;
  visitorEmail: string;
  visitorMeta: string;
}

export interface IMessage {
  _id: number;
  conversationId: number;
  role: string;
  content: string;
  imageUrl: string;
  createdAt: Date | null;
}

export interface IRating {
  _id: number;
  messageId: number;
  score: number;
  comment: string;
  createdAt: Date | null;
}

export interface INotification {
  _id: number;
  userId: number;
  botId: number | null;
  conversationId: number | null;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date | null;
}
