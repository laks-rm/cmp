import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { TaskTrackerClient } from "@/components/tasks/TaskTrackerClient";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }

  try {
    await requirePermission(session, "TASKS", "VIEW");
  } catch {
    redirect("/");
  }

  return <TaskTrackerClient />;
}
