import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { ReviewQueueClient } from "@/components/reviews/ReviewQueueClient";

export default async function ReviewQueuePage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }

  try {
    await requirePermission(session, "REVIEW_QUEUE", "VIEW");
  } catch {
    redirect("/");
  }

  return <ReviewQueueClient />;
}
