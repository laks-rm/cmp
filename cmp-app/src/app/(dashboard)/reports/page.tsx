import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { ReportsClient } from "@/components/reports/ReportsClient";

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  try {
    await requirePermission(session, "REPORTS", "VIEW");
  } catch {
    redirect("/");
  }

  return <ReportsClient />;
}
