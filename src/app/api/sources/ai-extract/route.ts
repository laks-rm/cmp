import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
// @ts-expect-error - pdf-parse has incorrect type definitions
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { acquireConcurrentSlot, createConcurrentLimitResponse } from "@/lib/concurrentLimit";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

// Content limits and cost constants
const MAX_DOCUMENT_CHARS = 50000; // ~12,500 tokens (safe limit for Claude)
const CHARS_PER_TOKEN_ESTIMATE = 4; // Conservative estimate
const COST_PER_1K_INPUT_TOKENS = 0.003; // Claude Sonnet 3.5 pricing (as of 2024)
const COST_PER_1K_OUTPUT_TOKENS = 0.015; // Claude Sonnet 3.5 pricing

type ExtractedClause = {
  reference: string;
  title: string;
  description: string;
  isInformational: boolean;
  suggestedTasks: Array<{
    name: string;
    frequency: string;
    riskRating: string;
  }>;
};

type ExtractionResponse = {
  clauses: ExtractedClause[];
};

async function extractTextFromFile(
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    const data = await pdfParse(fileBuffer);
    return data.text;
  } else if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  } else if (mimeType === "text/plain") {
    return fileBuffer.toString("utf-8");
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

function buildExtractionPrompt(
  documentText: string,
  extractionLevel: string,
  taskSuggestion: string,
  sourceType: string,
  additionalInstructions?: string
): string {
  let levelInstructions = "";
  switch (extractionLevel) {
    case "articles-sub":
      levelInstructions =
        "Extract both top-level articles AND their sub-articles (e.g., Art. 5.1, Art. 5.2).";
      break;
    case "articles-only":
      levelInstructions =
        "Extract ONLY top-level articles (e.g., Art. 5, Art. 6), not sub-articles.";
      break;
    case "sections":
      levelInstructions =
        "Extract sections and clauses at the section level.";
      break;
    case "all-paragraphs":
      levelInstructions =
        "Extract all numbered paragraphs including nested ones.";
      break;
    default:
      levelInstructions =
        "Extract articles and sub-articles at an appropriate level.";
  }

  let taskInstructions = "";
  switch (taskSuggestion) {
    case "full":
      taskInstructions =
        "For each clause, suggest 1-3 monitoring tasks with appropriate frequency (DAILY, WEEKLY, MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, BIENNIAL, ONE_TIME) and risk rating (HIGH, MEDIUM, LOW). Focus on actionable compliance monitoring tasks.";
      break;
    case "tasks-only":
      taskInstructions =
        "For each clause, suggest 1-3 monitoring tasks with frequency only. Do not assign risk ratings.";
      break;
    case "clauses-only":
      taskInstructions =
        "Do NOT suggest any tasks. Only extract the clauses with their references, titles, and descriptions. Return empty suggestedTasks arrays.";
      break;
    default:
      taskInstructions =
        "Suggest monitoring tasks with frequency and risk rating where appropriate.";
  }

  const sourceTypeContext =
    sourceType === "REGULATION"
      ? "This is a regulatory document. Focus on compliance obligations and monitoring requirements."
      : sourceType === "INTERNAL_POLICY"
        ? "This is an internal policy document. Focus on policy adherence and internal control tasks."
        : sourceType === "INDUSTRY_STANDARD"
          ? "This is an industry standard. Focus on conformance and best practice implementation tasks."
          : "Extract compliance and monitoring requirements based on document type.";

  const additionalContext = additionalInstructions
    ? `\n\nAdditional instructions from user:\n${additionalInstructions}`
    : "";

  // Truncate document if needed (should not happen after validation, but safety check)
  const truncatedText = documentText.slice(0, MAX_DOCUMENT_CHARS);
  const wasTruncated = documentText.length > MAX_DOCUMENT_CHARS;

  return `You are a regulatory compliance expert extracting clauses from a compliance document for a compliance monitoring program.

Document type: ${sourceType}
${sourceTypeContext}

Extraction instructions:
${levelInstructions}

Task suggestion instructions:
${taskInstructions}

${additionalContext}${wasTruncated ? '\n\nNOTE: Document was truncated to fit token limits. Extract what is available.' : ''}

IMPORTANT: Return ONLY valid JSON in the following exact format, with no additional text or markdown:
{
  "clauses": [
    {
      "reference": "Art. 5",
      "title": "Customer Due Diligence Requirements",
      "description": "Full text or summary of the clause...",
      "isInformational": false,
      "suggestedTasks": [
        {
          "name": "Review CDD completion rates for new client onboarding",
          "frequency": "MONTHLY",
          "riskRating": "HIGH"
        }
      ]
    }
  ]
}

Rules:
- reference: Use the document's numbering (e.g., "Art. 5", "Section 3.2", "Clause 4.1")
- title: Concise clause title (max 100 characters)
- description: Full text or detailed summary of the clause
- isInformational: Set to true if the clause is purely informational with no compliance obligations
- suggestedTasks: Array of monitoring tasks (can be empty if clauses-only mode)
- frequency: Must be one of: DAILY, WEEKLY, MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, BIENNIAL, ONE_TIME
- riskRating: Must be one of: HIGH, MEDIUM, LOW

Focus on extracting clauses that require monitoring, compliance actions, or ongoing tasks. Skip preambles, definitions (unless they have compliance implications), and purely administrative sections unless specifically instructed otherwise.

Here is the document text to analyze:

${truncatedText}`;
}

export async function POST(req: NextRequest) {
  let releaseSlot: (() => void) | undefined;
  
  try {
    // CRITICAL: AI extraction is expensive and resource-intensive
    // Use a very low concurrent limit (2) to prevent API rate limits and cost overruns
    const userId = req.headers.get("x-user-id") || "anonymous"; // Fallback for unauthenticated requests
    
    releaseSlot = await acquireConcurrentSlot(userId, {
      maxConcurrent: 2, // Very low limit for AI processing
      errorMessage: "AI extraction is already in progress. Please wait for the current extraction to complete.",
    });
    
    if (!releaseSlot) {
      return createConcurrentLimitResponse(
        "AI extraction is already in progress. Please wait for the current extraction to complete."
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const extractionLevel =
      (formData.get("extractionLevel") as string) || "articles-sub";
    const taskSuggestion =
      (formData.get("taskSuggestion") as string) || "full";
    const sourceType = (formData.get("sourceType") as string) || "REGULATION";
    const additionalInstructions = formData.get(
      "additionalInstructions"
    ) as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error:
            "Anthropic API key not configured. Please set ANTHROPIC_API_KEY in your environment variables.",
        },
        { status: 500 }
      );
    }

    const fileSize = file.size;
    if (fileSize > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size exceeds 50MB limit" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    let documentText: string;
    try {
      documentText = await extractTextFromFile(fileBuffer, file.type);
    } catch (error) {
      console.error("File extraction error:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to extract text from file",
        },
        { status: 400 }
      );
    }

    if (!documentText || documentText.trim().length === 0) {
      return NextResponse.json(
        { error: "No text content found in the document" },
        { status: 400 }
      );
    }

    // Validate document size and calculate estimated cost
    const documentChars = documentText.length;
    const estimatedInputTokens = Math.ceil(documentChars / CHARS_PER_TOKEN_ESTIMATE);
    const estimatedOutputTokens = 2000; // Conservative estimate for extraction output
    const estimatedCost = 
      (estimatedInputTokens / 1000) * COST_PER_1K_INPUT_TOKENS +
      (estimatedOutputTokens / 1000) * COST_PER_1K_OUTPUT_TOKENS;

    if (documentChars > MAX_DOCUMENT_CHARS) {
      return NextResponse.json(
        {
          error: `Document too large. Maximum ${MAX_DOCUMENT_CHARS.toLocaleString()} characters allowed.`,
          details: {
            documentChars,
            maxChars: MAX_DOCUMENT_CHARS,
            exceedsBy: documentChars - MAX_DOCUMENT_CHARS,
            estimatedTokens: estimatedInputTokens,
            estimatedCost: `$${estimatedCost.toFixed(3)}`,
            suggestion: "Please split the document into smaller sections or extract specific portions manually.",
          },
        },
        { status: 400 }
      );
    }

    console.log('AI extraction starting:', {
      fileName: file.name,
      documentChars,
      estimatedInputTokens,
      estimatedCost: `$${estimatedCost.toFixed(3)}`,
    });

    const prompt = buildExtractionPrompt(
      documentText,
      extractionLevel,
      taskSuggestion,
      sourceType,
      additionalInstructions || undefined
    );

    let extractedData: ExtractionResponse | undefined;
    let retryCount = 0;
    const maxRetries = 2;
    let lastMessage: Anthropic.Messages.Message | undefined;

    while (retryCount <= maxRetries) {
      try {
        const message = await anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 8000,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        });

        lastMessage = message;

        const responseText =
          message.content[0].type === "text" ? message.content[0].text : "";

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? jsonMatch[0] : responseText;

        extractedData = JSON.parse(jsonText) as ExtractionResponse;

        if (!extractedData.clauses || !Array.isArray(extractedData.clauses)) {
          throw new Error("Invalid response format: clauses array not found");
        }

        break;
      } catch (error) {
        retryCount++;
        if (retryCount > maxRetries) {
          console.error("AI extraction error after retries:", error);
          return NextResponse.json(
            {
              error:
                error instanceof Error
                  ? `Failed to parse AI response: ${error.message}`
                  : "Failed to extract clauses from document",
            },
            { status: 500 }
          );
        }

        if (retryCount <= maxRetries && lastMessage) {
          const correctionPrompt = `The previous response was not valid JSON. Please return ONLY a valid JSON object with this exact structure, with no markdown formatting or extra text:
{
  "clauses": [
    {
      "reference": "string",
      "title": "string",
      "description": "string",
      "isInformational": boolean,
      "suggestedTasks": [
        {
          "name": "string",
          "frequency": "DAILY|WEEKLY|MONTHLY|QUARTERLY|SEMI_ANNUAL|ANNUAL|BIENNIAL|ONE_TIME",
          "riskRating": "HIGH|MEDIUM|LOW"
        }
      ]
    }
  ]
}

Please retry the extraction now.`;

          const retryMessage = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 8000,
            messages: [
              { role: "user", content: prompt },
              {
                role: "assistant",
                content:
                  lastMessage.content[0].type === "text"
                    ? lastMessage.content[0].text
                    : "",
              },
              { role: "user", content: correctionPrompt },
            ],
          });

          const retryResponseText =
            retryMessage.content[0].type === "text"
              ? retryMessage.content[0].text
              : "";
          const retryJsonMatch = retryResponseText.match(/\{[\s\S]*\}/);
          const retryJsonText = retryJsonMatch
            ? retryJsonMatch[0]
            : retryResponseText;
          extractedData = JSON.parse(retryJsonText) as ExtractionResponse;

          if (
            !extractedData.clauses ||
            !Array.isArray(extractedData.clauses)
          ) {
            continue;
          }
          lastMessage = retryMessage;
          break;
        }
      }
    }

    if (!extractedData) {
      return NextResponse.json(
        {
          error: "Failed to extract data from document after all retries",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: extractedData,
      meta: {
        fileName: file.name,
        fileSize,
        clausesExtracted: extractedData.clauses.length,
        totalSuggestedTasks: extractedData.clauses.reduce(
          (sum, clause) => sum + clause.suggestedTasks.length,
          0
        ),
      },
    });
  } catch (error) {
    console.error("API route error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      },
      { status: 500 }
    );
  } finally {
    // CRITICAL: Always release concurrent slot
    releaseSlot?.();
  }
}
