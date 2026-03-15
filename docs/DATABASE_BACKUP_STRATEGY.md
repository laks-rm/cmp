# Database Backup and Disaster Recovery Strategy

## Overview

This document outlines the complete backup, restore, and disaster recovery procedures for the CMP application database.

**Database:** PostgreSQL  
**Primary Location:** Production server  
**Backup Storage:** Google Cloud Storage (GCS) / Local (configurable)  
**Critical Data:** Tasks, Findings, Sources, Audit Logs, User data

---

## Service Level Objectives

### Recovery Time Objective (RTO)
**4 hours** - Maximum acceptable time to restore service after a failure

### Recovery Point Objective (RPO)
**1 hour** - Maximum acceptable data loss (time between backups)

### Availability Target
**99.9% uptime** - Maximum 8.76 hours of downtime per year

---

## Backup Strategy

### 1. Automated Backups

#### Daily Full Backups
- **Schedule:** 2:00 AM UTC daily
- **Type:** Complete database dump
- **Format:** Custom PostgreSQL format (compressed)
- **Retention:** 30 days rolling
- **Location:** `gs://cmp-backups/daily/` or `/var/backups/postgres/daily/`

**Command:**
```bash
pg_dump -U $POSTGRES_USER \
        -d $DATABASE_NAME \
        -F c \
        -f backup_full_$(date +%Y%m%d_%H%M%S).dump \
        --verbose
```

#### Hourly Incremental Backups
- **Schedule:** Every hour (except during full backup)
- **Type:** Incremental (changed data only)
- **Method:** WAL archiving
- **Retention:** 7 days
- **Location:** `gs://cmp-backups/incremental/` or `/var/backups/postgres/wal/`

#### Weekly Archives
- **Schedule:** Sunday 3:00 AM UTC
- **Type:** Full backup + metadata
- **Retention:** 1 year
- **Location:** `gs://cmp-backups/weekly/`

### 2. Backup Verification

**Automated Integrity Checks:**
```bash
# Test restore to temporary database
pg_restore --dbname=postgres --create --verbose \
           backup_full_20260315_020000.dump

# Verify critical tables exist and have data
psql -d postgres -c "SELECT COUNT(*) FROM tasks;"
psql -d postgres -c "SELECT COUNT(*) FROM audit_log;"
```

**Weekly Validation:**
- Restore latest backup to staging environment
- Run automated test suite
- Verify data integrity constraints
- Check audit log completeness

---

## Backup Scripts

### Daily Full Backup Script

**File:** `scripts/backup-database.sh`

```bash
#!/bin/bash
set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres/daily}"
BACKUP_RETENTION_DAYS=30
DATABASE_URL="${DATABASE_URL}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="cmp_backup_${TIMESTAMP}.dump"
LOG_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.log"

# Extract DB credentials from DATABASE_URL
DB_HOST=$(echo $DATABASE_URL | sed -E 's/.*@([^:]+).*/\1/')
DB_PORT=$(echo $DATABASE_URL | sed -E 's/.*:([0-9]+)\/.*/\1/')
DB_NAME=$(echo $DATABASE_URL | sed -E 's/.*\/([^?]+).*/\1/')
DB_USER=$(echo $DATABASE_URL | sed -E 's/.*\/\/([^:]+).*/\1/')

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

echo "=== CMP Database Backup Started: $(date) ===" | tee -a "$LOG_FILE"
echo "Database: $DB_NAME" | tee -a "$LOG_FILE"
echo "Backup file: $BACKUP_FILE" | tee -a "$LOG_FILE"

# Perform backup
PGPASSWORD=$DB_PASSWORD pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -F c \
    -f "${BACKUP_DIR}/${BACKUP_FILE}" \
    --verbose 2>&1 | tee -a "$LOG_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "✓ Backup completed successfully" | tee -a "$LOG_FILE"
    
    # Get backup size
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    echo "Backup size: $BACKUP_SIZE" | tee -a "$LOG_FILE"
    
    # Compress backup (optional)
    gzip "${BACKUP_DIR}/${BACKUP_FILE}"
    echo "✓ Backup compressed" | tee -a "$LOG_FILE"
    
    # Upload to cloud storage (if configured)
    if [ ! -z "$GCS_BUCKET" ]; then
        gsutil cp "${BACKUP_DIR}/${BACKUP_FILE}.gz" \
                  "gs://${GCS_BUCKET}/daily/${BACKUP_FILE}.gz"
        echo "✓ Backup uploaded to GCS" | tee -a "$LOG_FILE"
    fi
    
    # Remove old backups (retention policy)
    find "$BACKUP_DIR" -name "cmp_backup_*.dump.gz" \
         -mtime +$BACKUP_RETENTION_DAYS -delete
    echo "✓ Old backups cleaned up (retention: ${BACKUP_RETENTION_DAYS} days)" | tee -a "$LOG_FILE"
    
    # Send success notification
    curl -X POST "$SLACK_WEBHOOK_URL" \
         -H 'Content-Type: application/json' \
         -d "{\"text\":\"✓ CMP database backup completed: ${BACKUP_SIZE}\"}"
else
    echo "✗ Backup failed!" | tee -a "$LOG_FILE"
    
    # Send failure notification
    curl -X POST "$SLACK_WEBHOOK_URL" \
         -H 'Content-Type: application/json' \
         -d "{\"text\":\"⚠️ CMP database backup FAILED! Check logs immediately.\"}"
    exit 1
fi

echo "=== CMP Database Backup Completed: $(date) ===" | tee -a "$LOG_FILE"
```

