import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ErrorLogsClient } from "@/components/admin/ErrorLogsClient";

export const metadata = {
  title: "Error Logs | CMP",
  description: "System error logs and monitoring",
};

export default async function ErrorLogsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  // Only Super Admins can access error logs
  if (session.user.roleName !== "SUPER_ADMIN") {
    redirect("/");
  }

  return (
    <div className="p-8">
      <ErrorLogsClient />
    </div>
  );
}
