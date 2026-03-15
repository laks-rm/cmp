#!/bin/bash
#
# CMP Database Backup/Restore Test Script
#
# This script performs a full backup/restore test cycle to verify
# that the backup and restore procedures work correctly.
#
# Test steps:
# 1. Create test database
# 2. Populate with sample data
# 3. Perform backup
# 4. Simulate data loss
# 5. Restore from backup
# 6. Verify data integrity
# 7. Cleanup
#
# Usage: ./test-backup-restore.sh
#

set -e  # Exit on error

# Configuration
TEST_DB_NAME="cmpdb_test_$(date +%s)"
BACKUP_DIR="/tmp/cmp_backup_test"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TESTS_PASSED=0
TESTS_FAILED=0

# Functions
log() {
    echo -e "${GREEN}[TEST]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

success() {
    echo -e "${GREEN}[✓]${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

cleanup() {
    info "Cleaning up test resources..."
    
    # Drop test database
    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -c "DROP DATABASE IF EXISTS $TEST_DB_NAME;" 2>/dev/null || true
    
    # Remove backup directory
    rm -rf "$BACKUP_DIR"
    
    success "Cleanup completed"
}

run_test() {
    local test_name=$1
    local test_command=$2
    
    log "Running: $test_name"
    
    if eval "$test_command"; then
        success "$test_name"
        return 0
    else
        error "$test_name FAILED"
        return 1
    fi
}

# Main test execution
main() {
    log "=== CMP Database Backup/Restore Test Suite ==="
    log "Test database: $TEST_DB_NAME"
    log "Backup directory: $BACKUP_DIR"
    echo ""
    
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
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Setup trap for cleanup
    trap cleanup EXIT
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Test 1: Create test database
    log "Test 1: Creating test database..."
    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -c "CREATE DATABASE $TEST_DB_NAME;"
    success "Test database created"
    
    # Test 2: Create sample schema and data
    log "Test 2: Creating sample schema and data..."
    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$TEST_DB_NAME" <<EOF
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200),
    description TEXT,
    user_id INTEGER REFERENCES users(id),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO users (name, email) VALUES
    ('Alice Admin', 'alice@example.com'),
    ('Bob User', 'bob@example.com'),
    ('Charlie Tester', 'charlie@example.com');

INSERT INTO tasks (title, description, user_id, status) VALUES
    ('Task 1', 'Test task 1', 1, 'TODO'),
    ('Task 2', 'Test task 2', 2, 'IN_PROGRESS'),
    ('Task 3', 'Test task 3', 1, 'COMPLETED'),
    ('Task 4', 'Test task 4', 3, 'TODO'),
    ('Task 5', 'Test task 5', 2, 'COMPLETED');
EOF
    success "Sample schema and data created"
    
    # Test 3: Verify initial data
    log "Test 3: Verifying initial data..."
    USER_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$TEST_DB_NAME" \
        -t -c "SELECT COUNT(*) FROM users;" | xargs)
    
    TASK_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$TEST_DB_NAME" \
        -t -c "SELECT COUNT(*) FROM tasks;" | xargs)
    
    if [ "$USER_COUNT" -eq 3 ] && [ "$TASK_COUNT" -eq 5 ]; then
        success "Initial data verified (3 users, 5 tasks)"
    else
        error "Initial data verification failed (expected 3 users and 5 tasks, got $USER_COUNT and $TASK_COUNT)"
    fi
    
    # Test 4: Perform backup
    log "Test 4: Performing backup..."
    BACKUP_FILE="${BACKUP_DIR}/test_backup_${TIMESTAMP}.dump"
    
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$TEST_DB_NAME" \
        -F c \
        -f "$BACKUP_FILE"
    
    if [ -f "$BACKUP_FILE" ]; then
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        success "Backup created successfully ($BACKUP_SIZE)"
    else
        error "Backup file was not created"
        exit 1
    fi
    
    # Test 5: Simulate data loss
    log "Test 5: Simulating data loss..."
    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$TEST_DB_NAME" \
        -c "DELETE FROM tasks; DELETE FROM users;"
    
    USERS_AFTER_DELETE=$(PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$TEST_DB_NAME" \
        -t -c "SELECT COUNT(*) FROM users;" | xargs)
    
    if [ "$USERS_AFTER_DELETE" -eq 0 ]; then
        success "Data loss simulated (all data deleted)"
    else
        error "Data deletion failed"
    fi
    
    # Test 6: Restore from backup
    log "Test 6: Restoring from backup..."
    PGPASSWORD="$DB_PASSWORD" pg_restore \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$TEST_DB_NAME" \
        --clean \
        --if-exists \
        --no-owner \
        --no-acl \
        "$BACKUP_FILE" 2>&1 | grep -v "WARNING" || true
    
    success "Restore completed"
    
    # Test 7: Verify restored data
    log "Test 7: Verifying restored data..."
    USER_COUNT_RESTORED=$(PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$TEST_DB_NAME" \
        -t -c "SELECT COUNT(*) FROM users;" | xargs)
    
    TASK_COUNT_RESTORED=$(PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$TEST_DB_NAME" \
        -t -c "SELECT COUNT(*) FROM tasks;" | xargs)
    
    if [ "$USER_COUNT_RESTORED" -eq 3 ] && [ "$TASK_COUNT_RESTORED" -eq 5 ]; then
        success "Restored data verified (3 users, 5 tasks) ✓"
    else
        error "Restored data verification failed (expected 3 and 5, got $USER_COUNT_RESTORED and $TASK_COUNT_RESTORED)"
    fi
    
    # Test 8: Verify data integrity
    log "Test 8: Verifying data integrity..."
    ALICE_EMAIL=$(PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$TEST_DB_NAME" \
        -t -c "SELECT email FROM users WHERE name = 'Alice Admin';" | xargs)
    
    if [ "$ALICE_EMAIL" = "alice@example.com" ]; then
        success "Data integrity verified (correct email for Alice)"
    else
        error "Data integrity check failed (incorrect email: $ALICE_EMAIL)"
    fi
    
    # Test 9: Test compressed backup
    log "Test 9: Testing compressed backup..."
    gzip -k "$BACKUP_FILE"
    COMPRESSED_FILE="${BACKUP_FILE}.gz"
    
    if [ -f "$COMPRESSED_FILE" ]; then
        ORIGINAL_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE")
        COMPRESSED_SIZE=$(stat -f%z "$COMPRESSED_FILE" 2>/dev/null || stat -c%s "$COMPRESSED_FILE")
        COMPRESSION_RATIO=$(echo "scale=2; $COMPRESSED_SIZE * 100 / $ORIGINAL_SIZE" | bc)
        
        success "Compressed backup created (${COMPRESSION_RATIO}% of original size)"
    else
        error "Compressed backup creation failed"
    fi
    
    # Cleanup
    unset PGPASSWORD
    
    # Summary
    echo ""
    echo "=========================================="
    echo "         TEST SUMMARY"
    echo "=========================================="
    echo -e "${GREEN}Tests passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Tests failed: $TESTS_FAILED${NC}"
    echo "=========================================="
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        echo ""
        echo "Backup and restore procedures are working correctly."
        exit 0
    else
        echo -e "${RED}✗ Some tests failed!${NC}"
        echo ""
        echo "Please review the errors above and fix the issues."
        exit 1
    fi
}

# Run main function
main