**Installation:**
```bash
# Make script executable
chmod +x scripts/backup-database.sh

# Add to crontab for daily execution at 2 AM UTC
crontab -e
# Add line:
0 2 * * * /path/to/scripts/backup-database.sh
```

### Incremental Backup (WAL Archiving)

**PostgreSQL Configuration:**

Add to `postgresql.conf`:
```conf
# WAL archiving
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /var/backups/postgres/wal/%f && cp %p /var/backups/postgres/wal/%f'
archive_timeout = 3600  # 1 hour

# Replication slots (optional, for streaming replication)
max_wal_senders = 3
wal_keep_size = 1GB
```

**WAL Archive Script:**

```bash
#!/bin/bash
# scripts/archive-wal.sh
WAL_FILE=$1
WAL_PATH=$2
ARCHIVE_DIR="/var/backups/postgres/wal"

# Copy to local storage
cp "$WAL_PATH" "${ARCHIVE_DIR}/${WAL_FILE}"

# Upload to cloud storage (if configured)
if [ ! -z "$GCS_BUCKET" ]; then
    gsutil cp "${ARCHIVE_DIR}/${WAL_FILE}" \
              "gs://${GCS_BUCKET}/wal/${WAL_FILE}"
fi
```

---

## Restore Procedures

### Full Restore (Complete Database Recovery)

**Scenario:** Complete database loss or corruption

**Steps:**

1. **Stop application:**
   ```bash
   docker-compose down
   # or
   systemctl stop cmp-app
   ```

2. **Download latest backup:**
   ```bash
   # From GCS
   gsutil cp "gs://cmp-backups/daily/cmp_backup_YYYYMMDD_HHMMSS.dump.gz" .
   gunzip cmp_backup_YYYYMMDD_HHMMSS.dump.gz
   
   # Or use local backup
   cp /var/backups/postgres/daily/cmp_backup_YYYYMMDD_HHMMSS.dump .
   ```

3. **Drop existing database (if needed):**
   ```bash
   psql -U postgres -c "DROP DATABASE IF EXISTS cmpdb;"
   ```

4. **Restore database:**
   ```bash
   # Create new database
   psql -U postgres -c "CREATE DATABASE cmpdb;"
   
   # Restore from backup
   pg_restore --dbname=cmpdb \
              --create \
              --clean \
              --if-exists \
              --verbose \
              --no-owner \
              --no-acl \
              cmp_backup_YYYYMMDD_HHMMSS.dump
   ```

5. **Verify restoration:**
   ```bash
   # Check table counts
   psql -U postgres -d cmpdb -c "\dt"
   psql -U postgres -d cmpdb -c "SELECT COUNT(*) FROM tasks;"
   psql -U postgres -d cmpdb -c "SELECT COUNT(*) FROM \"User\";"
   psql -U postgres -d cmpdb -c "SELECT COUNT(*) FROM \"AuditLog\";"
   
   # Check latest records
   psql -U postgres -d cmpdb -c "SELECT MAX(\"createdAt\") FROM \"AuditLog\";"
   ```

