# Fix 31: API Versioning Strategy

## Problem

**Current State:** No API versioning
- All endpoints at `/api/tasks`, `/api/sources`, etc.
- Any breaking changes will break ALL clients
- Cannot deprecate old endpoints gracefully
- No migration path for API consumers
- Cannot iterate on API design without fear

**Example Breaking Changes:**
```typescript
// V1: Returns individual fields
GET /api/tasks/123
→ { id, name, status, createdAt, ... }

// V2: Nested structure (BREAKS V1 clients!)
GET /api/tasks/123
→ { id, name, meta: { status, createdAt }, ... }
```

**Impact:**
1. **Fear of Change:** Developers afraid to improve API
2. **Technical Debt:** Accumulates because we can't fix bad decisions
3. **No Deprecation Path:** Can't sunset old features
4. **Client Breakage:** Frontend breaks with backend updates
5. **No Innovation:** Stuck with initial API design forever

---

## Solution: Flexible API Versioning

### Strategy: Support Multiple Versioning Methods

1. **URL-based versioning** (Recommended for major versions)
   - `/api/v1/tasks`
   - `/api/v2/tasks`
   - Clear, explicit, easy to cache

2. **Header-based versioning** (For minor versions/features)
   - `API-Version: v1`
   - `API-Version: v2`
   - Cleaner URLs, same endpoint

3. **Query parameter** (Fallback/testing)
   - `/api/tasks?version=v1`
   - Easy for quick testing

**Priority Order:** URL → Header → Query → Default (v1)

---

## Implementation

### 1. Versioning Utilities ✅

**File:** `src/lib/apiVersioning.ts`

**Features:**
- Version extraction from URL/header/query
- Version validation
- Deprecation warnings
- Feature flags per version
- Response transformation for compatibility
- Migration guidance

**Key Functions:**
```typescript
getApiVersion(req)              // Extract version from request
isValidVersion(version)         // Validate version
getVersionHeaders(version)      // Version metadata headers
getVersionFeatures(version)     // Feature flags
transformResponseForVersion()   // Backward compatibility
```

### 2. Versioning Middleware ✅

**File:** `src/lib/apiVersioningMiddleware.ts`

**Features:**
- Automatic version handling
- Deprecation logging
- Response header injection
- Version validation
- Compatibility checking

**Usage:**
```typescript
import { withVersioning } from "@/lib/apiVersioningMiddleware";

export async function GET(req: NextRequest) {
  return withVersioning(req, async (req, version) => {
    // Your route logic here
    // `version` is automatically validated
    
    const tasks = await prisma.task.findMany();
    return NextResponse.json({ tasks });
  });
}
```

---

## Migration Paths

### Option 1: Header-Based (Recommended for Existing API)

**Advantages:**
- No URL changes needed
- Easier migration
- Backward compatible
- Cleaner URLs

**Implementation:**
```typescript
// All existing routes continue to work
GET /api/tasks
→ Returns v1 (default)

// New clients specify version
GET /api/tasks
API-Version: v2
→ Returns v2
```

**Steps:**
1. Add `withVersioning` wrapper to existing routes
2. Version defaults to v1 (current API)
3. When ready for v2, implement v2-specific logic
4. Gradually migrate clients to v2
5. Eventually deprecate v1

### Option 2: URL-Based (Recommended for New API)

**Advantages:**
- Very explicit
- Easy to cache
- Clear separation
- Standard practice

**Implementation:**

#### Step 1: Create v1 directory structure
```bash
mkdir -p src/app/api/v1
```

#### Step 2: Move existing routes to v1
```bash
# Move routes to v1 (example)
mv src/app/api/tasks src/app/api/v1/tasks
mv src/app/api/sources src/app/api/v1/sources
# ... etc for all routes
```

#### Step 3: Update imports
```typescript
// Frontend code
- const response = await fetch('/api/tasks');
+ const response = await fetch('/api/v1/tasks');
```

#### Step 4: Create v2 when needed
```bash
mkdir -p src/app/api/v2/tasks
```

### Option 3: Hybrid (Best of Both Worlds)

**Use both URL and header versioning:**
- Major versions: `/api/v1/`, `/api/v2/` (breaking changes)
- Minor versions: `API-Version: v1.1` (additive changes)

---

## Usage Examples

### Basic Version Handling

