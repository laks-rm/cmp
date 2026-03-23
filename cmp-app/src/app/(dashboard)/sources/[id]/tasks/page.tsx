import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { SourceTasksClient } from "@/components/sources/SourceTasksClient";

export default async function SourceTasksPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }

  try {
    await requirePermission(session, "SOURCES", "VIEW");
  } catch {
    redirect("/");
  }

  return <SourceTasksClient sourceId={params.id} />;
}
