import { getServerSession, Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { hitApiRateLimit, checkConcurrentLimit, releaseConcurrentSlot } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit";

type ApiHandler = (req: NextRequest, session: Session) => Promise<NextResponse>;

export function withApiHandler(handler: ApiHandler, options: { module: string; action: string }) {
  return async (req: NextRequest) => {
    let userId: string | undefined;
    
    try {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
      }

      userId = session.user.userId;

      // Check concurrent request limit FIRST (prevents resource exhaustion)
      if (!checkConcurrentLimit(userId)) {
        await logAuditEvent({
          action: "CONCURRENT_LIMIT_HIT",
          module: "SECURITY",
          userId,
          details: { 
            route: req.nextUrl.pathname,
            reason: "Too many simultaneous requests",
          },
        });
        return NextResponse.json(
          { 
            error: "Too many concurrent requests. Please wait for previous requests to complete.", 
            code: "CONCURRENT_LIMIT_HIT" 
          }, 
          { status: 429 }
        );
      }

      // Check rate limit (prevents request spam over time)
      if (hitApiRateLimit(userId)) {
        await logAuditEvent({
          action: "RATE_LIMIT_HIT",
          module: "SECURITY",
          userId,
          details: { route: req.nextUrl.pathname },
        });
        return NextResponse.json({ error: "Too many requests", code: "RATE_LIMIT_HIT" }, { status: 429 });
      }

      await requirePermission(session, options.module, options.action);

      return await handler(req, session);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
      }
      console.error("API Error", {
        route: req.nextUrl.pathname,
        error,
      });
      return NextResponse.json({ error: "Internal server error", code: "INTERNAL_SERVER_ERROR" }, { status: 500 });
    } finally {
      // CRITICAL: Always release concurrent slot, even if request fails
      if (userId) {
        releaseConcurrentSlot(userId);
      }
    }
  };
}
