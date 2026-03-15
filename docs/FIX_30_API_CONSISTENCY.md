# Fix 30: API Response Consistency (camelCase)

## Problem

**Issue:** API responses mix different casing conventions

**Examples of Inconsistency:**
```json
{
  "taskId": "uuid",           // camelCase ✅
  "created_at": "2026-01-01", // snake_case ❌
  "PICId": "uuid",            // PascalCase ❌
  "entity_id": "uuid",        // snake_case ❌
  "updatedAt": "2026-01-01",  // camelCase ✅
  "TeamId": "uuid"            // PascalCase ❌
}
```

**Impact:**
1. **Frontend Confusion:** Developers unsure which casing to use
2. **TypeScript Errors:** Type mismatches between API and client
3. **Mapping Overhead:** Need to transform keys in frontend
4. **Bugs:** Typos like `task.created_at` vs `task.createdAt`
5. **Poor DX:** Inconsistent API makes integration harder
6. **Testing Issues:** Mock data may use wrong casing

**Root Causes:**
- Prisma schema uses camelCase (correct)
- Some raw SQL queries return snake_case
- Manual JSON construction uses mixed casing
- Copy-paste from database tools (snake_case)
- Inconsistent developer practices

---

## Solution: Enforce camelCase Everywhere

### Strategy

1. **Prisma Schema:** Already uses camelCase ✅
2. **Serialization:** Add automatic camelCase conversion
3. **API Utilities:** Standardized response helpers
4. **Type Safety:** TypeScript types enforce camelCase
5. **Linting:** Catch casing errors at development time

---

## Implementation

### 1. Enhanced Prisma Client ✅

**File:** `src/lib/prisma.ts`

**Changes:**
- Added `serializeResponse()` function for camelCase conversion
- Added `CamelCaseResponse<T>` type helper
- Documentation for proper usage

**Serialization Function:**
```typescript
export function serializeResponse<T>(data: T): T {
  // Automatically converts snake_case to camelCase
  // Handles nested objects and arrays
  // Preserves Date objects
}
```

**Type Helper:**
```typescript
export type CamelCaseResponse<T> = {
  [K in keyof T as K extends string
    ? K extends `${infer First}_${infer Rest}`
      ? `${First}${Capitalize<Rest>}`
      : K
    : K]: T[K];
};
```

### 2. API Response Utilities ✅

**File:** `src/lib/apiResponse.ts`

**Features:**
- `apiSuccess()` - Standardized success responses
- `apiError()` - Standardized error responses
- `createPagination()` - Pagination metadata
- `parseQueryParams()` - Normalize query parameters
- `ErrorCodes` - Standard error code constants
- `HttpStatus` - HTTP status code constants

**Usage Examples:**

#### Success Response
```typescript
// Before (inconsistent)
return NextResponse.json({
  tasks: data.tasks,
  total: data.total,
  created_at: new Date(),  // ❌ snake_case
});

// After (consistent)
return apiSuccess(
  { tasks: data.tasks },
  { 
    pagination: createPagination(page, limit, total),
    meta: { retrievedAt: new Date() }  // ✅ camelCase
  }
);
```

#### Error Response
```typescript
// Before (inconsistent)
return NextResponse.json(
  { error: "Not found", error_code: "NOT_FOUND" },  // ❌ mixed
  { status: 404 }
);

// After (consistent)
return apiError(
  "Task not found",
  { status: HttpStatus.NOT_FOUND, code: ErrorCodes.NOT_FOUND }
);
```

#### Query Parameter Normalization
```typescript
// Handles both camelCase and snake_case query params
const params = parseQueryParams(searchParams);
// Always returns camelCase:
// { page, limit, sortBy, sortOrder, entityId, teamId, etc. }
```

---

## Migration Guide

### Step 1: Update API Routes

#### Before:
```typescript
export async function GET(req: NextRequest) {
  const tasks = await prisma.task.findMany({
    include: { entity: true }
  });
  
  return NextResponse.json({
    tasks: tasks,
    total_count: tasks.length,  // ❌ snake_case
    created_at: new Date()       // ❌ snake_case
  });
}
```

