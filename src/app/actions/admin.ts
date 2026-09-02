"use server";

import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { importJson, backupJsonTo } from "@/lib/sqlite";
import {
  getUserByEmail, getUserById, createUser, updateUser, setUserStatus, deleteUser,
  createBot, updateBot, createQa, getPlan, listPlans,
  createPlan, updatePlan, deletePlan,
} from "@/lib/repo";
import { hashPassword, requireSuperAdmin } from "@/lib/auth";
import { redirectWithFlash } from "@/lib/flash";
import { WEBSITE_PRESETS } from "@/lib/presets";

function f(fd: FormData, k: string) { return String(fd.get(k) ?? "").trim(); }
function num(fd: FormData, k: string, def = 0) { const v = Number(fd.get(k)); return Number.isFinite(v) ? v : def; }

/** Compute an expiry ISO string from a plan's duration (0 = unlimited → null). */
function expiryFromPlan(planId: number | null): string | null {
  if (!planId) return null;
  const plan = getPlan(planId);
  if (!plan || plan.durationDays <= 0) return null;
  const d = new Date();
  d.setDate(d.getDate() + plan.durationDays);
  return d.toISOString();
}

// ---------------- Accounts ----------------
export async function createAccountAction(formData: FormData) {
  const me = await requireSuperAdmin();
  const email = f(formData, "email").toLowerCase();
  const password = f(formData, "password");
  const name = f(formData, "name");
  const company = f(formData, "company");
  const planId = num(formData, "planId") || null;
  const websiteType = f(formData, "websiteType") || "custom";

  if (!email || !password) redirectWithFlash("/admin/accounts/new", "Email and password are required", "error");
  if (getUserByEmail(email)) redirectWithFlash("/admin/accounts/new", "Email already registered", "error");

  const startedAt = new Date().toISOString();
  const expiresAt = expiryFromPlan(planId);
  const user = createUser({
    email, name, company, passwordHash: await hashPassword(password), role: "user",
    createdBy: me._id, planId, planStartedAt: startedAt, planExpiresAt: expiresAt,
  });

  // Seed a starter bot using the chosen website preset.
  const preset = WEBSITE_PRESETS[websiteType] || WEBSITE_PRESETS.custom;
  const bot = createBot({ userId: user._id, name: `${name || company || "My"} Chatbot`, websiteType });
  updateBot(bot._id, { systemPrompt: preset.systemPrompt, quickRepliesJson: JSON.stringify(preset.quickReplies) });
  for (const qa of preset.qas) {
    createQa({ botId: bot._id, question: qa.q, answer: qa.a, keywords: qa.k });
  }

  revalidatePath("/admin/accounts");
  redirectWithFlash("/admin/accounts", `Account created for ${email}`, "success");
}

export async function updateAccountAction(formData: FormData) {
  await requireSuperAdmin();
  const id = num(formData, "id");
  const user = getUserById(id);
  if (!user || user.role === "superadmin") redirect("/admin/accounts");

  const fields: Record<string, unknown> = {
    name: f(formData, "name"),
    company: f(formData, "company"),
  };
  const newPlanId = num(formData, "planId") || null;
  const expiryMode = f(formData, "expiryMode"); // keep | plan | custom | unlimited

  if (newPlanId !== user.planId) {
    fields.planId = newPlanId;
    if (expiryMode === "keep") fields.planExpiresAt = expiryFromPlan(newPlanId);
  }
  if (expiryMode === "plan") fields.planExpiresAt = expiryFromPlan(newPlanId);
  else if (expiryMode === "unlimited") fields.planExpiresAt = null;
  else if (expiryMode === "custom") {
    const custom = f(formData, "expiresAt");
    if (custom) fields.planExpiresAt = new Date(custom).toISOString();
  }

  const newPassword = f(formData, "password");
  if (newPassword) fields.passwordHash = await hashPassword(newPassword);

  updateUser(id, fields);
  revalidatePath("/admin/accounts");
  redirectWithFlash(`/admin/accounts/${id}`, "Account updated", "success");
}

