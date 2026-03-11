import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { AuditLogClient } from "@/components/audit-log/AuditLogClient";

export default async function AuditLogPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  try {
    await requirePermission(session, "AUDIT_LOG", "VIEW");
  } catch {
    redirect("/");
  }

  return <AuditLogClient />;
}
