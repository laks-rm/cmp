/**
 * Example: Versioned API Route
 * 
 * This example shows how to implement API versioning in your routes
 * using the versioning middleware and utilities.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { withVersioning } from "@/lib/apiVersioningMiddleware";
import { isFeatureAvailable, transformResponseForVersion } from "@/lib/apiVersioning";
import { apiSuccess, parseQueryParams } from "@/lib/apiResponse";
import { withSoftDelete } from "@/lib/softDelete";
import { Prisma } from "@prisma/client";

/**
 * Example 1: Basic Versioned Route
 * Supports both header and URL-based versioning
 */
export async function GET(req: NextRequest) {
  return withVersioning(req, async (req, version) => {
    // Authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASKS", "VIEW");

    // Parse query parameters
    const { page, limit, status, entityId, sortBy, sortOrder } = parseQueryParams(
      req.nextUrl.searchParams
    );

    // Build query
    const where: Prisma.TaskWhereInput = withSoftDelete({
      ...(status && { status }),
      entityId: { in: session.user.entityIds },
    });

    // Version-specific features
    if (version === "v2" && isFeatureAvailable("enhancedFiltering", version)) {
      // V2: Enhanced filtering (example)
      const advancedFilter = req.nextUrl.searchParams.get("filter");
      if (advancedFilter) {
        // Parse advanced filter syntax
        // where.AND = parseAdvancedFilter(advancedFilter);
      }
    }

    // Fetch data
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          entity: true,
          assignee: true,
          pic: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.task.count({ where }),
    ]);

    // V1 response format
    if (version === "v1") {
      return apiSuccess(
        { tasks, total },
        { 
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          }
        }
      );
    }

    // V2 response format (example - nested structure)
    if (version === "v2") {
      return apiSuccess({
        data: {
          items: tasks.map((task) => ({
            id: task.id,
            name: task.name,
            metadata: {
              status: task.status,
              riskRating: task.riskRating,
              createdAt: task.createdAt,
              updatedAt: task.updatedAt,
            },
            relationships: {
              entity: task.entity,
              assignee: task.assignee,
              pic: task.pic,
            },
          })),
        },
        pagination: {
          page,
          limit,
          total,
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      });
    }

    // Default to v1 format
    return apiSuccess({ tasks, total });
  });
}

/**
 * Example 2: Version-Specific Endpoints
 * Some endpoints only available in certain versions
 */
export async function POST_V2_ONLY(req: NextRequest) {
  return withVersioning(req, async (req, version) => {
    // This endpoint only works in v2
    if (version !== "v2") {
      return NextResponse.json(
        {
          error: "This endpoint is only available in API v2",
          code: "VERSION_NOT_SUPPORTED",
          migration: "See /docs/api-migration-v1-to-v2.md",
        },
        { status: 410 } // 410 Gone
      );
    }

    // V2-specific logic
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Enhanced bulk operations (v2 only)
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Complex v2 logic...
      return { success: true, processed: 10 };
    });

    return apiSuccess(result);
  });
}

/**
 * Example 3: Backward Compatibility
 * Transform responses to maintain compatibility
 */
export async function GET_WITH_TRANSFORM(req: NextRequest) {
  return withVersioning(req, async (req, version) => {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch data (internal format)
    const task = await prisma.task.findUnique({
      where: { id: req.nextUrl.searchParams.get("id") || "" },
      include: { entity: true, assignee: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Transform based on version
    const transformed = transformResponseForVersion(task, version);

    return apiSuccess(transformed);
  });
}

/**
 * Example 4: Feature Flags
 * Enable/disable features based on version
 */
export async function GET_WITH_FEATURE_FLAGS(req: NextRequest) {
  return withVersioning(req, async (req, version) => {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tasks = await prisma.task.findMany();

    // V1: Basic response
    interface TaskResponse {
      tasks: typeof tasks;
      analytics?: {
        totalTasks: number;
        byStatus: Record<string, number>;
        byRisk: Record<string, number>;
      };
    }
    
    const response: TaskResponse = { tasks };

    // V2: Include analytics if feature is available
    if (isFeatureAvailable("enhancedAnalytics", version)) {
      const analytics = {
        totalTasks: tasks.length,
        byStatus: tasks.reduce((acc: Record<string, number>, task: { status: string }) => {
          acc[task.status] = (acc[task.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byRisk: tasks.reduce((acc: Record<string, number>, task: { riskRating: string }) => {
          acc[task.riskRating] = (acc[task.riskRating] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      response.analytics = analytics;
    }

    return apiSuccess(response);
  });
}

/**
 * Example 5: No Versioning Wrapper (Manual)
 * For routes that need custom version handling
 */
export async function GET_MANUAL_VERSION(req: NextRequest) {
  const version = req.headers.get("API-Version") || "v1";

  // Manual version validation
  if (!["v1", "v2"].includes(version)) {
    return NextResponse.json(
      { error: "Invalid API version", supportedVersions: ["v1", "v2"] },
      { status: 400 }
    );
  }

  // Your logic here
  const data = { message: `Hello from ${version}` };

  // Manually add version headers
  return NextResponse.json(data, {
    headers: {
      "API-Version": version,
      "API-Latest-Version": "v2",
    },
  });
}

/**
 * Example 6: Deprecation Warning
 * Show how deprecated versions are handled
 */
export async function GET_DEPRECATED(req: NextRequest) {
  return withVersioning(req, async (req, version) => {
    // If v1 is deprecated, middleware automatically adds:
    // - API-Deprecation-Warning header
    // - Sunset header
    // - Logs warning

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tasks = await prisma.task.findMany();

    return apiSuccess({ tasks });
  });
}
