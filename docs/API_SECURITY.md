# API Security Configuration

## Request Size Limits

The application implements multiple layers of request size protection:

### 1. File Upload Limits

**Evidence Files:** 10MB maximum (enforced in validation)
```typescript
// src/lib/validations/evidence.ts
export const uploadEvidenceSchema = z.object({
  fileSize: z.number().int().positive().max(10 * 1024 * 1024), // 10MB max
});
```

**File Size Validation:** 50MB maximum at API level
```typescript
// src/app/api/evidence/route.ts
const fileSize = file.size;
if (fileSize > 50 * 1024 * 1024) {
  return NextResponse.json({ error: "File size exceeds 50MB limit" }, { status: 400 });
}
```

### 2. API Body Size Limits

**Next.js Configuration:** 2MB limit for server actions
```javascript
// next.config.mjs
experimental: {
  serverActions: {
    bodySizeLimit: '2mb',
  },
}
```

**Note:** Next.js 14+ with App Router handles body parsing automatically. File uploads use FormData streaming and are not subject to the JSON body limit.

### 3. Content-Specific Limits

**Comments:** 2,000 characters maximum
```typescript
content: z.string().min(1).max(2000).trim()
```

**Narratives:** 5,000 characters maximum
```typescript
narrative: z.string().max(5000).trim().optional()
```

**AI Document Extraction:** 50,000 characters maximum
```typescript
const MAX_DOCUMENT_CHARS = 50000; // ~12,500 tokens
```

## Environment Variable Security

### Server-Only Secrets

The following environment variables are **NEVER** exposed to the client:

- `ANTHROPIC_API_KEY` - Only used in `/api/sources/ai-extract/route.ts` (server-side)
- `NEXTAUTH_SECRET` - Only used in NextAuth configuration (server-side)
- `DATABASE_URL` - Only used by Prisma (server-side)
- `CRON_SECRET` - Only used in cron endpoints (server-side)

### Verification

To verify no secrets are exposed in client builds:

```bash
# Build the application
npm run build

# Check for exposed secrets (should return nothing)
grep -r "ANTHROPIC_API_KEY" .next/static/
grep -r "NEXTAUTH_SECRET" .next/static/
grep -r "DATABASE_URL" .next/static/
```

### Architecture

```
┌─────────────────────┐
│   Client Browser    │
│  (Public Access)    │
│                     │
│  ✅ NEXTAUTH_URL    │
│  ❌ API Keys        │
│  ❌ DB Credentials  │
└─────────────────────┘
         ↓ HTTPS
┌─────────────────────┐
│   Next.js Server    │
│  (API Routes Only)  │
│                     │
│  ✅ All Secrets     │
│  ✅ Database Access │
│  ✅ External APIs   │
└─────────────────────┘
```

## DoS Protection

### Request Rate Limiting

Rate limiting is implemented in `src/lib/rate-limit.ts`:

- **Login attempts:** 5 attempts per 15 minutes per email
- **API requests:** 100 requests per minute per user (planned)

### Request Size Limits Summary

| Endpoint Type | Limit | Enforced By |
|---------------|-------|-------------|
| JSON API | 2MB | Next.js config |
| File uploads | 50MB | API validation |
| Evidence files | 10MB | Schema validation |
| AI extraction | 50K chars | Input validation |
| Comments | 2K chars | Schema validation |
| Narratives | 5K chars | Schema validation |

### Best Practices

1. **All file uploads** must validate size before processing
2. **Large payloads** should use streaming when possible
3. **Never trust client-side** size validation alone
4. **Always validate** on the server side
5. **Log rejected requests** for security monitoring

## Monitoring

To monitor for DoS attempts:

```bash
# Check for large request rejections in logs
grep "File size exceeds" logs/app.log
grep "Document too large" logs/app.log
grep "String must contain at most" logs/app.log
```

## Future Enhancements

Consider implementing:

1. **Per-user upload quotas** (e.g., 100MB per day)
2. **Global request size monitoring** via middleware
3. **Automatic rate limiting** based on request patterns
4. **Request size alerting** for unusual patterns
