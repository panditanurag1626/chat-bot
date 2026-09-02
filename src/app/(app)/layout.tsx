import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import AdminChrome from "@/components/AdminChrome";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <AdminChrome user={{ name: user.name || "", email: user.email, role: user.role }}>{children}</AdminChrome>
  );
}