```typescript
// src/app/api/v1/tasks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withVersioning } from "@/lib/apiVersioningMiddleware";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  return withVersioning(req, async (req, version) => {
    const tasks = await prisma.task.findMany();
    
    // V1 response format
    return NextResponse.json({
      tasks,
      total: tasks.length,
    });
  });
}
```

### Version-Specific Logic

```typescript
import { withVersioning, isFeatureAvailable } from "@/lib/apiVersioning";

export async function GET(req: NextRequest) {
  return withVersioning(req, async (req, version) => {
    const where: any = { deletedAt: null };
    
    // Enhanced filtering only in v2
    if (isFeatureAvailable("enhancedFiltering", version)) {
      const { advancedFilter } = await req.json();
      where.AND = buildAdvancedFilter(advancedFilter);
    }
    
    const tasks = await prisma.task.findMany({ where });
    
    // Transform response based on version
    return NextResponse.json(
      transformResponseForVersion({ tasks }, version)
    );
  });
}
```

### Response Headers

All versioned endpoints return headers:

```http
API-Version: v1
API-Current-Version: v1
API-Latest-Version: v2
API-Supported-Versions: v1, v2
API-Deprecation-Warning: API version v1 is deprecated...
Sunset: Wed, 15 Sep 2026 23:59:59 GMT
```

---

## Versioning Best Practices

### When to Create New Version

**Create new major version (v2) when:**
- ✅ Removing fields from response
- ✅ Renaming fields
- ✅ Changing field types (string → number)
- ✅ Removing endpoints
- ✅ Changing behavior significantly

**DON'T create new version for:**
- ❌ Adding optional fields (backward compatible)
- ❌ Adding new endpoints (additive)
- ❌ Bug fixes
- ❌ Performance improvements

### Deprecation Timeline

**Standard deprecation process:**
1. **Announce (Month 0):** New version released, old version marked deprecated
2. **Warning Period (Months 1-3):** Headers warn clients
3. **Migration Period (Months 4-6):** Support both versions
4. **Sunset (Month 6+):** Remove old version

**In headers:**
```http
API-Deprecation-Warning: API version v1 is deprecated and will be removed on 2026-09-15
Sunset: Wed, 15 Sep 2026 23:59:59 GMT
```

### Semantic Versioning for APIs

- **v1 → v2:** Breaking changes (major)
- **v1.0 → v1.1:** New features (minor, header-based)
- **v1.1.0 → v1.1.1:** Bug fixes (patch, transparent)

---

## Migration Guide: v1 → v2

### Breaking Changes in v2 (Example)

#### 1. Response Structure
```typescript
// V1 (flat)
{
  id: "123",
  name: "Task",
  status: "TO_DO",
  createdAt: "2026-01-01"
}

// V2 (nested)
{
  id: "123",
  name: "Task",
  metadata: {
    status: "TO_DO",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-02"
  }
}
```

#### 2. Pagination
```typescript
// V1
{
  tasks: [...],
  total: 100
}

// V2 (cursor-based)
{
  data: {
    items: [...],
  },
  pagination: {
    nextCursor: "abc123",
    hasMore: true
  }
}
```

#### 3. Filtering
```typescript
// V1 (basic)
GET /api/tasks?status=TO_DO

// V2 (advanced)
GET /api/tasks?filter[status]=TO_DO&filter[dueDate][gte]=2026-01-01
```

---

## Directory Structure

### Option A: Header-Based (Current)
```
src/app/api/
├── tasks/
│   └── route.ts          # Handles all versions via header
├── sources/
│   └── route.ts
└── ...
```

### Option B: URL-Based (Recommended)
```
src/app/api/
├── v1/
│   ├── tasks/
│   │   └── route.ts
│   ├── sources/
│   │   └── route.ts
│   └── ...
├── v2/
│   ├── tasks/
│   │   └── route.ts      # New v2 implementation
│   └── ...
└── (legacy routes remain for transition period)
```

### Option C: Hybrid
```
src/app/api/
├── v1/
│   ├── tasks/
│   │   └── route.ts      # v1.x via header
│   └── ...
├── v2/
│   ├── tasks/
│   │   └── route.ts      # v2.x via header
│   └── ...
```

---

## Frontend Integration

### API Client Updates

```typescript
// src/lib/api-client.ts
import { fetchApi } from "@/lib/api-client";

// Specify version explicitly
const tasks = await fetchApi<Task[]>('/api/v1/tasks');

// Or use header
const tasks = await fetchApi<Task[]>('/api/tasks', {
  headers: { 'API-Version': 'v1' }
});

// Utility for version-aware requests
export async function fetchApiWithVersion<T>(
  url: string,
  version: string = 'v1',
  options?: RequestInit
): Promise<T> {
  return fetchApi<T>(url, {
    ...options,
    headers: {
      ...options?.headers,
      'API-Version': version,
    },
  });
}
```

