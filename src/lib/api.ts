import { getServerSession, Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { hitApiRateLimit } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit";

type ApiHandler = (req: NextRequest, session: Session) => Promise<NextResponse>;

export function withApiHandler(handler: ApiHandler, options: { module: string; action: string }) {
  return async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
      }

      if (hitApiRateLimit(session.user.userId)) {
        await logAuditEvent({
          action: "RATE_LIMIT_HIT",
          module: "SECURITY",
          userId: session.user.userId,
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
    }
  };
}
