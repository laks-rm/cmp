import { NextRequest, NextResponse } from "next/server";
// @ts-expect-error - pdf-parse has incorrect type definitions
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

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

  return `You are a regulatory compliance expert extracting clauses from a compliance document for a compliance monitoring program.

Document type: ${sourceType}
${sourceTypeContext}

Extraction instructions:
${levelInstructions}

Task suggestion instructions:
${taskInstructions}

${additionalContext}

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

${documentText.slice(0, 100000)}`;
}

export async function POST(req: NextRequest) {
  try {
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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "AI API key not configured. Please set OPENAI_API_KEY in your environment variables.",
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
    let conversationHistory: Array<{ role: string; content: string }> = [];
    let responseText = "";

    while (retryCount <= maxRetries) {
      try {
        const response = await fetch(`${process.env.OPENAI_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL_NAME || "claude-sonnet-4-6",
            messages: conversationHistory.length > 0 
              ? conversationHistory 
              : [{ role: "user", content: prompt }],
            max_tokens: 8000,
            temperature: 0.3,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LiteLLM API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        responseText = data.choices[0].message.content;

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

        if (retryCount <= maxRetries) {
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

          conversationHistory = [
            { role: "user", content: prompt },
            { role: "assistant", content: responseText || "" },
            { role: "user", content: correctionPrompt },
          ];

          const retryResponse = await fetch(`${process.env.LITELLM_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.LITELLM_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-6",
              messages: conversationHistory,
              max_tokens: 8000,
              temperature: 0.3,
            }),
          });

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            throw new Error(`LiteLLM API error on retry: ${retryResponse.status} - ${errorText}`);
          }

          const retryData = await retryResponse.json();
          const retryResponseText = retryData.choices[0].message.content;
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
  }
}
