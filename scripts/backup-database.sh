#!/bin/bash
#
# CMP Database Backup Script
#
# This script performs automated backups of the CMP PostgreSQL database
# with optional cloud storage upload and notification.
#
# Usage: ./backup-database.sh
#
# Environment variables required:
# - DATABASE_URL: PostgreSQL connection string
# - BACKUP_DIR (optional): Backup directory (default: /var/backups/postgres/daily)
# - GCS_BUCKET (optional): Google Cloud Storage bucket name
# - SLACK_WEBHOOK_URL (optional): Slack webhook for notifications
#

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres/daily}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="cmp_backup_${TIMESTAMP}.dump"
LOG_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

send_notification() {
    local message=$1
    local status=$2  # "success" or "error"
    
    if [ ! -z "${SLACK_WEBHOOK_URL:-}" ]; then
        local icon="✓"
        [ "$status" = "error" ] && icon="⚠️"
        
        curl -X POST "$SLACK_WEBHOOK_URL" \
             -H 'Content-Type: application/json' \
             -d "{\"text\":\"${icon} ${message}\"}" \
             --silent --show-error || true
    fi
}

cleanup() {
    log "Cleaning up old backups (retention: ${BACKUP_RETENTION_DAYS} days)..."
    find "$BACKUP_DIR" -name "cmp_backup_*.dump.gz" \
         -mtime +$BACKUP_RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "backup_*.log" \
         -mtime +$BACKUP_RETENTION_DAYS -delete
}

# Main execution
main() {
    log "=== CMP Database Backup Started ==="
    
    # Validate environment
    if [ -z "${DATABASE_URL:-}" ]; then
        error "DATABASE_URL environment variable is not set"
        send_notification "CMP database backup FAILED: DATABASE_URL not set" "error"
        exit 1
    fi
    
    # Parse DATABASE_URL
    # Format: postgresql://user:password@host:port/database
    DB_USER=$(echo $DATABASE_URL | sed -E 's|postgresql://([^:]+):.*|\1|')
    DB_PASSWORD=$(echo $DATABASE_URL | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
    DB_HOST=$(echo $DATABASE_URL | sed -E 's|.*@([^:]+):.*|\1|')
    DB_PORT=$(echo $DATABASE_URL | sed -E 's|.*:([0-9]+)/.*|\1|')
    DB_NAME=$(echo $DATABASE_URL | sed -E 's|.*/([^?]+).*|\1|')
    
    log "Database: $DB_NAME on $DB_HOST:$DB_PORT"
    log "Backup file: $BACKUP_FILE"
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Perform backup
    log "Starting database dump..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -F c \
        -f "${BACKUP_DIR}/${BACKUP_FILE}" \
        --verbose 2>&1 | tee -a "$LOG_FILE"; then
        
        unset PGPASSWORD
        
        log "✓ Backup completed successfully"
        
        # Get backup size
        BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
        log "Backup size: $BACKUP_SIZE"
        
        # Compress backup
        log "Compressing backup..."
        gzip "${BACKUP_DIR}/${BACKUP_FILE}"
        COMPRESSED_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}.gz" | cut -f1)
        log "✓ Backup compressed (${COMPRESSED_SIZE})"
        
        # Upload to cloud storage (if configured)
        if [ ! -z "${GCS_BUCKET:-}" ]; then
            log "Uploading to Google Cloud Storage..."
            if gsutil cp "${BACKUP_DIR}/${BACKUP_FILE}.gz" \
                      "gs://${GCS_BUCKET}/daily/${BACKUP_FILE}.gz" 2>&1 | tee -a "$LOG_FILE"; then
                log "✓ Backup uploaded to gs://${GCS_BUCKET}/daily/"
            else
                warn "Failed to upload to GCS, but local backup is available"
            fi
        fi
        
        # Cleanup old backups
        cleanup
        
        # Send success notification
        send_notification "CMP database backup completed: ${COMPRESSED_SIZE}" "success"
        
        log "=== CMP Database Backup Completed Successfully ==="
        exit 0
        
    else
        unset PGPASSWORD
        error "Backup failed!"
        send_notification "CMP database backup FAILED! Check logs immediately." "error"
        log "=== CMP Database Backup Failed ==="
        exit 1
    fi
}

# Run main function
main
