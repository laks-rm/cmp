import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { SourceDetailClient } from "@/components/sources/SourceDetailClient";

export default async function SourceDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }

  try {
    await requirePermission(session, "SOURCES", "VIEW");
  } catch {
    redirect("/sources");
  }

  return <SourceDetailClient sourceId={params.id} />;
}
