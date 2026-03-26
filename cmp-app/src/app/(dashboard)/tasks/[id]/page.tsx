import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { TaskPageClient } from "@/components/tasks/TaskPageClient";

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }

  try {
    await requirePermission(session, "TASKS", "VIEW");
  } catch {
    redirect("/");
  }

  return <TaskPageClient taskId={params.id} />;
}
