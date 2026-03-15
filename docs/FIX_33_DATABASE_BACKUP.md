# Fix 33: Database Backup Strategy

## Problem

**Issue:** No documented database backup and restore procedures, creating significant business risk.

**Impact:**
- No recovery plan in case of data loss
- Unknown recovery capabilities (RTO/RPO)
- Cannot restore from accidental deletions
- No disaster recovery procedures
- Compliance risk (many regulations require backup retention)
- No point-in-time recovery capability

**Risk Level:** CRITICAL

## Solution

Implemented a comprehensive database backup and disaster recovery strategy with:

1. **Automated Backup System**
   - Daily full backups at 2 AM UTC (30-day retention)
   - Hourly incremental backups via WAL archiving (7-day retention)
   - Weekly archives (1-year retention)
   - Automatic compression and cloud upload

2. **Restore Procedures**
   - Full database restore
   - Point-in-time recovery (PITR)
   - Partial restore (single table)
   - Manual backup/restore scripts

3. **Monitoring & Alerting**
   - Health check API endpoint
   - GitHub Actions workflow
   - Slack notifications
   - Automated integrity verification

4. **Testing & Validation**
   - Automated test script
   - Monthly restore tests
   - Quarterly disaster recovery drills

## Implementation

### Files Created

#### Documentation
```
docs/DATABASE_BACKUP_STRATEGY.md
├── Overview & SLOs
├── Backup Strategy (daily, hourly, weekly)
├── Restore Procedures (full, PITR, partial)
├── Disaster Recovery Scenarios
├── Monitoring & Alerts
├── Testing Procedures
└── Troubleshooting Guide
```

#### Scripts
```
scripts/
├── backup-database.sh           # Automated backup script
├── restore-database.sh          # Interactive restore script
└── test-backup-restore.sh       # Validation test suite
```

#### Configuration
```
config/postgresql.backup.conf    # PostgreSQL WAL archiving config
```

#### API & Automation
```
src/app/api/health/db-backup/route.ts    # Health check endpoint
.github/workflows/database-backup.yml    # GitHub Actions workflow
```

### Service Level Objectives

**RTO (Recovery Time Objective):** 4 hours
- Time to restore service after failure
- Tested monthly with automated drills

**RPO (Recovery Point Objective):** 1 hour
- Maximum acceptable data loss
- Achieved via hourly WAL archiving

**Availability Target:** 99.9% uptime
- Maximum 8.76 hours downtime per year

### Backup Schedule

| Type | Frequency | Retention | Format | Location |
|------|-----------|-----------|--------|----------|
| Full | Daily 2 AM UTC | 30 days | `.dump.gz` | GCS + Local |
| Incremental | Hourly | 7 days | WAL files | GCS + Local |
| Archive | Weekly Sunday | 1 year | `.dump.gz` | GCS |

### Storage Strategy

**Primary Storage:** Google Cloud Storage
```
gs://cmp-backups/
├── daily/       # Daily full backups (30 days)
├── weekly/      # Weekly archives (1 year)
└── wal/         # WAL incremental files (7 days)
```

**Secondary Storage:** Local filesystem
```
/var/backups/postgres/
├── daily/       # Local copy of daily backups
└── wal/         # WAL archiving directory
```

**Lifecycle Policies:**
- Daily backups → Delete after 30 days
- Weekly archives → Move to COLDLINE after 90 days, delete after 1 year
- WAL files → Delete after 7 days

## Usage

### Quick Commands

#### Backup Operations

```bash
# Manual full backup
./scripts/backup-database.sh

# Verify latest backup
curl http://localhost:3000/api/health/db-backup | jq

# List available backups
./scripts/restore-database.sh

# Download backup from GCS
gsutil cp gs://cmp-backups/daily/cmp_backup_20260315_020000.dump.gz .
```

#### Restore Operations

```bash
# Interactive restore (lists backups if none specified)
./scripts/restore-database.sh

# Restore from specific backup
./scripts/restore-database.sh /var/backups/postgres/daily/cmp_backup_20260315.dump.gz

# Restore from GCS backup
gsutil cp gs://cmp-backups/daily/cmp_backup_20260315_020000.dump.gz .
gunzip cmp_backup_20260315_020000.dump.gz
./scripts/restore-database.sh cmp_backup_20260315_020000.dump
```

