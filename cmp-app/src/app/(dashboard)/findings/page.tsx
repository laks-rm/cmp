import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { FindingsClient } from "@/components/findings/FindingsClient";

export default async function FindingsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }

  try {
    await requirePermission(session, "FINDINGS", "VIEW");
  } catch {
    redirect("/");
  }

  return <FindingsClient />;
}
