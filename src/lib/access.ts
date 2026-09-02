import "server-only";
import { getPlan, countBotsByUser, getMonthlyUsage, currentPeriod } from "./repo";
import type { IUser, IPlan } from "./types";

export type PlanFeatures = {
  voice: boolean; image: boolean; handoff: boolean;
  triggers: boolean; departments: boolean; canned: boolean; apis: boolean;
};

const DEFAULT_FEATURES: PlanFeatures = {
  voice: true, image: true, handoff: true, triggers: true, departments: true, canned: true, apis: true,
};

/** Whether an account may currently use the product (not banned, not expired). */
export function accountState(user: Pick<IUser, "role" | "status" | "planExpiresAt">): {
  ok: boolean; reason: "" | "banned" | "expired";
} {
  if (user.role === "superadmin") return { ok: true, reason: "" };
  if (user.status === "banned") return { ok: false, reason: "banned" };
  if (user.planExpiresAt && new Date(user.planExpiresAt).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, reason: "" };
}

export function isAccountActive(user: Pick<IUser, "role" | "status" | "planExpiresAt">): boolean {
  return accountState(user).ok;
}

/** Resolve a user's plan (or null) and its parsed feature toggles. */
export function userPlan(user: Pick<IUser, "role" | "planId">): { plan: IPlan | null; features: PlanFeatures } {
  if (user.role === "superadmin") return { plan: null, features: DEFAULT_FEATURES };
  const plan = user.planId ? getPlan(user.planId) : null;
  if (!plan) return { plan: null, features: DEFAULT_FEATURES };
  let parsed: Partial<PlanFeatures> = {};
  try { parsed = JSON.parse(plan.featuresJson || "{}"); } catch { /* ignore */ }
  return { plan, features: { ...DEFAULT_FEATURES, ...parsed } };
}

export function hasFeature(user: Pick<IUser, "role" | "planId">, key: keyof PlanFeatures): boolean {
  return userPlan(user).features[key];
}

/** Can the account create another bot under its plan's max_bots limit. */
export function canCreateBot(user: Pick<IUser, "role" | "planId" | "_id">): { ok: boolean; limit: number; used: number } {
  if (user.role === "superadmin") return { ok: true, limit: -1, used: 0 };
  const { plan } = userPlan(user);
  const limit = plan ? plan.maxBots : 1;
  const used = countBotsByUser(user._id);
  return { ok: limit < 0 || used < limit, limit, used };
}

/** Is the account within its monthly message quota. */
export function withinMessageQuota(user: Pick<IUser, "role" | "planId" | "_id">): { ok: boolean; limit: number; used: number } {
  if (user.role === "superadmin") return { ok: true, limit: -1, used: 0 };
  const { plan } = userPlan(user);
  const limit = plan ? plan.maxMessagesPerMonth : 1000;
  const used = getMonthlyUsage(user._id, currentPeriod());
  return { ok: limit < 0 || used < limit, limit, used };
}
