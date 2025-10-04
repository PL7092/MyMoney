#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

class AutoInstaller {
  constructor() {
    this.isWindows = process.platform === 'win32';
    this.packageManager = this.detectPackageManager();
  }

  detectPackageManager() {
    try {
      execSync('npm --version', { stdio: 'ignore' });
      return 'npm';
    } catch {
      try {
        execSync('yarn --version', { stdio: 'ignore' });
        return 'yarn';
      } catch {
        try {
          execSync('pnpm --version', { stdio: 'ignore' });
          return 'pnpm';
        } catch {
          console.error('❌ Nenhum gerenciador de pacotes encontrado (npm, yarn, pnpm)');
          process.exit(1);
        }
      }
    }
  }

  log(message, type = 'info') {
    const icons = {
      info: '📋',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      install: '📦'
    };
    console.log(`${icons[type]} ${message}`);
  }

  async checkNodeVersion() {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 16) {
      this.log(`Node.js ${nodeVersion} detectado. Recomendado: Node.js 16+`, 'warning');
    } else {
      this.log(`Node.js ${nodeVersion} ✓`, 'success');
    }
  }

  async installDependencies() {
    this.log('Instalando dependências...', 'install');
    
    try {
      const command = `${this.packageManager} install`;
      execSync(command, { stdio: 'inherit' });
      this.log('Dependências instaladas com sucesso!', 'success');
    } catch (error) {
      this.log('Erro ao instalar dependências', 'error');
      throw error;
    }
  }

  async createDirectories() {
    const dirs = [
      'logs',
      'uploads',
      'backups',
      'config'
    ];

    this.log('Criando diretórios necessários...', 'info');
    
    for (const dir of dirs) {
      const dirPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        this.log(`Diretório criado: ${dir}`, 'success');
      }
    }
  }

  async createEnvFile() {
    const envPath = path.join(process.cwd(), '.env');
    const envExamplePath = path.join(process.cwd(), '.env.example');
    
    if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
      this.log('Criando arquivo .env...', 'info');
      fs.copyFileSync(envExamplePath, envPath);
      this.log('Arquivo .env criado! Configure as variáveis necessárias.', 'success');
    }
  }

  async checkServices() {
    this.log('Verificando serviços disponíveis...', 'info');
    
    // Verificar se Redis está disponível
    try {
      const { default: redis } = await import('redis');
      const client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 2000
        }
      });
      
      await client.connect();
      await client.ping();
      await client.disconnect();
      this.log('Redis disponível ✓', 'success');
    } catch (error) {
      this.log('Redis não disponível - usando cache em memória', 'warning');
    }

    // Verificar se MariaDB está disponível
    try {
      const { default: mysql } = await import('mysql2/promise');
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        connectTimeout: 2000
      });
      
      await connection.ping();
      await connection.end();
      this.log('MariaDB disponível ✓', 'success');
    } catch (error) {
      this.log('❌ MariaDB não disponível - verifique a configuração da base de dados', 'error');
      throw new Error('MariaDB connection required but not available');
    }
  }

  async runTests() {
    this.log('Executando testes básicos...', 'info');
    
    try {
      // Teste simples de importação dos serviços
      const { logger } = await import('./server/services/LoggerService.js');
      logger.info('Teste do LoggerService');
      this.log('LoggerService ✓', 'success');

      const { cache } = await import('./server/services/CacheService.js');
      this.log('CacheService ✓', 'success');

      const { backup } = await import('./server/services/BackupService.js');
      this.log('BackupService ✓', 'success');

      this.log('Todos os serviços carregados com sucesso!', 'success');
    } catch (error) {
      this.log(`Erro ao carregar serviços: ${error.message}`, 'error');
      throw error;
    }
  }

  async install() {
    console.log('🚀 Iniciando instalação automática do MyMoney...\n');

    try {
      await this.checkNodeVersion();
      await this.installDependencies();
      await this.createDirectories();
      await this.createEnvFile();
      await this.checkServices();
      await this.runTests();

      console.log('\n🎉 Instalação concluída com sucesso!');
      console.log('\n📋 Próximos passos:');
      console.log('1. Configure o arquivo .env com suas credenciais');
      console.log('2. Execute: npm run server:dev (desenvolvimento)');
      console.log('3. Execute: npm run server:prod (produção)');
      console.log('4. Acesse: http://localhost:3000');

    } catch (error) {
      console.log('\n❌ Erro durante a instalação:', error.message);
      process.exit(1);
    }
  }
}

// Executar instalação se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const installer = new AutoInstaller();
  installer.install();
}

export default AutoInstaller;