import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { ReviewQueueClient } from "@/components/reviews/ReviewQueueClient";

export default async function ReviewQueuePage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  if (!hasPermission(session, "REVIEW_QUEUE", "VIEW")) {
    redirect("/");
  }

  return <ReviewQueueClient />;
}