#### After:
```typescript
import { apiSuccess, parseQueryParams, createPagination } from "@/lib/apiResponse";

export async function GET(req: NextRequest) {
  const { page, limit } = parseQueryParams(req.nextUrl.searchParams);
  
  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      include: { entity: true },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.task.count(),
  ]);
  
  return apiSuccess(
    { tasks },  // Automatically serialized to camelCase
    { pagination: createPagination(page, limit, total) }
  );
}
```

### Step 2: Handle Raw SQL Queries

If using raw SQL (returns snake_case):

```typescript
// Raw SQL query (returns snake_case from database)
const results = await prisma.$queryRaw`
  SELECT task_id, created_at, entity_id
  FROM tasks
  WHERE status = 'TO_DO'
`;

// Serialize to camelCase before returning
return apiSuccess(serializeResponse(results));

// Now returns: { taskId, createdAt, entityId } ✅
```

### Step 3: Type-Safe Responses

Use TypeScript to catch casing errors:

```typescript
import type { CamelCaseResponse } from "@/lib/prisma";

type TaskResponse = CamelCaseResponse<{
  taskId: string;
  taskName: string;
  createdAt: Date;
  // created_at: Date;  // ❌ TypeScript error - use camelCase!
}>;

export async function GET(): Promise<NextResponse<ApiResponse<TaskResponse>>> {
  const task = await prisma.task.findFirst();
  return apiSuccess(task);  // Type-checked ✅
}
```

---

## Naming Conventions

### Standard Field Names

Always use these camelCase names:

| Database/Prisma | API Response | ❌ Never Use |
|----------------|--------------|--------------|
| `createdAt` | `createdAt` | `created_at`, `CreatedAt` |
| `updatedAt` | `updatedAt` | `updated_at`, `UpdatedAt` |
| `deletedAt` | `deletedAt` | `deleted_at`, `DeletedAt` |
| `deletedBy` | `deletedBy` | `deleted_by`, `DeletedBy` |
| `entityId` | `entityId` | `entity_id`, `EntityId` |
| `teamId` | `teamId` | `team_id`, `TeamId` |
| `userId` | `userId` | `user_id`, `UserId` |
| `taskId` | `taskId` | `task_id`, `TaskId` |
| `findingId` | `findingId` | `finding_id`, `FindingId` |
| `sourceId` | `sourceId` | `source_id`, `SourceId` |
| `assigneeId` | `assigneeId` | `assignee_id`, `AssigneeId` |
| `picId` | `picId` | `pic_id`, `PICId`, `PicId` |
| `reviewerId` | `reviewerId` | `reviewer_id`, `ReviewerId` |

### Acronyms in camelCase

| Correct | ❌ Incorrect |
|---------|--------------|
| `picId` | `PICId`, `pic_id` |
| `htmlContent` | `HTMLContent`, `html_content` |
| `apiKey` | `APIKey`, `api_key` |
| `urlPath` | `URLPath`, `url_path` |
| `jsonData` | `JSONData`, `json_data` |

**Rule:** Acronyms are treated as words. First letter uppercase in camelCase position.

---

## Testing

### Unit Tests

```typescript
import { serializeResponse } from "@/lib/prisma";

describe("serializeResponse", () => {
  it("converts snake_case to camelCase", () => {
    const input = {
      task_id: "123",
      created_at: new Date(),
      entity_id: "456",
    };
    
    const output = serializeResponse(input);
    
    expect(output).toEqual({
      taskId: "123",
      createdAt: expect.any(Date),
      entityId: "456",
    });
  });
  
  it("handles nested objects", () => {
    const input = {
      task: {
        task_id: "123",
        user_info: {
          user_id: "789",
          created_at: new Date(),
        },
      },
    };
    
    const output = serializeResponse(input);
    
    expect(output.task.taskId).toBe("123");
    expect(output.task.userInfo.userId).toBe("789");
  });
  
  it("handles arrays", () => {
    const input = [
      { task_id: "1", created_at: new Date() },
      { task_id: "2", created_at: new Date() },
    ];
    
    const output = serializeResponse(input);
    
    expect(output[0].taskId).toBe("1");
    expect(output[1].taskId).toBe("2");
  });
});
```

