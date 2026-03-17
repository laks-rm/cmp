import { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";

type PermissionKey = `${string}:${string}`;

function buildPermissionKey(module: string, action: string): PermissionKey {
  return `${module}:${action}`;
}

// In-memory cache for role permissions (TTL: 5 minutes)
const permissionCache = new Map<string, { permissions: Set<PermissionKey>; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function loadRolePermissions(roleId: string): Promise<Set<PermissionKey>> {
  // Check cache first
  const cached = permissionCache.get(roleId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.permissions;
  }

  const records = await prisma.rolePermission.findMany({
    where: { roleId, granted: true },
    include: { permission: true },
  });
  // #region agent log
  await fetch('http://127.0.0.1:7712/ingest/07d2e8ff-a49f-4678-98e7-a4ff4c518e7d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'782931'},body:JSON.stringify({sessionId:'782931',location:'permissions.ts:13',message:'loadRolePermissions result',data:{roleId,recordCount:records.length,fromCache:false,permissions:records.map((r: { permission: { module: string; action: string } })=>`${r.permission.module}:${r.permission.action}`)},timestamp:Date.now(),hypothesisId:'A,B'})}).catch(()=>{});
  // #endregion

  const permissions = new Set<PermissionKey>(
    records.map((record: { permission: { module: string; action: string } }) => 
      buildPermissionKey(record.permission.module, record.permission.action)
    )
  );

  // Cache the result
  permissionCache.set(roleId, { permissions, timestamp: Date.now() });

  return permissions;
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
