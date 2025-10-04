#!/bin/bash
# MariaDB Restore Script for Docker Environment
# This script restores a backup of the mymoney database

set -e

# Configuration
DB_NAME="${MARIADB_DATABASE:-mymoney}"
DB_USER="root"
DB_PASSWORD="${MARIADB_ROOT_PASSWORD:-rootpassword123}"
DB_HOST="localhost"
BACKUP_DIR="/backup"

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file>"
    echo "Available backups:"
    ls -la "${BACKUP_DIR}"/backup_${DB_NAME}_*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: Backup file '${BACKUP_FILE}' not found"
    exit 1
fi

echo "Starting MariaDB restore from: ${BACKUP_FILE}"

# Check if file is compressed
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    echo "Decompressing backup file..."
    TEMP_FILE="/tmp/restore_temp.sql"
    gunzip -c "${BACKUP_FILE}" > "${TEMP_FILE}"
    RESTORE_FILE="${TEMP_FILE}"
else
    RESTORE_FILE="${BACKUP_FILE}"
fi

# Confirm restore operation
echo "WARNING: This will replace the current database '${DB_NAME}'"
echo "Press Enter to continue or Ctrl+C to cancel..."
read -r

# Perform the restore
echo "Restoring database..."
mariadb \
    --host="${DB_HOST}" \
    --user="${DB_USER}" \
    --password="${DB_PASSWORD}" \
    < "${RESTORE_FILE}"

# Clean up temporary file if created
if [ -n "${TEMP_FILE}" ] && [ -f "${TEMP_FILE}" ]; then
    rm -f "${TEMP_FILE}"
fi

echo "Database restore completed successfully"

# Verify the restore
echo "Verifying restore..."
TABLE_COUNT=$(mariadb \
    --host="${DB_HOST}" \
    --user="${DB_USER}" \
    --password="${DB_PASSWORD}" \
    --database="${DB_NAME}" \
    --execute="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" \
    --skip-column-names)

echo "Database '${DB_NAME}' now contains ${TABLE_COUNT} tables"
echo "Restore verification completed"