### API Response Tests

```typescript
import { apiSuccess, apiError, HttpStatus, ErrorCodes } from "@/lib/apiResponse";

describe("API Response Utilities", () => {
  it("creates success response with camelCase", async () => {
    const response = apiSuccess({ tasks: [] });
    const json = await response.json();
    
    expect(json).toHaveProperty("data");
    expect(json.data).toHaveProperty("tasks");
  });
  
  it("creates error response with standard format", async () => {
    const response = apiError("Not found", {
      status: HttpStatus.NOT_FOUND,
      code: ErrorCodes.NOT_FOUND,
    });
    const json = await response.json();
    
    expect(json).toEqual({
      error: "Not found",
      code: "NOT_FOUND",
    });
    expect(response.status).toBe(404);
  });
});
```

---

## Benefits

### 1. Consistency
- ❌ Before: Mixed `created_at`, `createdAt`, `CreatedAt`
- ✅ After: Always `createdAt`

### 2. Type Safety
- ❌ Before: TypeScript allows wrong casing
- ✅ After: Compile-time errors for wrong casing

### 3. Developer Experience
- ❌ Before: Check API docs for each field's casing
- ✅ After: Know it's always camelCase

### 4. Frontend Integration
- ❌ Before: Need transformation layer
- ✅ After: Direct usage, no transformation

### 5. Testing
- ❌ Before: Mock data casing inconsistent
- ✅ After: All mocks follow same pattern

### 6. Maintainability
- ❌ Before: Casing bugs hard to find
- ✅ After: Utilities catch issues early

---

## Common Patterns

### Paginated List Response

```typescript
export async function GET(req: NextRequest) {
  const { page, limit, search, status } = parseQueryParams(req.nextUrl.searchParams);
  
  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where: {
        ...(search && { name: { contains: search } }),
        ...(status && { status }),
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.count({
      where: {
        ...(search && { name: { contains: search } }),
        ...(status && { status }),
      },
    }),
  ]);
  
  return apiSuccess(
    { items },
    { pagination: createPagination(page, limit, total) }
  );
}

// Response format:
// {
//   "data": {
//     "items": [...]
//   },
//   "pagination": {
//     "page": 1,
//     "limit": 10,
//     "total": 100,
//     "totalPages": 10
//   }
// }
```

### Single Item Response

```typescript
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const item = await prisma.task.findUnique({
    where: { id: params.id },
    include: { entity: true, assignee: true },
  });
  
  if (!item) {
    return apiError("Task not found", {
      status: HttpStatus.NOT_FOUND,
      code: ErrorCodes.NOT_FOUND,
    });
  }
  
  return apiSuccess(item);
}
```

### Create/Update Response

```typescript
export async function POST(req: NextRequest) {
  const body = await req.json();
  
  const created = await prisma.task.create({
    data: body,
    include: { entity: true },
  });
  
  return apiSuccess(created, { status: HttpStatus.CREATED });
}
```

---

## Linting (Future Enhancement)

Add ESLint rule to catch snake_case in API responses:

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "Property[key.name=/(.*_.*)/]",
        message: "Use camelCase for object keys, not snake_case",
      },
    ],
  },
};
```

---

## Checklist

Migration checklist for each API route:

- [ ] Import `apiSuccess`, `apiError` from `@/lib/apiResponse`
- [ ] Replace `NextResponse.json()` with `apiSuccess()` / `apiError()`
- [ ] Use `parseQueryParams()` for query string parsing
- [ ] Verify all response keys are camelCase
- [ ] Add TypeScript types for response structure
- [ ] Test API responses in Postman/Thunder Client
- [ ] Update frontend code to expect camelCase
- [ ] Update API documentation

---

## Related Fixes

- **Fix 27:** API Client refactoring (uses these utilities)
- **Fix 30:** Consistent camelCase responses (THIS FIX)

---

**Status:** ✅ Utilities Complete, Migration In Progress  
**Priority:** High (affects entire API surface)  
**Risk:** Low (additive change, backward compatible via serialization)  
**Impact:** Major improvement to API consistency and developer experience