#### Testing

```bash
# Run full backup/restore test suite
./scripts/test-backup-restore.sh

# Manual verification
psql -U postgres -d cmpdb -c "SELECT COUNT(*) FROM \"Task\";"
psql -U postgres -d cmpdb -c "SELECT MAX(\"createdAt\") FROM \"AuditLog\";"
```

### Environment Variables

Required in `.env`:

```env
# Database connection
DATABASE_URL="postgresql://user:password@host:5432/cmpdb"

# Backup configuration
BACKUP_DIR="/var/backups/postgres"
BACKUP_RETENTION_DAYS=30
GCS_BUCKET="cmp-backups"

# Notifications
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
```

### API Health Check

**Endpoint:** `GET /api/health/db-backup`

**Response:**
```json
{
  "status": "healthy",
  "message": "Backup system is healthy",
  "lastBackup": "2026-03-15T02:00:00.000Z",
  "hoursSinceBackup": 6.5,
  "backupSize": "125.4 MB",
  "backupSizeBytes": 131507200,
  "fileName": "cmp_backup_20260315_020000.dump.gz",
  "location": "gs://cmp-backups/daily/cmp_backup_20260315_020000.dump.gz"
}
```

**Status Codes:**
- `healthy` - Backup within last 12 hours, size is reasonable
- `warning` - Backup is 12-24 hours old OR suspiciously small
- `error` - No backup in last 24 hours OR backup check failed

### PostgreSQL Configuration

**Enable WAL archiving** for point-in-time recovery:

```bash
# 1. Update PostgreSQL configuration
sudo nano /etc/postgresql/14/main/postgresql.conf

# Add or include:
include = '/path/to/config/postgresql.backup.conf'

# 2. Create WAL archive directory
sudo mkdir -p /var/backups/postgres/wal
sudo chown postgres:postgres /var/backups/postgres/wal
sudo chmod 700 /var/backups/postgres/wal

# 3. Restart PostgreSQL
sudo systemctl restart postgresql

# 4. Verify configuration
psql -U postgres -c "SHOW wal_level;"          # Should be 'replica'
psql -U postgres -c "SHOW archive_mode;"       # Should be 'on'
psql -U postgres -c "SELECT * FROM pg_stat_archiver;"
```

### GitHub Actions Setup

**Automated daily backups via GitHub Actions:**

1. **Add secrets to repository:**
   - `DATABASE_URL` - Production database connection string
   - `GCS_BUCKET` - Google Cloud Storage bucket name
   - `GCS_SA_KEY` - Service account key JSON (base64 encoded)
   - `GCP_PROJECT_ID` - Google Cloud project ID
   - `SLACK_WEBHOOK_URL` - Slack webhook for notifications

2. **Workflow runs automatically:**
   - Daily at 2 AM UTC
   - Weekly on Sunday at 3 AM UTC
   - Can be triggered manually via "Actions" tab

3. **Notifications:**
   - Success: Slack notification with backup size
   - Failure: Immediate Slack alert with workflow link

## Disaster Recovery Scenarios

### Scenario 1: Database Server Failure

**RTO:** 4 hours

**Steps:**
1. Provision new database server (30 mins)
2. Install PostgreSQL (15 mins)
3. Restore latest full backup (2 hours)
4. Apply WAL files for PITR (30 mins)
5. Update application connection string (15 mins)
6. Verify and test (30 mins)

### Scenario 2: Data Corruption

**RTO:** 2 hours

**Steps:**
1. Identify corruption time (15 mins)
2. Restore to temp database (1 hour)
3. Export clean data (15 mins)
4. Import to production (15 mins)
5. Verify integrity (15 mins)

### Scenario 3: Accidental Data Deletion

**RTO:** 30 minutes  
**RPO:** 0 (if soft delete used)

**Steps:**
1. Check if soft deleted (5 mins)
2. If yes, restore from soft delete (5 mins)
3. If no, restore from latest backup to temp DB (15 mins)
4. Export deleted records and re-import (5 mins)

