import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { taskService } from "@/services/TaskService";
import { assignPICSchema } from "@/lib/validations/tasks";
import { ValidationError, NotFoundError } from "@/services/types";
import { z } from "zod";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { picId } = assignPICSchema.parse(body);

    // Get task to check authorization
    const task = await taskService.getTaskById(params.id, {
      userId: session.user.userId,
      entityIds: session.user.entityIds,
      permissions: [],
    });

    // Check authorization
    const isSuperAdmin = session.user.roleName === "SUPER_ADMIN";
    const isCurrentPIC = task.picId === session.user.userId;

    if (!isSuperAdmin && !isCurrentPIC) {
      return NextResponse.json(
        { error: "Not authorized to assign PIC" },
        { status: 403 }
      );
    }

    const updated = await taskService.assignPIC(
      params.id,
      picId,
      session.user.userId,
      {
        userId: session.user.userId,
        entityIds: session.user.entityIds,
        permissions: [],
      }
    );

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error in assign-pic:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
