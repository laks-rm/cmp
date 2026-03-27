import { NextResponse } from "next/server";

/**
 * GET /api/ai/status
 * Check if AI service is configured and available
 */
export async function GET() {
  const isConfigured = !!(
    process.env.OPENAI_BASE_URL && process.env.OPENAI_API_KEY
  );

  return NextResponse.json({
    available: isConfigured,
  });
}