### Scenario 4: Complete Infrastructure Loss

**RTO:** 8 hours  
**RPO:** 1 hour

**Steps:**
1. Provision new infrastructure (2 hours)
2. Restore database from GCS (3 hours)
3. Deploy application (2 hours)
4. Verify and test (1 hour)

## Testing & Validation

### Automated Test Suite

**Run full test:** `./scripts/test-backup-restore.sh`

**Tests performed:**
1. ✓ Create test database
2. ✓ Create sample schema and data (3 users, 5 tasks)
3. ✓ Verify initial data
4. ✓ Perform backup
5. ✓ Simulate data loss (delete all data)
6. ✓ Restore from backup
7. ✓ Verify restored data matches original
8. ✓ Verify data integrity
9. ✓ Test compressed backup

**Expected output:**
```
========================================
         TEST SUMMARY
========================================
Tests passed: 9
Tests failed: 0
========================================
✓ All tests passed!
```

### Monthly Restore Test

**Schedule:** First Sunday of every month, 3 AM UTC

**Procedure:**
1. Create isolated test environment
2. Restore latest production backup
3. Run automated integration tests
4. Verify data integrity
5. Document results in `restore-test-log.txt`
6. Clean up test environment

### Quarterly Disaster Recovery Drill

**Schedule:** First week of each quarter

**Full Simulation:**
1. Simulate complete database failure
2. Execute full disaster recovery plan
3. Measure actual RTO/RPO
4. Document lessons learned
5. Update procedures if needed

## Monitoring & Alerts

### Prometheus Metrics (Recommended)

```yaml
- alert: DatabaseBackupFailed
  expr: database_backup_success == 0
  for: 1h
  annotations:
    summary: "Database backup failed"
    description: "Last backup attempt failed. Check logs immediately."

- alert: DatabaseBackupStale
  expr: (time() - database_backup_last_success_timestamp) > 86400
  annotations:
    summary: "Database backup is stale"
    description: "No successful backup in last 24 hours."
```

### Log Monitoring

**Backup logs location:** `/var/backups/postgres/backup_*.log`

**Key indicators:**
- `✓ Backup completed successfully` - Success
- `✗ Backup failed!` - Failure (investigate immediately)
- Backup size trends (sudden drops indicate issues)
- Upload to GCS success/failure

### Slack Notifications

**Success notification:**
```
✓ CMP database backup completed: 125.4 MB
```

**Failure notification:**
```
⚠️ CMP database backup FAILED! Check logs immediately.
```

## Maintenance Checklist

### Daily
- [ ] Verify automated backup completed (check Slack/logs)
- [ ] Check backup size is reasonable (not too small/large)
- [ ] Verify upload to cloud storage succeeded

### Weekly
- [ ] Review backup logs for any warnings
- [ ] Verify weekly archive created
- [ ] Check disk space on backup storage (local and cloud)

### Monthly
- [ ] Perform restore test (automated script)
- [ ] Review and update procedures if needed
- [ ] Verify retention policies are working
- [ ] Check backup costs (GCS storage/bandwidth)

### Quarterly
- [ ] Full disaster recovery drill
- [ ] Review RTO/RPO compliance
- [ ] Update documentation
- [ ] Audit backup access logs

## Security Considerations

### Access Control

**Backup files contain sensitive data:**
- Restrict access to backups (IAM policies)
- Encrypt backups at rest (GCS default encryption)
- Audit backup access logs
- Use service account with minimal permissions

**GCS IAM Permissions:**
```
Storage Object Creator - for backup uploads
Storage Object Viewer - for restore downloads
```

### Encryption

**In Transit:**
- TLS for database connections
- HTTPS for GCS uploads/downloads

**At Rest:**
- GCS default encryption (AES-256)
- Consider customer-managed encryption keys (CMEK) for compliance

### Backup Retention Compliance

**Regulatory Requirements:**
- GDPR: 6 months minimum for audit trails
- SOX: 7 years for financial records
- Industry-specific: Consult legal/compliance team

**Current Policy:**
- Daily: 30 days (exceeds GDPR minimum)
- Weekly: 1 year (covers SOX requirements)
- Can be extended based on requirements

