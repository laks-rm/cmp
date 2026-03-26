# GCS Storage - Quick Start Guide

## Switch to Local Storage (Default)

```bash
# In cmp-app/.env
STORAGE_PROVIDER="local"
```

That's it! Files will be stored in `./uploads/` directory.

## Switch to GCS Storage

### 1. Prerequisites
- GCS bucket created (e.g., `cmp-evidence-deriv`)
- Service account with `Storage Object Admin` role

### 2. For Local Development

```bash
# In cmp-app/.env
STORAGE_PROVIDER="gcs"
GCP_PROJECT_ID="your-project-id"
GCS_BUCKET_NAME="cmp-evidence-deriv"
GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

### 3. For GCP VM (Production)

```bash
# In cmp-app/.env
STORAGE_PROVIDER="gcs"
GCP_PROJECT_ID="your-project-id"
GCS_BUCKET_NAME="cmp-evidence-deriv"
# No GOOGLE_APPLICATION_CREDENTIALS needed - uses VM's service account
```

### 4. Restart Application

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Quick Test

1. Login to the application
2. Go to any task
3. Upload an evidence file (PDF, image, or document)
4. Click "View" or "Download"
5. File should open/download successfully

### For GCS: Verify in Bucket

```bash
gsutil ls gs://cmp-evidence-deriv/evidence/
```

You should see files organized like:
```
gs://cmp-evidence-deriv/evidence/2026/03/uuid-filename.pdf
```

## Troubleshooting

### "GCS configuration missing"
→ Check `GCP_PROJECT_ID` and `GCS_BUCKET_NAME` are set in `.env`

### "Failed to upload file to GCS"
→ Check service account permissions
→ For local dev: verify `GOOGLE_APPLICATION_CREDENTIALS` path

### Files not appearing in GCS
→ Verify `STORAGE_PROVIDER=gcs` (not "local")
→ Check application logs for errors

## File Path Structure

Files in GCS follow this pattern:
```
evidence/{YEAR}/{MONTH}/{UUID}-{filename}
```

Example:
```
evidence/2026/03/a1b2c3d4-5678-90ab-cdef-1234567890ab-Annual_Report.pdf
```

## Signed URL Behavior

- **Expiration:** 15 minutes (default)
- **Direct access:** Browser connects directly to GCS, not through app server
- **Security:** Time-limited, automatically expires

## Switching Between Providers

You can switch between providers at any time:

1. **Local → GCS:** Old files remain in `./uploads/`, new files go to GCS
2. **GCS → Local:** Old files remain in GCS (still accessible), new files go to `./uploads/`

Both types of files work simultaneously - the system automatically detects which storage method to use based on the file URL.

## Performance Notes

- **Upload:** ~Same speed (network bound)
- **Download:** GCS signed URLs are faster (direct browser-to-GCS)
- **Scalability:** GCS handles unlimited files, local storage limited by disk

## Cost Considerations

GCS pricing (approximate):
- Storage: $0.02/GB/month (Standard class)
- Operations: ~$0.005 per 10,000 operations
- Egress: $0.12/GB (to internet)

For typical usage (~1000 files/month, 100MB average):
- Storage: ~$2/month
- Operations: ~$0.50/month
- Total: ~$2.50/month

Local storage is free but limited by VM disk space.

## Next Steps

Once basic testing works:

1. Set up lifecycle policies (optional - auto-delete old files)
2. Configure bucket versioning (optional - audit trail)
3. Set up monitoring/alerts (optional - track usage)
4. Plan migration of existing local files (optional)

For help, see `GCS_STORAGE_IMPLEMENTATION.md` for detailed documentation.
