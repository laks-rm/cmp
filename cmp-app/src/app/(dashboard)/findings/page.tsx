import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { FindingsClient } from "@/components/findings/FindingsClient";

export default async function FindingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  if (!hasPermission(session, "FINDINGS", "VIEW")) {
    redirect("/");
  }

  return <FindingsClient />;
}
