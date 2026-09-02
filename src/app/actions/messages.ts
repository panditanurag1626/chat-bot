"use server";

import { asId } from "@/lib/sqlite";
import { requireUser } from "@/lib/auth";
import { deleteNotification } from "@/lib/repo";
import { redirectWithFlash } from "@/lib/flash";
import { redirect } from "next/navigation";

export async function messageDeleteAction(nid: string) {
  const user = await requireUser();
  if (!asId(nid)) redirect("/messages");
  const ok = deleteNotification(nid, user.id);
  if (!ok) redirect("/messages");
  redirectWithFlash("/messages", "Message deleted.", "success");
}
