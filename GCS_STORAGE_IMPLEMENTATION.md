# GCS Storage Integration - Implementation Summary

## Overview

Successfully implemented Google Cloud Storage (GCS) integration for evidence files in the CMP application. The implementation allows switching between local file storage and GCS via environment variables, with full backward compatibility.

## Changes Made

### 1. Storage Service (`src/lib/storage.ts`)

**Added:**
- `getSignedUrl()` method to the `StorageService` interface
- Full implementation of `GCSStorageService` class with:
  - `upload()` - Uploads files to GCS with organized path structure
  - `download()` - Downloads files from GCS
  - `delete()` - Deletes files from GCS (gracefully handles 404 errors)
  - `getSignedUrl()` - Generates time-limited signed URLs for file access

**File Path Structure:**
Files are organized in GCS as: `evidence/{year}/{month}/{uuid}-{sanitized-filename}`
Example: `evidence/2026/03/a1b2c3d4-5678-90ab-cdef-1234567890ab-Annual_Review.pdf`

**LocalStorageService:**
- Added `getSignedUrl()` method that returns the original `/api/files/` URL
- No other changes needed - maintains full backward compatibility

### 2. Environment Configuration (`.env.example`)

Added GCS configuration variables:
```env
# Storage Provider: "local" or "gcs"
STORAGE_PROVIDER="local"

# GCS Configuration (required when STORAGE_PROVIDER=gcs)
GCP_PROJECT_ID=""
GCS_BUCKET_NAME=""
# For local development only — on GCP VM, Application Default Credentials are used automatically
# GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

### 3. New API Route (`src/app/api/evidence/[id]/download/route.ts`)

Created a new endpoint that:
- Authenticates the user
- Verifies entity-level access to the evidence
- Returns the appropriate URL:
  - For local storage: returns the `/api/files/[id]` URL directly
  - For GCS storage: generates and returns a signed URL with 15-minute expiration

### 4. Frontend Components Updated

Updated all evidence handling components to use the new download API:

**Files modified:**
- `src/components/tasks/TaskWorkArea.tsx`
- `src/components/findings/FindingPageClient.tsx`
- `src/components/findings/FindingDetailModal.tsx`
- `src/components/tasks/TaskDetailModal.tsx`

**Changes:**
- `handleDownloadEvidence()` - Now fetches signed URL from API before downloading
- `handleOpenEvidence()` - Now fetches signed URL from API before opening in new tab
- Both functions handle errors gracefully with toast notifications

## Security Features

1. **Input Validation:** Uses existing `validateUploadMeta()` and `sanitizeFileName()` helpers
2. **Authentication:** All operations require authenticated session
3. **Authorization:** Entity-level access control on all evidence operations
4. **Signed URLs:** Time-limited (15 minutes default) for GCS files
5. **Error Handling:** Graceful handling of missing files, expired URLs, and GCS errors

## Authentication Methods

### GCP VM (Production)
Uses Application Default Credentials automatically - no key file needed. The VM's service account provides authentication.

### Local Development
Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable pointing to a service account key JSON file.

## Testing Guide

### 1. Test with Local Storage (Default)

```bash
cd cmp-app
# Ensure STORAGE_PROVIDER=local in .env
npm run dev
```

**Test cases:**
- Upload evidence file to a task
- View evidence file (should open in new tab via `/api/files/` URL)
- Download evidence file
- Delete evidence file
- All should work as before

### 2. Test with GCS Storage

**Prerequisites:**
1. Create a GCS bucket (e.g., `cmp-evidence-deriv`)
2. Grant service account `Storage Object Admin` role
3. For local dev: Create and download service account key

**Configuration:**
```bash
# In .env
STORAGE_PROVIDER=gcs
GCP_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=cmp-evidence-deriv
# For local dev only:
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

**Test cases:**
1. **Upload Test:**
   - Upload a file to a task or finding
   - Check GCS bucket: file should appear at `evidence/2026/03/{uuid}-{filename}`
   - Verify in database: `fileUrl` should contain the GCS path (not `/api/files/`)

2. **Download Test:**
   - Click "Download" button on evidence
   - Should download successfully via signed URL
   - File contents should match original

