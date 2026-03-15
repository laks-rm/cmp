import { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";

type PermissionKey = `${string}:${string}`;

function buildPermissionKey(module: string, action: string): PermissionKey {
  return `${module}:${action}`;
}

async function loadRolePermissions(roleId: string): Promise<Set<PermissionKey>> {
  const records = await prisma.rolePermission.findMany({
    where: { roleId, granted: true },
    include: { permission: true },
  });

  return new Set<PermissionKey>(
    records.map((record) => 
      buildPermissionKey(record.permission.module, record.permission.action)
    )
  );
}

export async function hasPermission(session: Session, module: string, action: string): Promise<boolean> {
  const roleId = session.user.roleId;
  if (!roleId) {
    return false;
  }

  const permissions = await loadRolePermissions(roleId);
  return permissions.has(buildPermissionKey(module, action));
}

export function getUserEntities(session: Session): string[] {
  return session.user.entityIds ?? [];
}

export function getUserTeams(session: Session): string[] {
  return session.user.teamIds ?? [];
}

export function getEntityFilter(session: Session): Record<string, unknown> {
  const entityIds = getUserEntities(session);
  if (!entityIds.length) {
    return {};
  }
  return { entityId: { in: entityIds } };
}

export async function requirePermission(session: Session, module: string, action: string): Promise<void> {
  const allowed = await hasPermission(session, module, action);
  if (!allowed) {
    await logAuditEvent({
      action: "PERMISSION_DENIED",
      module: "SECURITY",
      userId: session.user.userId,
      details: { module, action },
    });
    throw new ApiError(403, "Access denied", "PERMISSION_DENIED");
  }
}

export function requireEntityAccess(session: Session, entityId: string): void {
  const entityIds = getUserEntities(session);
  if (!entityIds.includes(entityId)) {
    throw new ApiError(404, "Resource not found", "RESOURCE_NOT_FOUND");
  }
}
