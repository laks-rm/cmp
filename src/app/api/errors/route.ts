import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { ErrorType, ErrorSeverity } from "@prisma/client";
import { z } from "zod";

const createErrorSchema = z.object({
  errorType: z.nativeEnum(ErrorType),
  errorMessage: z.string(),
  errorStack: z.string().optional(),
  errorDigest: z.string().optional(),
  url: z.string(),
  userAgent: z.string().optional(),
  userId: z.string().optional(),
  httpMethod: z.string().optional(),
  statusCode: z.number().optional(),
  apiEndpoint: z.string().optional(),
  requestBody: z.any().optional(),
  environment: z.string().default("production"),
  appVersion: z.string().optional(),
  severity: z.nativeEnum(ErrorSeverity).default(ErrorSeverity.ERROR),
});

const errorQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  errorType: z.string().optional(),
  severity: z.string().optional(),
  resolved: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createErrorSchema.parse(body);

    // Create error log (no auth required - errors can happen before auth)
    const errorLog = await prisma.errorLog.create({
      data: {
        errorType: data.errorType,
        errorMessage: data.errorMessage,
        errorStack: data.errorStack,
        errorDigest: data.errorDigest,
        url: data.url,
        userAgent: data.userAgent,
        userId: data.userId,
        httpMethod: data.httpMethod,
        statusCode: data.statusCode,
        apiEndpoint: data.apiEndpoint,
        requestBody: data.requestBody,
        environment: data.environment,
        appVersion: data.appVersion,
        severity: data.severity,
      },
    });

    return NextResponse.json({ id: errorLog.id, success: true });
  } catch (error) {
    console.error("Error logging error:", error);
    return NextResponse.json(
      { error: "Failed to log error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only Super Admins can view error logs
    if (session.user.roleName !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await requirePermission(session, "SYSTEM_MONITORING", "VIEW");

    const { searchParams } = new URL(req.url);
    const params = errorQuerySchema.parse(Object.fromEntries(searchParams));

    const page = parseInt(params.page || "1");
    const limit = parseInt(params.limit || "50");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (params.errorType) {
      where.errorType = params.errorType as ErrorType;
    }

    if (params.severity) {
      where.severity = params.severity as ErrorSeverity;
    }

    if (params.resolved) {
      where.resolved = params.resolved === "true";
    }

    if (params.userId) {
      where.userId = params.userId;
    }

    if (params.startDate || params.endDate) {
      const createdAtFilter: { gte?: Date; lte?: Date } = {};
      if (params.startDate) {
        createdAtFilter.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        createdAtFilter.lte = new Date(params.endDate);
      }
      where.createdAt = createdAtFilter;
    }

    if (params.search) {
      where.OR = [
        { errorMessage: { contains: params.search, mode: "insensitive" } },
        { url: { contains: params.search, mode: "insensitive" } },
        { apiEndpoint: { contains: params.search, mode: "insensitive" } },
      ];
    }

    // Fetch errors with pagination
    const [errors, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              initials: true,
              avatarColor: true,
            },
          },
          resolver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.errorLog.count({ where }),
    ]);

    return NextResponse.json({
      errors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching error logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch error logs" },
      { status: 500 }
    );
  }
}
