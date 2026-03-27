"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  Send,
  Paperclip,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Check,
  Loader2,
} from "lucide-react";
import toast from "@/lib/toast";

// Helper function to safely convert values to strings
const safeString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    // If it's an object with common text properties, try to extract text
    const obj = value as Record<string, unknown>;
    return obj.text || obj.message || obj.content || obj.value || JSON.stringify(value);
  }
  return String(value);
};

interface Message {
  role: "user" | "assistant";
  content: string;
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
    title?: string;
    description?: string;
    severity?: string;
    rootCause?: string;
    impact?: string;
  };
  nextSteps?: unknown[];
  documentAnalysis?: {
    documentType?: string;
    keyPoints?: unknown[];
    complianceIssues?: unknown[];
    complianceConfirmations?: unknown[];
  };
  appliedFields?: Set<string>;
}

interface AiExecutionPanelProps {
  taskId: string;
  onClose: () => void;
  onApplyNarrative: (text: string) => void;
  onApplyField: (field: string, value: string) => Promise<void>;
  onOpenFinding: (data: {
    title: string;
    description: string;
    severity: string;
    rootCause?: string;
    impact?: string;
  }) => void;
  onSaveEvidence?: (file: File) => Promise<void>;
}

export function AiExecutionPanel({
  taskId,
  onClose,
  onApplyNarrative,
  onApplyField,
  onOpenFinding,
  onSaveEvidence,
}: AiExecutionPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [pendingFile, setPendingFile] = useState<{
    file: File;
    messageIndex: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-start conversation
  useEffect(() => {
    if (!hasStarted) {
      setHasStarted(true);
      sendMessage("", "start");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = async (
    content: string,
    action?: "start" | "analyze-document" | "draft-narrative" | "suggest-finding" | "fill-fields"
  ) => {
    if (!content.trim() && action !== "start") return;

    const userMessage: Message = {
      role: "user",
      content: content || "Start",
    };

    const conversationHistory = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch(`/api/tasks/${taskId}/ai-execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content || "Please introduce yourself and explain what this task requires.",
          conversationHistory,
          action,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "AI request failed");
      }

      const aiResponse = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: aiResponse.response,
        suggestedFields: aiResponse.suggestedFields,
        suggestedFinding: aiResponse.suggestedFinding,
        nextSteps: aiResponse.nextSteps,
        documentAnalysis: aiResponse.documentAnalysis,
        appliedFields: new Set(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("AI execution error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to get AI response"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const userMessage: Message = {
      role: "user",
      content: `Uploading document: ${file.name}`,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "message",
        `I'm uploading a document: ${file.name}. Please analyze it.`
      );
      formData.append(
        "conversationHistory",
        JSON.stringify(
          messages.map((m) => ({ role: m.role, content: m.content }))
        )
      );
      formData.append("action", "analyze-document");

      const response = await fetch(`/api/tasks/${taskId}/ai-execute`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "AI request failed");
      }

      const aiResponse = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: aiResponse.response,
        suggestedFields: aiResponse.suggestedFields,
        suggestedFinding: aiResponse.suggestedFinding,
        nextSteps: aiResponse.nextSteps,
        documentAnalysis: aiResponse.documentAnalysis,
        appliedFields: new Set(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Ask if user wants to save as evidence
      setPendingFile({ file, messageIndex: messages.length + 1 });
    } catch (error) {
      console.error("Document upload error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload document"
      );
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSaveAsEvidence = async (save: boolean) => {
    if (!pendingFile || !save || !onSaveEvidence) {
      setPendingFile(null);
      return;
    }

    try {
      await onSaveEvidence(pendingFile.file);
      toast.success("Document saved as task evidence");
    } catch (error) {
      console.error("Error saving evidence:", error);
      toast.error("Failed to save document as evidence");
    } finally {
      setPendingFile(null);
    }
  };

  const handleApplyField = async (
    messageIndex: number,
    field: string,
    value: string
  ) => {
    try {
      if (field === "narrative") {
        onApplyNarrative(value);
        toast.success("Narrative applied");
      } else {
        await onApplyField(field, value);
        toast.success(`${field} updated`);
      }

      // Mark field as applied
      setMessages((prev) =>
        prev.map((msg, idx) => {
          if (idx === messageIndex && msg.appliedFields) {
            msg.appliedFields.add(field);
          }
          return msg;
        })
      );
    } catch (error) {
      console.error("Error applying field:", error);
      toast.error(`Failed to apply ${field}`);
    }
  };

  const handleApplyAllFields = async (messageIndex: number) => {
    const message = messages[messageIndex];
    if (!message.suggestedFields) return;

    const fields = message.suggestedFields;

    try {
      if (fields.narrative) {
        onApplyNarrative(fields.narrative);
      }
      if (fields.monitoringAreaId) {
        await onApplyField("monitoringAreaId", fields.monitoringAreaId);
      }
      if (fields.taskTypeId) {
        await onApplyField("taskTypeId", fields.taskTypeId);
      }
      if (fields.riskRating) {
        await onApplyField("riskRating", fields.riskRating);
      }
      if (fields.deferralReason) {
        await onApplyField("deferralReason", fields.deferralReason);
      }

      toast.success("All fields applied");

      // Mark all fields as applied
      setMessages((prev) =>
        prev.map((msg, idx) => {
          if (idx === messageIndex && msg.appliedFields) {
            Object.keys(fields).forEach((field) => msg.appliedFields!.add(field));
          }
          return msg;
        })
      );
    } catch (error) {
      console.error("Error applying all fields:", error);
      toast.error("Failed to apply some fields");
    }
  };

  const quickActions = [
    {
      label: "Upload document",
      action: () => fileInputRef.current?.click(),
    },
    {
      label: "Draft narrative",
      action: () =>
        sendMessage(
          "Please draft the execution narrative based on the context",
          "draft-narrative"
        ),
    },
    {
      label: "Review previous",
      action: () =>
        sendMessage(
          "Summarize what was done in the previous execution of this task"
        ),
    },
    {
      label: "Suggest fields",
      action: () =>
        sendMessage(
          "Suggest monitoring area, task type, and risk rating for this task",
          "fill-fields"
        ),
    },
  ];

  return (
    <div className="fixed right-0 top-0 h-full w-[400px] bg-white border-l border-gray-200 shadow-xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">OpenClaw AI</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          aria-label="Close AI panel"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Chat area */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.map((message, index) => (
          <div key={index}>
            {message.role === "user" ? (
              <div className="flex justify-end">
                <div className="bg-blue-600 text-white px-4 py-2 rounded-lg max-w-[85%]">
                  {message.content}
                </div>
              </div>
            ) : (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-4 py-2 rounded-lg max-w-[95%] space-y-3">
                  <div className="text-gray-800 whitespace-pre-wrap">
                    {message.content}
                  </div>

                  {/* Document Analysis */}
                  {message.documentAnalysis && (
                    <div className="border border-gray-300 rounded-lg p-3 bg-white space-y-2">
                      <div className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Document Analysis
                      </div>
                      {message.documentAnalysis.documentType && (
                        <div className="text-sm text-gray-600">
                          Type: {message.documentAnalysis.documentType}
                        </div>
                      )}
                      {message.documentAnalysis.complianceConfirmations &&
                        message.documentAnalysis.complianceConfirmations.length >
                          0 && (
                          <div className="space-y-1">
                            {message.documentAnalysis.complianceConfirmations.map(
                              (item, i) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-2 text-sm text-green-700"
                                >
                                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                  <span>{safeString(item)}</span>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      {message.documentAnalysis.complianceIssues &&
                        message.documentAnalysis.complianceIssues.length > 0 && (
                          <div className="space-y-1">
                            {message.documentAnalysis.complianceIssues.map(
                              (item, i) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-2 text-sm text-amber-700"
                                >
                                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                  <span>{safeString(item)}</span>
                                </div>
                              )
                            )}
                          </div>
                        )}
                    </div>
                  )}

                  {/* Suggested Fields */}
                  {message.suggestedFields && (
                    <div className="border border-blue-300 rounded-lg p-3 bg-blue-50 space-y-2">
                      <div className="font-semibold text-sm text-blue-900">
                        Suggested Fields
                      </div>
                      {message.suggestedFields.narrative && (
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-blue-700 font-medium">
                              Narrative
                            </div>
                            <div className="text-sm text-gray-700 line-clamp-2">
                              {message.suggestedFields.narrative.substring(
                                0,
                                100
                              )}
                              ...
                            </div>
                          </div>
                          {message.appliedFields?.has("narrative") ? (
                            <span className="text-green-600 text-xs flex items-center gap-1 flex-shrink-0">
                              <Check className="w-3 h-3" /> Applied
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                message.suggestedFields?.narrative &&
                                handleApplyField(
                                  index,
                                  "narrative",
                                  message.suggestedFields.narrative
                                )
                              }
                              disabled={!message.suggestedFields?.narrative}
                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors flex-shrink-0 disabled:opacity-50"
                            >
                              Apply
                            </button>
                          )}
                        </div>
                      )}
                      {message.suggestedFields.monitoringAreaName && (
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-xs text-blue-700 font-medium">
                              Monitoring Area:{" "}
                            </span>
                            <span className="text-sm text-gray-700">
                              {message.suggestedFields.monitoringAreaName}
                            </span>
                          </div>
                          {message.appliedFields?.has("monitoringAreaId") ? (
                            <span className="text-green-600 text-xs flex items-center gap-1">
                              <Check className="w-3 h-3" /> Applied
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                message.suggestedFields?.monitoringAreaId &&
                                handleApplyField(
                                  index,
                                  "monitoringAreaId",
                                  message.suggestedFields.monitoringAreaId
                                )
                              }
                              disabled={
                                !message.suggestedFields?.monitoringAreaId
                              }
                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                              Apply
                            </button>
                          )}
                        </div>
                      )}
                      {message.suggestedFields.taskTypeName && (
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-xs text-blue-700 font-medium">
                              Task Type:{" "}
                            </span>
                            <span className="text-sm text-gray-700">
                              {message.suggestedFields.taskTypeName}
                            </span>
                          </div>
                          {message.appliedFields?.has("taskTypeId") ? (
                            <span className="text-green-600 text-xs flex items-center gap-1">
                              <Check className="w-3 h-3" /> Applied
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                message.suggestedFields?.taskTypeId &&
                                handleApplyField(
                                  index,
                                  "taskTypeId",
                                  message.suggestedFields.taskTypeId
                                )
                              }
                              disabled={!message.suggestedFields?.taskTypeId}
                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                              Apply
                            </button>
                          )}
                        </div>
                      )}
                      {message.suggestedFields.riskRating && (
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-xs text-blue-700 font-medium">
                              Risk Rating:{" "}
                            </span>
                            <span className="text-sm text-gray-700">
                              {message.suggestedFields.riskRating}
                            </span>
                          </div>
                          {message.appliedFields?.has("riskRating") ? (
                            <span className="text-green-600 text-xs flex items-center gap-1">
                              <Check className="w-3 h-3" /> Applied
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                message.suggestedFields?.riskRating &&
                                handleApplyField(
                                  index,
                                  "riskRating",
                                  message.suggestedFields.riskRating
                                )
                              }
                              disabled={!message.suggestedFields?.riskRating}
                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                              Apply
                            </button>
                          )}
                        </div>
                      )}
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleApplyAllFields(index)}
                          className="px-3 py-1 bg-blue-700 text-white text-xs rounded hover:bg-blue-800 transition-colors font-medium"
                        >
                          Apply All
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Suggested Finding */}
                  {message.suggestedFinding && (
                    <div className="border border-amber-300 rounded-lg p-3 bg-amber-50 space-y-2">
                      <div className="font-semibold text-sm text-amber-900">
                        Suggested Finding
                      </div>
                      {(message.suggestedFinding.title ||
                        message.suggestedFinding.description ||
                        message.suggestedFinding.severity) && (
                        <div>
                          {message.suggestedFinding.title && (
                            <div className="text-xs text-amber-700 font-medium">
                              {message.suggestedFinding.title}
                            </div>
                          )}
                          {message.suggestedFinding.description && (
                            <div className="text-sm text-gray-700 mt-1">
                              {message.suggestedFinding.description}
                            </div>
                          )}
                          {message.suggestedFinding.severity && (
                            <div className="text-xs text-amber-600 mt-1">
                              Severity: {message.suggestedFinding.severity}
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() =>
                          message.suggestedFinding &&
                          onOpenFinding(message.suggestedFinding)
                        }
                        className="w-full px-3 py-2 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 transition-colors font-medium"
                      >
                        Create Finding
                      </button>
                    </div>
                  )}

                  {/* Next Steps */}
                  {message.nextSteps && message.nextSteps.length > 0 && (
                    <div className="border border-gray-300 rounded-lg p-3 bg-gray-50 space-y-2">
                      <div className="font-semibold text-sm text-gray-700">
                        Next Steps
                      </div>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                        {message.nextSteps.map((step, i) => (
                          <li key={i}>{safeString(step)}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick actions after first AI message */}
            {message.role === "assistant" && index === 1 && (
              <div className="flex flex-wrap gap-2 mt-2 ml-1">
                {quickActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={action.action}
                    className="px-3 py-1 bg-white border border-gray-300 text-gray-700 text-xs rounded-full hover:bg-gray-50 transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {/* Save as evidence prompt */}
            {pendingFile && pendingFile.messageIndex === index && (
              <div className="flex gap-2 mt-2 ml-1">
                <span className="text-sm text-gray-600">
                  Save this file as task evidence?
                </span>
                <button
                  onClick={() => handleSaveAsEvidence(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Yes
                </button>
                <button
                  onClick={() => handleSaveAsEvidence(false)}
                  className="text-sm text-gray-600 hover:text-gray-700"
                >
                  No
                </button>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2 rounded-lg flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
              <span className="text-sm text-gray-600">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <div className="flex items-end gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.docx,.txt,.csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="p-2 text-gray-600 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
            aria-label="Upload document"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(inputValue);
              }
            }}
            placeholder="Ask me anything about this task..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            rows={2}
          />
          <button
            onClick={() => sendMessage(inputValue)}
            disabled={isLoading || !inputValue.trim()}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
