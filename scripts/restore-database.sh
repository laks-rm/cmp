#!/bin/bash
#
# CMP Database Restore Script
#
# This script restores the CMP PostgreSQL database from a backup file.
#
# Usage: ./restore-database.sh [backup_file]
#
# If no backup file is provided, the script will list available backups.
#
# Environment variables required:
# - DATABASE_URL: PostgreSQL connection string
# - BACKUP_DIR (optional): Backup directory (default: /var/backups/postgres/daily)
#

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres/daily}"
BACKUP_FILE="${1:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

list_backups() {
    info "Available backups in $BACKUP_DIR:"
    echo ""
    
    # List local backups
    if ls -lht "$BACKUP_DIR"/cmp_backup_*.dump.gz 2>/dev/null | head -10; then
        echo ""
    else
        warn "No local backups found in $BACKUP_DIR"
    fi
    
    # List cloud backups (if configured)
    if [ ! -z "${GCS_BUCKET:-}" ]; then
        info "Cloud backups (10 most recent):"
        gsutil ls -lh "gs://${GCS_BUCKET}/daily/" | tail -11 || warn "Cannot list GCS backups"
    fi
    
    exit 0
}

confirm_restore() {
    local db_name=$1
    
    warn "⚠️  WARNING: This will restore database '$db_name'"
    warn "⚠️  All current data will be replaced with backup data!"
    echo ""
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirmation
    
    if [ "$confirmation" != "yes" ]; then
        info "Restore cancelled by user"
        exit 0
    fi
}

verify_restore() {
    local db_name=$1
    
    log "Verifying restored database..."
    
    # Check critical tables
    local tables=("User" "Task" "Finding" "Source" "AuditLog")
    
    for table in "${tables[@]}"; do
        count=$(PGPASSWORD="$DB_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$db_name" \
            -t -c "SELECT COUNT(*) FROM \"${table}\";" | xargs)
        
        log "✓ Table ${table}: $count records"
    done
    
    # Check latest audit log entry
    latest=$(PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$db_name" \
        -t -c "SELECT MAX(\"createdAt\") FROM \"AuditLog\";" | xargs)
    
    log "✓ Latest audit log entry: $latest"
    
    log "✓ Database verification completed"
}

# Main execution
main() {
    log "=== CMP Database Restore ==="
    
    # Validate environment
    if [ -z "${DATABASE_URL:-}" ]; then
        error "DATABASE_URL environment variable is not set"
        exit 1
    fi
    
    # Parse DATABASE_URL
    DB_USER=$(echo $DATABASE_URL | sed -E 's|postgresql://([^:]+):.*|\1|')
    DB_PASSWORD=$(echo $DATABASE_URL | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
    DB_HOST=$(echo $DATABASE_URL | sed -E 's|.*@([^:]+):.*|\1|')
    DB_PORT=$(echo $DATABASE_URL | sed -E 's|.*:([0-9]+)/.*|\1|')
    DB_NAME=$(echo $DATABASE_URL | sed -E 's|.*/([^?]+).*|\1|')
    
    log "Target database: $DB_NAME on $DB_HOST:$DB_PORT"
    
    # If no backup file provided, list available backups
    if [ -z "$BACKUP_FILE" ]; then
        list_backups
    fi
    
    # Check if backup file exists
    if [ ! -f "$BACKUP_FILE" ]; then
        # Try adding BACKUP_DIR prefix
        if [ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
            BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILE}"
        else
            error "Backup file not found: $BACKUP_FILE"
            info "Use './restore-database.sh' to list available backups"
            exit 1
        fi
    fi
    
    log "Backup file: $BACKUP_FILE"
    
    # Check if file is compressed
    if [[ $BACKUP_FILE == *.gz ]]; then
        log "Decompressing backup..."
        gunzip -k "$BACKUP_FILE"
        BACKUP_FILE="${BACKUP_FILE%.gz}"
    fi
    
    # Confirm restore
    confirm_restore "$DB_NAME"
    
    # Perform restore
    log "Starting database restore..."
    info "This may take several minutes depending on database size..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Restore database
    if pg_restore \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --clean \
        --if-exists \
        --no-owner \
        --no-acl \
        --verbose \
        "$BACKUP_FILE"; then
        
        unset PGPASSWORD
        
        log "✓ Restore completed successfully"
        
        # Verify restore
        verify_restore "$DB_NAME"
        
        info ""
        info "=== Next Steps ==="
        info "1. Run Prisma migrations: npx prisma migrate deploy"
        info "2. Restart application: docker-compose restart"
        info "3. Verify application: curl http://localhost:3000/api/health"
        info ""
        
        log "=== Database Restore Completed Successfully ==="
        exit 0
        
    else
        unset PGPASSWORD
        error "Restore failed!"
        error "Database may be in an inconsistent state"
        error "Consider restoring from a different backup or contact DBA"
        exit 1
    fi
}

# Run main function
main