3. **View Test:**
   - Click "View" button on evidence (for PDFs/images)
   - Should open in new tab via signed URL
   - File should display correctly

4. **Delete Test:**
   - Delete evidence from task/finding
   - Check GCS bucket: file should be removed
   - Check database: evidence record should be deleted

5. **Signed URL Expiration Test:**
   - Get a signed URL for a file
   - Wait 15+ minutes
   - Try accessing the URL
   - Should receive 403 Forbidden error

6. **Error Handling Tests:**
   - Upload with missing GCS credentials (should show clear error)
   - Try to access non-existent file (should handle gracefully)
   - Delete already-deleted file (should log warning, not crash)

### 3. Build Test

```bash
cd cmp-app
npm run build
```

Should complete without TypeScript or linting errors.

## Migration Path

### From Local to GCS

1. Set up GCS bucket and service account
2. Add GCS env vars to `.env`
3. Change `STORAGE_PROVIDER=gcs`
4. Restart the application
5. New uploads go to GCS automatically
6. Old files in `./uploads/` remain accessible via local storage

**Note:** Existing evidence records with `/api/files/` URLs continue to work via the old route. New uploads get GCS paths and use signed URLs.

### Mixed Environment

The system supports both storage types simultaneously:
- Old evidence: served via `/api/files/[id]` (local storage)
- New evidence: served via signed URLs (GCS)
- The download API handles both cases transparently

## File Organization in GCS

```
bucket-name/
  evidence/
    2026/
      01/
        uuid1-Annual_Report.pdf
        uuid2-Compliance_Document.xlsx
      02/
        uuid3-Risk_Assessment.docx
      03/
        uuid4-Audit_Evidence.pdf
```

Benefits:
- Easy browsing in GCS console
- Date-based lifecycle policies
- Natural organization by time period

## Troubleshooting

### Error: "GCS configuration missing"
- Check `GCP_PROJECT_ID` and `GCS_BUCKET_NAME` are set in `.env`
- Verify environment variables are loaded

### Error: "Failed to upload file to GCS"
- Check service account has `Storage Object Admin` role
- Verify bucket exists and is accessible
- For local dev: check `GOOGLE_APPLICATION_CREDENTIALS` path is correct

### Error: "Failed to generate signed URL"
- Check service account has permission to sign URLs
- Verify bucket name is correct
- Check file exists in GCS

### Files not appearing in GCS
- Check `STORAGE_PROVIDER=gcs` is set
- Verify upload operation completed without errors
- Check application logs for GCS upload errors

## Performance Considerations

1. **Upload:** Direct to GCS, no local buffering
2. **Download:** Signed URLs allow direct browser-to-GCS connection (no app server proxy)
3. **Signed URL Cache:** Consider caching signed URLs for 5-10 minutes to reduce API calls
4. **Large Files:** GCS handles large files efficiently; signed URLs work for files up to 5TB

## Next Steps

Optional enhancements (not implemented):
1. Signed URL caching to reduce API calls
2. Configurable signed URL expiration time
3. Batch delete for cleanup operations
4. Migration script to move existing local files to GCS
5. Lifecycle policies for automatic file deletion/archiving
6. GCS object versioning for evidence audit trail

## Package Dependencies

Already installed:
- `@google-cloud/storage` version 7.19.0

No additional dependencies required.

## Files Changed

1. `cmp-app/src/lib/storage.ts` - Core storage service implementation
2. `cmp-app/.env.example` - Environment configuration
3. `cmp-app/src/app/api/evidence/[id]/download/route.ts` - New download API (created)
4. `cmp-app/src/components/tasks/TaskWorkArea.tsx` - Frontend evidence handling
5. `cmp-app/src/components/findings/FindingPageClient.tsx` - Frontend evidence handling
6. `cmp-app/src/components/findings/FindingDetailModal.tsx` - Frontend evidence handling
7. `cmp-app/src/components/tasks/TaskDetailModal.tsx` - Frontend evidence handling

## No Changes Needed

- `src/app/api/evidence/route.ts` - Already uses factory pattern
- `src/app/api/files/[id]/route.ts` - Still serves local files
- `src/lib/validation.ts` - Validation logic unchanged
- Prisma schema - No database changes required
- Other pages and components - No changes needed
