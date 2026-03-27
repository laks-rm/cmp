import { NextResponse } from "next/server";

export async function GET() {
  try {
    const features = {
      aiExtractEnabled: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_BASE_URL),
    };

    return NextResponse.json(features);
  } catch (error) {
    console.error("Features check error:", error);
    return NextResponse.json(
      { error: "Failed to check features" },
      { status: 500 }
    );
  }
}