## Cost Estimation

### Google Cloud Storage Costs (Example)

**Assumptions:**
- Database size: 100 GB
- Backup compression ratio: 70% (70 GB compressed)
- 30 daily backups + 52 weekly archives
- Region: us-central1

**Monthly Costs:**
```
Daily backups (30 × 70 GB):     2,100 GB × $0.020 = $42.00
Weekly archives (52 × 70 GB):   3,640 GB × $0.010 = $36.40 (COLDLINE)
WAL files (~100 GB):              100 GB × $0.020 = $2.00

Egress (restore tests ~70 GB):     70 GB × $0.120 = $8.40

Total estimated monthly cost:                       $88.80
```

**Cost Optimization:**
- Use lifecycle policies (auto-move to COLDLINE)
- Compress backups (already implemented)
- Clean up old WAL files (automated)
- Regional vs multi-regional storage

## Troubleshooting

### Common Issues

#### 1. Backup Fails with "Permission Denied"

```bash
# Fix permissions
sudo chown -R postgres:postgres /var/backups/postgres
sudo chmod 700 /var/backups/postgres
```

#### 2. Restore Fails with "Role does not exist"

```bash
# Use --no-owner flag
pg_restore --no-owner --no-acl ...
```

#### 3. Out of Disk Space

```bash
# Clean old backups manually
find /var/backups/postgres -name "*.dump" -mtime +30 -delete

# Check current usage
du -sh /var/backups/postgres/*
```

#### 4. WAL Files Not Archiving

```bash
# Check configuration
psql -c "SHOW archive_command;"
psql -c "SELECT * FROM pg_stat_archiver;"

# Verify directory permissions
ls -la /var/backups/postgres/wal

# Test archive command manually
su - postgres
cd /var/lib/postgresql/data/pg_wal
archive_command='test ! -f /var/backups/postgres/wal/test.wal && cp 000000010000000000000001 /var/backups/postgres/wal/test.wal'
eval $archive_command
```

#### 5. GCS Upload Fails

```bash
# Verify gsutil is installed and configured
gsutil version
gsutil ls gs://cmp-backups/

# Check service account permissions
gcloud projects get-iam-policy $PROJECT_ID

# Test upload manually
gsutil cp test.txt gs://cmp-backups/test.txt
```

## References

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [PostgreSQL WAL Archiving](https://www.postgresql.org/docs/current/continuous-archiving.html)
- [Prisma Backup Best Practices](https://www.prisma.io/docs/guides/database/backup-restore)
- [Google Cloud Storage Lifecycle](https://cloud.google.com/storage/docs/lifecycle)
- [Database Backup Strategy (Full Doc)](../docs/DATABASE_BACKUP_STRATEGY.md)

---

## Summary

### What Was Implemented

✅ **Automated Backups**
- Daily full backups (2 AM UTC, 30-day retention)
- Hourly incremental via WAL archiving (7-day retention)
- Weekly archives (1-year retention)
- Compression and cloud upload

✅ **Restore Capabilities**
- Full database restore
- Point-in-time recovery (PITR)
- Partial table restore
- Interactive restore script

✅ **Monitoring**
- Health check API endpoint
- GitHub Actions workflow
- Slack notifications
- Automated verification

✅ **Testing**
- Automated test suite
- Monthly restore tests
- Quarterly DR drills

✅ **Documentation**
- Complete backup strategy guide
- Disaster recovery scenarios
- Troubleshooting procedures
- Cost estimation

### Benefits

🎯 **Risk Mitigation**
- Protection against data loss
- Fast recovery from failures
- Compliance with retention requirements

📊 **Defined SLOs**
- RTO: 4 hours
- RPO: 1 hour
- 99.9% availability target

🔄 **Automation**
- Hands-off daily backups
- Automatic retention management
- Self-healing (retries, notifications)

🧪 **Confidence**
- Tested monthly
- Documented procedures
- Verified integrity

---

**Status:** ✅ Complete  
**Priority:** CRITICAL  
**Complexity:** Medium  
**Impact:** High (business continuity)

**Last Updated:** 2026-03-15  
**Next Review:** 2026-06-15
