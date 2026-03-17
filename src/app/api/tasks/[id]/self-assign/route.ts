import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { taskService } from "@/services/TaskService";
import { ValidationError } from "@/services/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updated = await taskService.selfAssignPIC(
      params.id,
      session.user.userId,
      {
        userId: session.user.userId,
        entityIds: session.user.entityIds,
        permissions: [],
      }
    );

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error in self-assign:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
