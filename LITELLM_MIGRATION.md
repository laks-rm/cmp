# LiteLLM Migration Summary

This document outlines the changes made to migrate from Anthropic SDK to LiteLLM for AI features.

## Overview

The application now uses LiteLLM as the AI gateway instead of the Anthropic SDK directly. LiteLLM provides an OpenAI-compatible API format that allows us to use Claude models through a unified interface.

## Changes Made

### 1. Environment Configuration

**File:** `cmp-app/.env.example`

- **Removed:** `ANTHROPIC_API_KEY`
- **Added:**
  - `LITELLM_BASE_URL="https://litellmprod.deriv.ai/v1"`
  - `LITELLM_API_KEY=""`

**Action Required:** Update your `.env` file with the correct LiteLLM credentials.

### 2. AI Extract API Route

**File:** `cmp-app/src/app/api/sources/ai-extract/route.ts`

**Changes:**
- Removed import and initialization of `@anthropic-ai/sdk`
- Converted all AI calls to use LiteLLM's OpenAI-compatible `chat/completions` endpoint
- Updated model from `claude-3-5-sonnet-20241022` to `claude-sonnet-4-6`
- Set temperature to `0.3` for factual compliance work
- Updated environment variable check from `ANTHROPIC_API_KEY` to `LITELLM_API_KEY`
- Maintained retry logic and error handling patterns

**API Pattern Used:**
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
      { role: "user", content: prompt },
      // ... conversation history
    ],
    max_tokens: 8000,
    temperature: 0.3,
  }),
});

const data = await response.json();
const aiResponse = data.choices[0].message.content;
```

### 3. Feature Detection API

**File:** `cmp-app/src/app/api/features/route.ts` (NEW)

Created a new API endpoint to check if AI features are available:

```typescript
GET /api/features
```

**Response:**
```json
{
  "aiExtractEnabled": true
}
```

This endpoint checks if both `LITELLM_API_KEY` and `LITELLM_BASE_URL` are configured.

### 4. Frontend Component Updates

**File:** `cmp-app/src/components/sources/ClausesTasksSection.tsx`

**Changes:**
- Added `useEffect` hook to check AI feature availability on component mount
- Added state variables: `aiExtractEnabled` and `isCheckingFeatures`
- Conditionally renders the "AI Extract" button only when `aiExtractEnabled` is `true`
- Gracefully hides the AI button if LiteLLM is not configured

**User Experience:**
- If `LITELLM_API_KEY` is not set, the AI Extract button is hidden
- Users only see "Build Manually" and "Paste from Excel" options
- No error messages displayed; the feature is simply unavailable

## Configuration Settings

### Model Selection
- **Primary Model:** `claude-sonnet-4-6` (high-quality analysis and execution)
- **Temperature:** `0.3` (low temperature for factual compliance work)
- **Max Tokens:** `8000` (suitable for extracting clauses and tasks)

### Security
- API keys are stored as environment variables (never in code)
- Authorization header uses Bearer token authentication
- Environment variables are checked server-side before making AI calls

## Testing Checklist

- [ ] Verify `LITELLM_BASE_URL` is set to `https://litellmprod.deriv.ai/v1`
- [ ] Verify `LITELLM_API_KEY` is set with valid credentials
- [ ] Test AI Extract feature with a PDF document
- [ ] Test AI Extract feature with a DOCX document
- [ ] Verify AI Extract button is hidden when `LITELLM_API_KEY` is not set
- [ ] Verify error handling works correctly (invalid files, API errors, etc.)
- [ ] Check that extracted clauses and tasks are formatted correctly
- [ ] Verify retry logic works when AI returns invalid JSON

## Migration Notes

### For Future AI Features

All new AI features should follow this pattern:

1. Use the LiteLLM fetch pattern (OpenAI-compatible format)
2. Use `LITELLM_BASE_URL` and `LITELLM_API_KEY` environment variables
3. Use `claude-sonnet-4-6` as the primary model
4. Set temperature based on use case:
   - `0.3` for factual/compliance work
   - `0.7` for creative/generative work
5. Check for API key availability using `/api/features` endpoint
6. Handle errors gracefully with user-friendly messages

### Anthropic SDK Dependency

The `@anthropic-ai/sdk` package is still in `package.json` but is no longer used. It can be removed if desired:

```bash
npm uninstall @anthropic-ai/sdk
```

## Rollback Instructions

If you need to rollback to the Anthropic SDK:

1. Revert changes to `src/app/api/sources/ai-extract/route.ts`
2. Update `.env.example` to use `ANTHROPIC_API_KEY`
3. Remove `/api/features` endpoint
4. Revert frontend component changes
5. Ensure `@anthropic-ai/sdk` is installed

## Additional Resources

- [LiteLLM Documentation](https://docs.litellm.ai/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference/chat)
- [Claude Model Documentation](https://docs.anthropic.com/claude/docs/models-overview)
