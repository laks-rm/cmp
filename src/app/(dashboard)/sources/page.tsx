import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { SourcesClient } from "@/components/sources/SourcesClient";

export default async function SourcesPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  if (!hasPermission(session, "SOURCES", "VIEW")) {
    redirect("/");
  }

  return <SourcesClient />;
}
