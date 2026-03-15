# Database Backup Quick Reference

## 🚨 Emergency Recovery

### Quick Restore (Production Down)

```bash
# 1. Get latest backup
gsutil cp gs://cmp-backups/daily/$(gsutil ls -l gs://cmp-backups/daily/ | tail -2 | head -1 | awk '{print $3}') latest_backup.dump.gz

# 2. Decompress
gunzip latest_backup.dump.gz

# 3. Stop application
docker-compose down

# 4. Restore database
pg_restore --dbname=cmpdb --clean --if-exists --no-owner --no-acl latest_backup.dump

# 5. Restart application
docker-compose up -d

# 6. Verify
curl http://localhost:3000/api/health
```

**Estimated time:** 2-3 hours

---

## 📅 Scheduled Operations

### Daily (Automated)
✓ Full backup at 2:00 AM UTC  
✓ Retention: 30 days  
✓ Location: `gs://cmp-backups/daily/`

### Hourly (Automated)
✓ WAL file archiving  
✓ Retention: 7 days  
✓ Location: `gs://cmp-backups/wal/`

### Weekly (Automated)
✓ Archive on Sunday 3:00 AM UTC  
✓ Retention: 1 year  
✓ Location: `gs://cmp-backups/weekly/`

---

## 🔧 Manual Operations

### Create Backup

```bash
# Full backup
./scripts/backup-database.sh

# Manual backup (before migrations)
pg_dump -U postgres -d cmpdb -F c -f manual_backup_$(date +%Y%m%d).dump
```

### List Backups

```bash
# Local
ls -lht /var/backups/postgres/daily/

# Cloud (GCS)
gsutil ls -lh gs://cmp-backups/daily/

# Via script
./scripts/restore-database.sh
```

### Restore Backup

```bash
# Interactive (lists available backups)
./scripts/restore-database.sh

# From specific file
./scripts/restore-database.sh backup_20260315_020000.dump.gz

# From cloud
gsutil cp gs://cmp-backups/daily/cmp_backup_20260315.dump.gz .
./scripts/restore-database.sh cmp_backup_20260315.dump.gz
```

### Point-in-Time Recovery (PITR)

```bash
# 1. Restore base backup
pg_restore --dbname=cmpdb latest_backup.dump

# 2. Configure recovery target
cat > /var/lib/postgresql/data/recovery.signal << EOF
restore_command = 'cp /var/backups/postgres/wal/%f %p'
recovery_target_time = '2026-03-15 14:30:00'
recovery_target_action = 'promote'
EOF

# 3. Restart PostgreSQL (will apply WAL files)
sudo systemctl restart postgresql

# 4. Verify recovery point
psql -U postgres -d cmpdb -c "SELECT MAX(\"createdAt\") FROM \"AuditLog\";"
```

---

## 🩺 Health Checks

### Check Backup Status

```bash
# API health check
curl http://localhost:3000/api/health/db-backup | jq

# Expected response
{
  "status": "healthy",
  "lastBackup": "2026-03-15T02:00:00.000Z",
  "hoursSinceBackup": 6.5,
  "backupSize": "125.4 MB"
}
```

### Verify Backup Integrity

```bash
# Test restore to temporary database
./scripts/test-backup-restore.sh
```

### Check WAL Archiving

```bash
# PostgreSQL archiver status
psql -U postgres -c "SELECT * FROM pg_stat_archiver;"

# Expected output:
# archived_count | last_archived_time | failed_count
# 1234           | 2026-03-15 14:30   | 0
```

---

## 📊 Monitoring

### Key Metrics

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Hours since backup | > 12 | > 24 | Investigate backup script |
| Backup size | < 1 MB | < 100 KB | Check database connection |
| Failed count (WAL) | > 0 | > 10 | Check archive_command |
| Disk space | < 20% | < 10% | Clean old backups |

### Log Files

```bash
# Backup logs
tail -f /var/backups/postgres/backup_*.log

# PostgreSQL logs
tail -f /var/log/postgresql/postgresql-14-main.log

# GitHub Actions (for automated backups)
# View in: https://github.com/<org>/<repo>/actions/workflows/database-backup.yml
```

---

## 🧪 Testing

### Monthly Restore Test

```bash
# Run automated test suite
./scripts/test-backup-restore.sh

# Manual test
# 1. Create test database
psql -U postgres -c "CREATE DATABASE cmpdb_test;"

# 2. Restore latest backup
pg_restore --dbname=cmpdb_test latest_backup.dump

# 3. Verify data
psql -U postgres -d cmpdb_test -c "SELECT COUNT(*) FROM \"Task\";"

# 4. Cleanup
psql -U postgres -c "DROP DATABASE cmpdb_test;"
```

---

## ⚙️ Configuration

### Environment Variables

```env
DATABASE_URL="postgresql://user:password@host:5432/cmpdb"
BACKUP_DIR="/var/backups/postgres"
BACKUP_RETENTION_DAYS=30
GCS_BUCKET="cmp-backups"
SLACK_WEBHOOK_URL="https://hooks.slack.com/..."
```

### PostgreSQL WAL Archiving

```bash
# Enable in postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /var/backups/postgres/wal/%f && cp %p /var/backups/postgres/wal/%f'
archive_timeout = 3600  # 1 hour
```

---

## 🔍 Troubleshooting

### Backup Failed

```bash
# Check logs
tail -n 50 /var/backups/postgres/backup_*.log | grep ERROR

# Common fixes
sudo chown -R postgres:postgres /var/backups/postgres
sudo chmod 700 /var/backups/postgres
```

### Restore Failed

```bash
# Use --no-owner if role issues
pg_restore --no-owner --no-acl ...

# Check database exists
psql -U postgres -l | grep cmpdb
```

### Out of Disk Space

```bash
# Clean old backups
find /var/backups/postgres/daily -name "*.dump.gz" -mtime +30 -delete

# Check usage
du -sh /var/backups/postgres/*
```

### WAL Archiving Stalled

```bash
# Check failed count
psql -U postgres -c "SELECT failed_count FROM pg_stat_archiver;"

# Reset failed count (if safe)
psql -U postgres -c "SELECT pg_stat_reset_shared('archiver');"

# Verify directory permissions
ls -la /var/backups/postgres/wal
```

---

## 📞 Emergency Contacts

**Infrastructure Team:** infrastructure@cmp.deriv.com  
**On-Call Engineer:** oncall@cmp.deriv.com  
**Slack Channel:** `#cmp-alerts`

---

## 📚 Full Documentation

- **Complete Guide:** `docs/DATABASE_BACKUP_STRATEGY.md`
- **Fix Details:** `docs/FIX_33_DATABASE_BACKUP.md`
- **Scripts:** `scripts/backup-database.sh`, `scripts/restore-database.sh`

---

## SLOs

- **RTO (Recovery Time Objective):** 4 hours
- **RPO (Recovery Point Objective):** 1 hour
- **Availability Target:** 99.9%

---

**Last Updated:** 2026-03-15  
**Version:** 1.0
