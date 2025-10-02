const cron = require('node-cron');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { logger } = require('./LoggerService');

const execAsync = promisify(exec);

class BackupService {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');
    this.dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME || 'mymoney',
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    };
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
    this.isEnabled = process.env.BACKUP_ENABLED === 'true';
    this.schedule = process.env.BACKUP_SCHEDULE || '0 2 * * *'; // 2:00 AM diariamente
    
    this.init();
  }

  async init() {
    if (!this.isEnabled) {
      logger.info('Backup service disabled');
      return;
    }

    try {
      await this.ensureBackupDirectory();
      this.scheduleBackups();
      logger.info('Backup service initialized', {
        schedule: this.schedule,
        retentionDays: this.retentionDays,
        backupDir: this.backupDir
      });
    } catch (error) {
      logger.error('Failed to initialize backup service', error);
    }
  }

  async ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      logger.info('Created backup directory', { path: this.backupDir });
    }
  }

  scheduleBackups() {
    if (!cron.validate(this.schedule)) {
      logger.error('Invalid backup schedule', { schedule: this.schedule });
      return;
    }

    cron.schedule(this.schedule, async () => {
      logger.info('Starting scheduled backup');
      await this.createBackup();
    }, {
      timezone: process.env.TZ || 'Europe/Lisbon'
    });

    // Agendar limpeza de backups antigos diariamente às 3:00 AM
    cron.schedule('0 3 * * *', async () => {
      await this.cleanupOldBackups();
    }, {
      timezone: process.env.TZ || 'Europe/Lisbon'
    });

    logger.info('Backup schedule configured', { schedule: this.schedule });
  }

  async createBackup(type = 'scheduled') {
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `mymoney_backup_${timestamp}.sql`;
    const backupPath = path.join(this.backupDir, backupFileName);

    try {
      logger.info('Creating database backup', { 
        file: backupFileName,
        type 
      });

      // Comando mysqldump para MariaDB
      const dumpCommand = this.buildDumpCommand(backupPath);
      
      const { stdout, stderr } = await execAsync(dumpCommand);
      
      if (stderr && !stderr.includes('Warning')) {
        throw new Error(`Backup error: ${stderr}`);
      }

      // Verificar se o arquivo foi criado e tem conteúdo
      const stats = fs.statSync(backupPath);
      if (stats.size === 0) {
        throw new Error('Backup file is empty');
      }

      const duration = Date.now() - startTime;
      const sizeFormatted = this.formatBytes(stats.size);

      logger.info('Backup completed successfully', {
        file: backupFileName,
        size: sizeFormatted,
        duration: `${duration}ms`,
        type
      });

      // Comprimir backup se for grande
      if (stats.size > 10 * 1024 * 1024) { // 10MB
        await this.compressBackup(backupPath);
      }

      return {
        success: true,
        file: backupFileName,
        path: backupPath,
        size: stats.size,
        duration
      };

    } catch (error) {
      logger.error('Backup failed', error, { 
        file: backupFileName,
        type 
      });

      // Remover arquivo de backup parcial se existir
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  buildDumpCommand(backupPath) {
    const { host, port, database, username, password } = this.dbConfig;
    
    // Construir comando mysqldump
    let command = 'mysqldump';
    command += ` --host=${host}`;
    command += ` --port=${port}`;
    command += ` --user=${username}`;
    
    if (password) {
      command += ` --password="${password}"`;
    }
    
    // Opções de backup
    command += ' --single-transaction'; // Para consistência
    command += ' --routines'; // Incluir stored procedures
    command += ' --triggers'; // Incluir triggers
    command += ' --events'; // Incluir events
    command += ' --add-drop-table'; // Adicionar DROP TABLE
    command += ' --create-options'; // Incluir opções de criação
    command += ' --disable-keys'; // Desabilitar chaves durante import
    command += ' --extended-insert'; // Usar INSERT estendido
    command += ' --quick'; // Recuperar linhas uma de cada vez
    command += ' --lock-tables=false'; // Não bloquear tabelas
    
    command += ` ${database}`;
    command += ` > "${backupPath}"`;
    
    return command;
  }

  async compressBackup(backupPath) {
    try {
      const gzipPath = `${backupPath}.gz`;
      const command = `gzip "${backupPath}"`;
      
      await execAsync(command);
      
      logger.info('Backup compressed', {
        original: path.basename(backupPath),
        compressed: path.basename(gzipPath)
      });
      
      return gzipPath;
    } catch (error) {
      logger.error('Failed to compress backup', error);
      return backupPath;
    }
  }

  async restoreBackup(backupFile) {
    const backupPath = path.join(this.backupDir, backupFile);
    
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }

    try {
      logger.info('Starting database restore', { file: backupFile });

      const { host, port, database, username, password } = this.dbConfig;
      
      let command = 'mysql';
      command += ` --host=${host}`;
      command += ` --port=${port}`;
      command += ` --user=${username}`;
      
      if (password) {
        command += ` --password="${password}"`;
      }
      
      command += ` ${database}`;
      
      // Se o arquivo estiver comprimido
      if (backupFile.endsWith('.gz')) {
        command = `gunzip -c "${backupPath}" | ${command}`;
      } else {
        command += ` < "${backupPath}"`;
      }

      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stderr.includes('Warning')) {
        throw new Error(`Restore error: ${stderr}`);
      }

      logger.info('Database restore completed', { file: backupFile });
      
      return { success: true };
      
    } catch (error) {
      logger.error('Database restore failed', error, { file: backupFile });
      throw error;
    }
  }

  async cleanupOldBackups() {
    try {
      const files = fs.readdirSync(this.backupDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      let deletedCount = 0;
      let freedSpace = 0;

      for (const file of files) {
        if (!file.startsWith('mymoney_backup_')) continue;

        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          freedSpace += stats.size;
          fs.unlinkSync(filePath);
          deletedCount++;
          
          logger.debug('Deleted old backup', { 
            file,
            age: Math.floor((Date.now() - stats.mtime) / (1000 * 60 * 60 * 24))
          });
        }
      }

      if (deletedCount > 0) {
        logger.info('Cleanup completed', {
          deletedFiles: deletedCount,
          freedSpace: this.formatBytes(freedSpace),
          retentionDays: this.retentionDays
        });
      }

    } catch (error) {
      logger.error('Backup cleanup failed', error);
    }
  }

  async getBackupList() {
    try {
      const files = fs.readdirSync(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (!file.startsWith('mymoney_backup_')) continue;

        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);

        backups.push({
          name: file,
          size: stats.size,
          sizeFormatted: this.formatBytes(stats.size),
          created: stats.mtime,
          age: this.getFileAge(stats.mtime)
        });
      }

      // Ordenar por data de criação (mais recente primeiro)
      backups.sort((a, b) => b.created - a.created);

      return backups;
    } catch (error) {
      logger.error('Failed to get backup list', error);
      return [];
    }
  }

  async getBackupStats() {
    try {
      const backups = await this.getBackupList();
      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);

      return {
        count: backups.length,
        totalSize,
        totalSizeFormatted: this.formatBytes(totalSize),
        oldestBackup: backups.length > 0 ? backups[backups.length - 1].created : null,
        newestBackup: backups.length > 0 ? backups[0].created : null,
        retentionDays: this.retentionDays,
        isEnabled: this.isEnabled,
        schedule: this.schedule
      };
    } catch (error) {
      logger.error('Failed to get backup stats', error);
      return null;
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getFileAge(date) {
    const ageMs = Date.now() - date.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    
    if (ageDays === 0) return 'Today';
    if (ageDays === 1) return '1 day ago';
    return `${ageDays} days ago`;
  }

  // Método para backup manual
  async createManualBackup() {
    return await this.createBackup('manual');
  }

  // Verificar se o serviço está funcionando
  getStatus() {
    return {
      enabled: this.isEnabled,
      schedule: this.schedule,
      retentionDays: this.retentionDays,
      backupDir: this.backupDir,
      nextRun: this.isEnabled ? 'Scheduled' : 'Disabled'
    };
  }
}

// Singleton instance
const backupService = new BackupService();

module.exports = { BackupService, backup: backupService };