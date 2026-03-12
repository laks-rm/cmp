import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { AdminClient } from "@/components/admin/AdminClient";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  // Check if user has ANY admin permission
  const hasAnyAdminPermission =
    (await hasPermission(session, "USER_MANAGEMENT", "VIEW")) ||
    (await hasPermission(session, "ROLE_MANAGEMENT", "VIEW")) ||
    (await hasPermission(session, "ENTITY_CONFIG", "VIEW")) ||
    (await hasPermission(session, "TEAM_CONFIG", "VIEW")) ||
    (await hasPermission(session, "NOTIFICATION_CONFIG", "VIEW"));

  if (!hasAnyAdminPermission) {
    redirect("/");
  }

  return <AdminClient />;
}