### Version Detection

```typescript
// Check which version responded
const response = await fetch('/api/tasks');
const version = response.headers.get('API-Version');
const isDeprecated = response.headers.has('API-Deprecation-Warning');

if (isDeprecated) {
  console.warn(response.headers.get('API-Deprecation-Warning'));
}
```

---

## Testing

### Version Testing

```typescript
// tests/api/versioning.test.ts
describe('API Versioning', () => {
  it('defaults to v1 when no version specified', async () => {
    const response = await fetch('/api/tasks');
    expect(response.headers.get('API-Version')).toBe('v1');
  });

  it('accepts version via header', async () => {
    const response = await fetch('/api/tasks', {
      headers: { 'API-Version': 'v2' }
    });
    expect(response.headers.get('API-Version')).toBe('v2');
  });

  it('rejects invalid version', async () => {
    const response = await fetch('/api/tasks', {
      headers: { 'API-Version': 'v99' }
    });
    expect(response.status).toBe(400);
  });

  it('includes deprecation warning for v1', async () => {
    const response = await fetch('/api/tasks', {
      headers: { 'API-Version': 'v1' }
    });
    expect(response.headers.has('API-Deprecation-Warning')).toBe(true);
  });
});
```

---

## Benefits

### Before (No Versioning)
- ❌ Breaking changes break all clients
- ❌ Cannot deprecate bad API design
- ❌ Fear of making improvements
- ❌ No migration path
- ❌ Technical debt accumulates

### After (With Versioning)
- ✅ Breaking changes isolated to new version
- ✅ Graceful deprecation path (6-month warning)
- ✅ Can improve API design iteratively
- ✅ Clear migration timeline
- ✅ Multiple versions supported simultaneously

---

## Rollout Plan

### Phase 1: Infrastructure (✅ COMPLETE)
- [x] Create versioning utilities
- [x] Create middleware
- [x] Documentation

### Phase 2: Existing API (TODO)
- [ ] Add `withVersioning` to all existing routes
- [ ] Test with header-based versioning
- [ ] Update frontend to send version headers
- [ ] Monitor API version usage

### Phase 3: URL Migration (Optional)
- [ ] Create `/api/v1/` structure
- [ ] Move routes to v1 directory
- [ ] Update all frontend URLs
- [ ] Redirect old URLs → v1 (transition period)
- [ ] Remove redirects after migration

### Phase 4: V2 Development (Future)
- [ ] Design v2 API improvements
- [ ] Implement v2 routes
- [ ] Write migration guide
- [ ] Deprecate v1 (6-month warning)
- [ ] Remove v1 (after sunset date)

---

## Configuration

### Environment Variables

```env
# .env
API_VERSION_DEFAULT=v1
API_VERSION_SUPPORTED=v1,v2
API_VERSION_DEPRECATED=
API_DEPRECATION_SUNSET_MONTHS=6
```

### Feature Flags

```typescript
// src/lib/apiVersioning.ts
export const VERSION_FEATURES = {
  v1: {
    softDelete: true,
    enhancedFiltering: false,
    cursorPagination: false,
  },
  v2: {
    softDelete: true,
    enhancedFiltering: true,
    cursorPagination: true,
  },
};
```

---

## Monitoring

### Metrics to Track

1. **Version Usage**
   - Requests per version
   - Active clients per version

2. **Deprecation**
   - Clients still using deprecated versions
   - Time until sunset

3. **Migration Progress**
   - % of clients on latest version

### Logging

```typescript
// Log version usage
await logAuditEvent({
  action: "API_VERSION_USED",
  module: "API",
  details: {
    version,
    endpoint: req.nextUrl.pathname,
    deprecated: isDeprecated,
  },
});
```

---

## Related Standards

- **RFC 6648:** Deprecating "X-" prefix
- **RFC 8594:** Sunset HTTP Header
- **Semantic Versioning 2.0.0:** Version numbering
- **REST API Versioning Best Practices:** Industry standards

---

**Status:** ✅ Infrastructure Complete  
**Recommended:** Header-based for existing API, URL-based for future  
**Priority:** High (enables safe API evolution)  
**Impact:** Enables breaking changes without breaking clients
