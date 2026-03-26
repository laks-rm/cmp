import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { FindingPageClient } from "@/components/findings/FindingPageClient";

export default async function FindingDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }

  try {
    await requirePermission(session, "FINDINGS", "VIEW");
  } catch {
    redirect("/");
  }

  return <FindingPageClient findingId={params.id} />;
}
