import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CalendarClient } from "@/components/calendar/CalendarClient";

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }

  return <CalendarClient />;
}
