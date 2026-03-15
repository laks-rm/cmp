/**
 * Service Layer Barrel Export
 * 
 * Import services from this file:
 * import { taskService } from "@/services";
 */

export * from "./types";
export * from "./TaskService";

// Export singleton instances
export { taskService } from "./TaskService";

// TODO: Add other services as they are implemented
// export { findingService } from "./FindingService";
// export { sourceService } from "./SourceService";
// export { auditService } from "./AuditService";
// export { notificationService } from "./NotificationService";
