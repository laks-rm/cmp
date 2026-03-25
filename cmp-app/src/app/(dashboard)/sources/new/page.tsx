import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { SourceCreateClient } from "@/components/sources/SourceCreateClient";

export default async function SourceCreatePage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }

  try {
    await requirePermission(session, "SOURCES", "CREATE");
  } catch {
    redirect("/sources");
  }

  return <SourceCreateClient />;
}
