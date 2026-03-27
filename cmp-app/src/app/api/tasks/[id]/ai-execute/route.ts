import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import mammoth from "mammoth";

interface AiExecuteRequest {
  message: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  attachmentText?: string;
  action?: "start" | "analyze-document" | "draft-narrative" | "suggest-finding" | "fill-fields";
}

interface AiResponse {
  response: string;
  suggestedFields?: {
    narrative?: string;
    monitoringAreaId?: string;
    monitoringAreaName?: string;
    taskTypeId?: string;
    taskTypeName?: string;
    riskRating?: string;
    deferralReason?: string;
  };
  suggestedFinding?: {
    title: string;
    description: string;
    severity: string;
    rootCause?: string;
    impact?: string;
  };
  nextSteps?: string[];
  documentAnalysis?: {
    documentType: string;
    keyPoints: string[];
    complianceIssues: string[];
    complianceConfirmations: string[];
  };
}

/**
 * Extract text from uploaded files
 */
async function extractTextFromFile(file: File): Promise<string> {
  const filename = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (filename.endsWith(".pdf")) {
      // Dynamic import to avoid Next.js build issues
      const pdfParse = (await import("pdf-parse")).default;
      const pdfData = await pdfParse(buffer);
      return pdfData.text;
    } else if (filename.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else if (filename.endsWith(".txt") || filename.endsWith(".csv")) {
      return buffer.toString("utf-8");
    } else {
      return "Cannot analyze this file type — please upload a PDF, DOCX, or TXT file";
    }
  } catch (error) {
    console.error("Error extracting text from file:", error);
    return "Error extracting text from document";
  }
}

/**
 * POST /api/tasks/[id]/ai-execute
 * AI execution assistant for tasks
 */