export async function setAccountStatusAction(formData: FormData) {
  await requireSuperAdmin();
  const id = num(formData, "id");
  const status = f(formData, "status") === "banned" ? "banned" : "active";
  const user = getUserById(id);
  if (user && user.role !== "superadmin") setUserStatus(id, status);
  revalidatePath("/admin/accounts");
  revalidatePath(`/admin/accounts/${id}`);
}

export async function deleteAccountAction(formData: FormData) {
  await requireSuperAdmin();
  const id = num(formData, "id");
  const user = getUserById(id);
  if (user && user.role !== "superadmin") deleteUser(id);
  revalidatePath("/admin/accounts");
  redirectWithFlash("/admin/accounts", "Account deleted", "success");
}

// ---------------- Plans ----------------
function featuresFromForm(formData: FormData): string {
  const keys = ["voice", "image", "handoff", "triggers", "departments", "canned", "apis"];
  const obj: Record<string, boolean> = {};
  for (const k of keys) obj[k] = formData.get(`feat_${k}`) != null;
  return JSON.stringify(obj);
}

export async function createPlanAction(formData: FormData) {
  await requireSuperAdmin();
  createPlan({
    name: f(formData, "name") || "Plan",
    description: f(formData, "description"),
    price: num(formData, "price"),
    billingPeriod: f(formData, "billingPeriod") || "monthly",
    durationDays: num(formData, "durationDays", 30),
    maxBots: num(formData, "maxBots", 1),
    maxMessagesPerMonth: num(formData, "maxMessagesPerMonth", 1000),
    maxAgents: num(formData, "maxAgents", 1),
    featuresJson: featuresFromForm(formData),
    isActive: formData.get("isActive") != null,
    sortOrder: num(formData, "sortOrder"),
  });
  revalidatePath("/admin/plans");
  redirectWithFlash("/admin/plans", "Plan created", "success");
}

export async function updatePlanAction(formData: FormData) {
  await requireSuperAdmin();
  const id = num(formData, "id");
  if (!getPlan(id)) redirect("/admin/plans");
  updatePlan(id, {
    name: f(formData, "name"),
    description: f(formData, "description"),
    price: num(formData, "price"),
    billingPeriod: f(formData, "billingPeriod") || "monthly",
    durationDays: num(formData, "durationDays", 30),
    maxBots: num(formData, "maxBots", 1),
    maxMessagesPerMonth: num(formData, "maxMessagesPerMonth", 1000),
    maxAgents: num(formData, "maxAgents", 1),
    featuresJson: featuresFromForm(formData),
    isActive: formData.get("isActive") != null,
    sortOrder: num(formData, "sortOrder"),
  });
  revalidatePath("/admin/plans");
  redirectWithFlash("/admin/plans", "Plan updated", "success");
}

export async function deletePlanAction(formData: FormData) {
  await requireSuperAdmin();
  const id = num(formData, "id");
  deletePlan(id);
  revalidatePath("/admin/plans");
  redirectWithFlash("/admin/plans", "Plan deleted", "success");
}

// Exposed for forms that need the plan list (kept here to avoid extra imports).
export async function _listPlans() { return listPlans(); }

// ---------------- Database import (restore from JSON export) ----------------
export async function importDbAction(formData: FormData) {
  await requireSuperAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name) {
    redirectWithFlash("/admin/database", "Please choose a .json export file to import.", "error");
  }
  const fileObj = file as File;
  if (!fileObj.name.toLowerCase().endsWith(".json")) {
    redirectWithFlash("/admin/database", "Only .json export files can be imported.", "error");
  }

  let result = { tables: 0, rows: 0 };
  let backupName = "";
  let errorMsg = "";
  try {
    const text = await fileObj.text();
    const data = JSON.parse(text) as Record<string, unknown>;
    // Snapshot current data to a JSON backup before replacing it.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupName = `pre-import-${stamp}.json`;
    backupJsonTo(path.join(process.cwd(), "data", "backups", backupName));
    result = importJson(data);
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Invalid JSON file";
  }

  if (errorMsg) redirectWithFlash("/admin/database", `Import failed: ${errorMsg}`, "error");
  revalidatePath("/admin/database");
  redirectWithFlash("/admin/database", `Imported ${result.rows} rows across ${result.tables} tables. A backup of your previous data was saved to backups/${backupName}.`, "success");
}
