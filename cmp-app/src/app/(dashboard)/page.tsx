import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }

  const firstName = (session.user.name ?? "User").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return <DashboardClient firstName={firstName} greeting={greeting} />;
}