export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  console.log("AI execute called for task:", context.params.id);
  
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASK_EXECUTION", "EDIT");

    const taskId = context.params.id;

    // Check if AI service is configured
    const aiApiUrl = process.env.OPENAI_BASE_URL;
    const aiApiKey = process.env.OPENAI_API_KEY;
    const aiModel = process.env.OPENAI_MODEL_NAME || "claude-sonnet-4-6";

    if (!aiApiUrl || !aiApiKey) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 503 }
      );
    }

    // Parse request - handle both JSON and FormData
    const contentType = req.headers.get("content-type") || "";
    let body: AiExecuteRequest;
    let uploadedFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      body = {
        message: formData.get("message") as string,
        conversationHistory: JSON.parse(
          formData.get("conversationHistory") as string
        ),
        action: (formData.get("action") || undefined) as
          | "start"
          | "analyze-document"
          | "draft-narrative"
          | "suggest-finding"
          | "fill-fields"
          | undefined,
      };
      uploadedFile = formData.get("file") as File | null;

      // Extract text from uploaded file
      if (uploadedFile) {
        const extractedText = await extractTextFromFile(uploadedFile);
        body.attachmentText = extractedText;
        body.message = `I'm uploading a document: ${uploadedFile.name}. Here is the content:\n\n${extractedText}`;
        body.action = "analyze-document";
      }
    } else {
      body = await req.json();
    }

    // Fetch task context
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        source: {
          select: {
            name: true,
            code: true,
          },
        },
        sourceItem: {
          select: {
            reference: true,
            title: true,
            description: true,
          },
        },
        entity: {
          select: {
            code: true,
            name: true,
          },
        },
        monitoringArea: {
          select: {
            id: true,
            name: true,
          },
        },
        taskType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (!session.user.entityIds.includes(task.entityId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch previous completed instances (up to 3)
    const previousInstances = await prisma.task.findMany({
      where: {
        sourceId: task.sourceId,
        entityId: task.entityId,
        status: "COMPLETED",
        id: { not: taskId },
      },
      orderBy: { completedAt: "desc" },
      take: 3,
      select: {
        completedAt: true,
        narrative: true,
        _count: {
          select: {
            evidence: true,
            findings: true,
          },
        },
      },
    });

    // Fetch available monitoring areas and task types
    const [monitoringAreas, taskTypes] = await Promise.all([
      prisma.monitoringArea.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.taskType.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    // Build system prompt
    const systemPrompt = `You are OpenClaw, an AI compliance monitoring assistant for ${task.entity.name}. You are helping execute task "${task.name}".

YOUR CAPABILITIES:
- Analyze regulatory requirements and compliance documents
- Guide the user through task execution step by step
- Review uploaded documents against regulatory requirements
- Draft execution narratives based on evidence and analysis
- Suggest compliance findings when issues are identified
- Recommend field values (monitoring area, task type, risk rating)

TASK CONTEXT:
- Task: ${task.name}
- Entity: ${task.entity.name} (${task.entity.code})
- Source: ${task.source.name} (${task.source.code})
- Regulatory Requirement: ${task.sourceItem?.reference || "N/A"} — ${task.sourceItem?.title || "N/A"}
  ${task.sourceItem?.description || "Not provided"}
- Task Description: ${task.description || "Not provided"}
- Expected Outcome: ${task.expectedOutcome || "Not provided"}
- Frequency: ${task.frequency}
- Current Risk Rating: ${task.riskRating}
- Monitoring Area: ${task.monitoringArea?.name || "Not set"}
- Task Type: ${task.taskType?.name || "Not set"}

${
  previousInstances.length > 0
    ? `PREVIOUS EXECUTIONS:
${previousInstances
  .map(
    (prev) =>
      `- ${prev.completedAt ? new Date(prev.completedAt).toLocaleDateString() : "Unknown"}: ${prev.narrative ? prev.narrative.substring(0, 150) : "No narrative"}${prev.narrative && prev.narrative.length > 150 ? "..." : ""}
  Evidence: ${prev._count.evidence} files, Findings: ${prev._count.findings}`
  )
  .join("\n")}`
    : ""
}

AVAILABLE MONITORING AREAS: ${monitoringAreas.map((ma) => ma.name).join(", ")}
AVAILABLE TASK TYPES: ${taskTypes.map((tt) => tt.name).join(", ")}

INSTRUCTIONS:
1. When the conversation starts (action: "start"), introduce yourself briefly, explain what this task requires based on the regulatory context, and outline the steps needed. Ask the user what information or documents they have available.

2. When a document is uploaded (action: "analyze-document"), analyze the extracted text against the regulatory requirement. Identify compliance confirmations and issues. Be specific — reference exact sections of the regulation and the document.

3. When asked to draft a narrative (action: "draft-narrative"), write a professional compliance monitoring narrative based on everything discussed. The narrative should be 100-200 words, factual, past tense.

4. When issues are found, proactively suggest a finding (action: "suggest-finding") with title, description, severity, root cause, and impact.

5. Throughout the conversation, if monitoring area or task type are not set, suggest appropriate values based on the context.

RESPONSE FORMAT:
Always respond with a JSON object (no markdown, no backticks):
{
  "response": "Your conversational message to the user",
  "suggestedFields": { ... },
  "suggestedFinding": { ... },
  "nextSteps": ["Step 1", "Step 2"],
  "documentAnalysis": { ... }
}

Only include suggestedFields, suggestedFinding, nextSteps, documentAnalysis when relevant — omit them if not applicable to the current turn.

Keep your conversational responses clear, professional, and concise. Focus on actionable guidance.`;

    // Build messages for AI
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...body.conversationHistory,
      { role: "user" as const, content: body.message },
    ];

    // Call AI service
    const aiResponse = await fetch(`${aiApiUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages,
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      return NextResponse.json(
        { error: "AI service temporarily unavailable" },
        { status: 502 }
      );
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices?.[0]?.message?.content || "";

    // Parse AI response - try JSON first, fallback to plain text
    let parsedResponse: AiResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      // If JSON parsing fails, return raw text
      parsedResponse = {
        response: responseText,
      };
    }

    // Enhance suggestedFields with IDs if names are provided
    if (parsedResponse.suggestedFields) {
      if (
        parsedResponse.suggestedFields.monitoringAreaName &&
        !parsedResponse.suggestedFields.monitoringAreaId
      ) {
        const ma = monitoringAreas.find(
          (area) =>
            area.name.toLowerCase() ===
            parsedResponse.suggestedFields!.monitoringAreaName!.toLowerCase()
        );
        if (ma) {
          parsedResponse.suggestedFields.monitoringAreaId = ma.id;
        }
      }

      if (
        parsedResponse.suggestedFields.taskTypeName &&
        !parsedResponse.suggestedFields.taskTypeId
      ) {
        const tt = taskTypes.find(
          (type) =>
            type.name.toLowerCase() ===
            parsedResponse.suggestedFields!.taskTypeName!.toLowerCase()
        );
        if (tt) {
          parsedResponse.suggestedFields.taskTypeId = tt.id;
        }
      }
    }

    return NextResponse.json(parsedResponse);
  } catch (error) {
    console.error("AI execute error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "N/A");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