6. **Apply WAL files (if point-in-time recovery needed):**
   ```bash
   # Copy WAL files to pg_wal directory
   cp /var/backups/postgres/wal/* /var/lib/postgresql/data/pg_wal/
   
   # Configure recovery
   cat > /var/lib/postgresql/data/recovery.signal << EOF
restore_command = 'cp /var/backups/postgres/wal/%f %p'
recovery_target_time = '2026-03-15 14:30:00'
EOF
   
   # Start PostgreSQL (will apply WAL files)
   pg_ctl start
   ```

7. **Run Prisma migrations (ensure schema is up to date):**
   ```bash
   cd /path/to/cmp-app
   npx prisma migrate deploy
   ```

8. **Restart application:**
   ```bash
   docker-compose up -d
   # or
   systemctl start cmp-app
   ```

9. **Verify application:**
   ```bash
   curl http://localhost:3000/api/health
   ```

**Estimated Time:** 2-4 hours (depending on database size)

### Point-in-Time Recovery (PITR)

**Scenario:** Need to restore database to specific point in time (e.g., before data corruption)

**Steps:**

1. Restore latest full backup (as above)
2. Configure recovery target:
   ```bash
   cat > /var/lib/postgresql/data/recovery.signal << EOF
restore_command = 'cp /var/backups/postgres/wal/%f %p'
recovery_target_time = '2026-03-15 14:30:00'  # Specify target time
recovery_target_action = 'promote'
EOF
   ```
3. Start PostgreSQL and let it apply WAL logs up to target time
4. Verify and restart application

### Partial Restore (Single Table Recovery)

**Scenario:** Accidental deletion of specific data

**Steps:**

```bash
# 1. Restore backup to temporary database
pg_restore --dbname=postgres \
           --create \
           --schema=temp_restore \
           cmp_backup_YYYYMMDD_HHMMSS.dump

# 2. Export specific table data
pg_dump -U postgres \
        -d postgres \
        -t temp_restore.tasks \
        --data-only \
        --column-inserts \
        > tasks_recovery.sql

# 3. Review and import to production
psql -U postgres -d cmpdb < tasks_recovery.sql

# 4. Clean up
psql -U postgres -c "DROP SCHEMA temp_restore CASCADE;"
```

---

## Manual Backup Procedures

### Quick Manual Backup

**When to use:** Before major migrations, deployments, or manual operations

```bash
# Full backup
pg_dump -U postgres \
        -d cmpdb \
        -F c \
        -f "manual_backup_$(date +%Y%m%d_%H%M%S).dump"

# Plain SQL format (more portable)
pg_dump -U postgres \
        -d cmpdb \
        > "manual_backup_$(date +%Y%m%d_%H%M%S).sql"
```

### Backup Specific Tables

```bash
# Backup critical audit logs
pg_dump -U postgres \
        -d cmpdb \
        -t '"AuditLog"' \
        > audit_log_backup.sql

# Backup all tasks
pg_dump -U postgres \
        -d cmpdb \
        -t '"Task"' \
        --data-only \
        > tasks_backup.sql
```

### Export for Migration/Archive

```bash
# Export with schema and data
pg_dump -U postgres \
        -d cmpdb \
        --clean \
        --if-exists \
        --create \
        > complete_export_$(date +%Y%m%d).sql

# Compress for storage
gzip complete_export_$(date +%Y%m%d).sql
```

---

## Cloud Storage Configuration

### Google Cloud Storage (GCS)

**Setup:**

1. **Create GCS bucket:**
   ```bash
   gsutil mb -l us-central1 -c STANDARD gs://cmp-backups
   ```

2. **Configure lifecycle policy:**
   ```bash
   cat > lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 30,
          "matchesPrefix": ["daily/"]
        }
      },
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 365,
          "matchesPrefix": ["weekly/"]
        }
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
        "condition": {
          "age": 90,
          "matchesPrefix": ["weekly/"]
        }
      }
    ]
  }
}
EOF

   gsutil lifecycle set lifecycle.json gs://cmp-backups
   ```

3. **Set permissions:**
   ```bash
   # Grant backup service account write access
   gsutil iam ch serviceAccount:backup@project.iam.gserviceaccount.com:objectCreator \
          gs://cmp-backups
   ```

### AWS S3 (Alternative)

```bash
# Upload to S3
aws s3 cp backup_full_20260315.dump.gz \
         s3://cmp-backups/daily/ \
         --storage-class STANDARD_IA

# Lifecycle policy
aws s3api put-bucket-lifecycle-configuration \
    --bucket cmp-backups \
    --lifecycle-configuration file://s3-lifecycle.json
```

