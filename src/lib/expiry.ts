import "server-only";
import {
  listUsers, listAccountsExpiringWithin, hasNotificationMarker, createNotification, getPlan,
} from "./repo";

export const EXPIRY_WARN_DAYS = 5;

/**
 * Scans for customer accounts whose subscription expires within EXPIRY_WARN_DAYS
 * and raises a (deduped) notification for every super admin. Cheap + idempotent:
 * a unique marker per account+expiry-date stops duplicates, and a renewed expiry
 * date produces a fresh alert. Safe to call on every notifications poll.
 */
export function notifyExpiringAccounts(): void {
  const expiring = listAccountsExpiringWithin(EXPIRY_WARN_DAYS);
  if (!expiring.length) return;

  const admins = listUsers({ role: "superadmin" });
  if (!admins.length) return;

  for (const acc of expiring) {
    if (!acc.planExpiresAt) continue;
    const expDate = new Date(acc.planExpiresAt);
    const dateKey = expDate.toISOString().slice(0, 10);
    const marker = `[exp:${acc._id}:${dateKey}]`;
    const daysLeft = Math.max(0, Math.ceil((expDate.getTime() - Date.now()) / 86400000));
    const planName = acc.planId ? getPlan(acc.planId)?.name ?? "" : "";
    const who = acc.name || acc.company || acc.email;

    for (const admin of admins) {
      if (hasNotificationMarker(admin._id, "expiry", marker)) continue;
      createNotification({
        userId: admin._id,
        type: "expiry",
        title: `Subscription expiring in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
        body: `${who}${planName ? ` (${planName})` : ""} expires on ${dateKey}. ${marker}`,
      });
    }
  }
}
