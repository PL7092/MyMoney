#!/bin/bash
# MariaDB Backup Script for Docker Environment
# This script creates automated backups of the mymoney database

set -e

# Configuration
DB_NAME="${MARIADB_DATABASE:-mymoney}"
DB_USER="root"
DB_PASSWORD="${MARIADB_ROOT_PASSWORD:-rootpassword123}"
DB_HOST="localhost"
BACKUP_DIR="/backup"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${DATE}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

# Retention settings
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

echo "Starting MariaDB backup for database: ${DB_NAME}"
echo "Backup file: ${BACKUP_FILE}"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Create the backup
mariadb-dump \
    --host="${DB_HOST}" \
    --user="${DB_USER}" \
    --password="${DB_PASSWORD}" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --add-drop-database \
    --add-drop-table \
    --create-options \
    --disable-keys \
    --extended-insert \
    --quick \
    --lock-tables=false \
    --databases "${DB_NAME}" > "${BACKUP_FILE}"

# Compress the backup
gzip "${BACKUP_FILE}"

echo "Backup completed: ${COMPRESSED_FILE}"

# Calculate file size
BACKUP_SIZE=$(du -h "${COMPRESSED_FILE}" | cut -f1)
echo "Backup size: ${BACKUP_SIZE}"

# Clean up old backups (keep only last N days)
if [ "${RETENTION_DAYS}" -gt 0 ]; then
    echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
    find "${BACKUP_DIR}" -name "backup_${DB_NAME}_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
    echo "Cleanup completed"
fi

# List current backups
echo "Current backups:"
ls -lah "${BACKUP_DIR}"/backup_${DB_NAME}_*.sql.gz 2>/dev/null || echo "No backups found"

echo "Backup process completed successfully"