---

## Disaster Recovery Scenarios

### Scenario 1: Database Server Failure

**RTO:** 4 hours  
**RPO:** 1 hour

**Steps:**
1. Provision new database server (30 mins)
2. Install PostgreSQL (15 mins)
3. Restore latest full backup (2 hours)
4. Apply WAL files for PITR (30 mins)
5. Update application connection string (15 mins)
6. Verify and test (30 mins)

### Scenario 2: Data Corruption

**RTO:** 2 hours  
**RPO:** 0-1 hour

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
4. Export deleted records (5 mins)

### Scenario 4: Complete Infrastructure Loss

**RTO:** 8 hours  
**RPO:** 1 hour

**Steps:**
1. Provision new infrastructure (2 hours)
2. Restore database from GCS (3 hours)
3. Deploy application (2 hours)
4. Verify and test (1 hour)

---

## Monitoring and Alerts

### Backup Success Monitoring

**Metrics to Track:**
- Backup completion status
- Backup duration
- Backup file size
- Time since last successful backup

**Alerts:**
```yaml
# Prometheus alerts
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

### Health Check Endpoint

**Add to API:**

```typescript
// src/app/api/health/db-backup/route.ts
export async function GET() {
  try {
    // Check last backup timestamp
    const lastBackupFile = await getLastBackupInfo();
    const hoursSinceBackup = (Date.now() - lastBackupFile.timestamp) / 3600000;
    
    return NextResponse.json({
      status: hoursSinceBackup < 24 ? "healthy" : "warning",
      lastBackup: lastBackupFile.timestamp,
      hoursSinceBackup,
      backupSize: lastBackupFile.size,
      location: lastBackupFile.location,
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: "Cannot verify backup status" },
      { status: 500 }
    );
  }
}
```

---

## Testing Backup/Restore

### Monthly Restore Test

**Schedule:** First Sunday of every month

**Procedure:**
```bash
# 1. Create test environment
docker-compose -f docker-compose.test.yml up -d postgres

# 2. Restore latest backup
./scripts/test-restore.sh

# 3. Run automated tests
npm run test:integration

# 4. Verify data integrity
npm run test:data-integrity

# 5. Document results
echo "$(date): Restore test passed" >> restore-test-log.txt

# 6. Clean up
docker-compose -f docker-compose.test.yml down
```

---

## Environment Variables

```env
# .env
DATABASE_URL="postgresql://user:password@localhost:5432/cmpdb"
BACKUP_DIR="/var/backups/postgres"
BACKUP_RETENTION_DAYS=30
GCS_BUCKET="cmp-backups"
SLACK_WEBHOOK_URL="https://hooks.slack.com/..."
```

---

## Checklist

### Daily
- [ ] Verify automated backup completed
- [ ] Check backup size is reasonable
- [ ] Verify upload to cloud storage

### Weekly
- [ ] Review backup logs
- [ ] Verify weekly archive created
- [ ] Check disk space on backup storage

### Monthly
- [ ] Perform restore test
- [ ] Review and update procedures
- [ ] Verify retention policies working

### Quarterly
- [ ] Full disaster recovery drill
- [ ] Review RTO/RPO compliance
- [ ] Update documentation

---

## Troubleshooting

### Backup Fails with "Permission Denied"

```bash
# Fix permissions
chown -R postgres:postgres /var/backups/postgres
chmod 700 /var/backups/postgres
```

### Restore Fails with "Role does not exist"

```bash
# Use --no-owner flag
pg_restore --no-owner --no-acl ...
```

### Out of Disk Space

```bash
# Clean old backups manually
find /var/backups/postgres -name "*.dump" -mtime +30 -delete
```

### WAL Files Not Archiving

```bash
# Check archive_command
psql -c "SHOW archive_command;"

# Check archive directory permissions
ls -la /var/backups/postgres/wal
```

---

## References

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [Prisma Backup Best Practices](https://www.prisma.io/docs/guides/database/backup-restore)
- [GCS Lifecycle Management](https://cloud.google.com/storage/docs/lifecycle)

---

**Last Updated:** 2026-03-15  
**Next Review:** 2026-06-15  
**Owner:** Infrastructure Team  
**Emergency Contact:** oncall@cmp.deriv.com
