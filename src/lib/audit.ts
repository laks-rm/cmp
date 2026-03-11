import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type AuditEventParams = {
  action: string;
  module: string;
  userId?: string;
  entityId?: string;
  targetType?: string;
  targetId?: string;
  details?: Prisma.InputJsonValue;
  ipAddress?: string;
};

export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    if (!params.userId) {
      console.error("Audit log skipped because userId is missing", {
        action: params.action,
        module: params.module,
      });
      return;
    }

    await prisma.auditLog.create({
      data: {
        action: params.action,
        module: params.module,
        userId: params.userId,
        entityId: params.entityId,
        targetType: params.targetType,
        targetId: params.targetId,
        details: params.details,
        ipAddress: params.ipAddress,
      },
    });
  } catch (error) {
    console.error("Audit logging failed", {
      action: params.action,
      module: params.module,
      error,
    });
  }
}
