# LiteLLM API Pattern - Quick Reference

This is a quick reference guide for using LiteLLM in the CMP application.

## Basic API Call Pattern

```typescript
const response = await fetch(`${process.env.LITELLM_BASE_URL}/chat/completions`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.LITELLM_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-6",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: 2000,
    temperature: 0.3,
  }),
});

if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`LiteLLM API error: ${response.status} - ${errorText}`);
}

const data = await response.json();
const aiResponse = data.choices[0].message.content;
```

## With Conversation History

```typescript
const conversationHistory = [
  { role: "user", content: "First message" },
  { role: "assistant", content: "First response" },
  { role: "user", content: "Follow-up message" },
];

const response = await fetch(`${process.env.LITELLM_BASE_URL}/chat/completions`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.LITELLM_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-6",
    messages: conversationHistory,
    max_tokens: 2000,
    temperature: 0.3,
  }),
});
```

## Environment Variables

```bash
LITELLM_BASE_URL="https://litellmprod.deriv.ai/v1"
LITELLM_API_KEY="your-service-account-key"
```

## Checking API Key Availability

### Backend (API Route)

```typescript
if (!process.env.LITELLM_API_KEY) {
  return NextResponse.json(
    { error: "LiteLLM API key not configured" },
    { status: 500 }
  );
}
```

### Frontend (React Component)

```typescript
const [aiEnabled, setAiEnabled] = useState(false);

useEffect(() => {
  const checkFeatures = async () => {
    const res = await fetch("/api/features");
    if (res.ok) {
      const data = await res.json();
      setAiEnabled(data.aiExtractEnabled);
    }
  };
  checkFeatures();
}, []);

// Conditionally render AI features
{aiEnabled && (
  <button onClick={handleAIAction}>AI Assist</button>
)}
```

## Model Configuration

| Model | Use Case | Temperature |
|-------|----------|-------------|
| `claude-sonnet-4-6` | Primary model for analysis & execution | `0.3` for factual work, `0.7` for creative |

## Common Parameters

- `max_tokens`: Maximum tokens to generate (typically `2000-8000`)
- `temperature`: Randomness (0.0 = deterministic, 1.0 = creative)
  - `0.3`: Factual, compliance, data extraction
  - `0.7`: Creative writing, brainstorming
- `model`: The AI model to use (`claude-sonnet-4-6`)

## Error Handling

```typescript
try {
  const response = await fetch(/* ... */);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LiteLLM API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  // Process response
} catch (error) {
  console.error("AI API error:", error);
  // Return user-friendly error
  return NextResponse.json(
    { 
      error: error instanceof Error 
        ? error.message 
        : "AI service unavailable" 
    },
    { status: 500 }
  );
}
```

## Response Format

```typescript
{
  "id": "chatcmpl-xyz",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "claude-sonnet-4-6",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The AI response text"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 200,
    "total_tokens": 300
  }
}
```

## Best Practices

1. **Always check for API key** before making calls
2. **Use appropriate temperature** based on the task
3. **Set reasonable max_tokens** to avoid excessive usage
4. **Handle errors gracefully** with user-friendly messages
5. **Log errors server-side** for debugging
6. **Never expose API keys** to the frontend
7. **Use conversation history** for multi-turn interactions
8. **Validate AI responses** before using them (especially JSON)

## Example: JSON Extraction with Retry

```typescript
let extractedData;
let retryCount = 0;
const maxRetries = 2;

while (retryCount <= maxRetries) {
  try {
    const response = await fetch(`${process.env.LITELLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.LITELLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const responseText = data.choices[0].message.content;
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : responseText;
    
    extractedData = JSON.parse(jsonText);
    break; // Success
  } catch (error) {
    retryCount++;
    if (retryCount > maxRetries) {
      throw new Error("Failed to extract valid JSON after retries");
    }
    // Continue to retry
  }
}
```
