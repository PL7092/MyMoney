#!/usr/bin/env node

/**
 * Script de Teste Completo - MyMoney Application
 * 
 * Este script testa todos os componentes da aplicação sem necessidade de Docker
 * Inclui verificações de dependências, serviços e funcionalidades
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Cores para output no terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class TestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
  }

  log(message, color = 'reset') {
    const timestamp = new Date().toISOString().substr(11, 8);
    console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
  }

  success(message) {
    this.log(`✓ ${message}`, 'green');
  }

  error(message) {
    this.log(`✗ ${message}`, 'red');
  }

  warning(message) {
    this.log(`⚠ ${message}`, 'yellow');
  }

  info(message) {
    this.log(`ℹ ${message}`, 'blue');
  }

  addResult(test, passed, message, details = null) {
    this.results.push({
      test,
      passed,
      message,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // Verificar se Node.js está instalado e versão
  async checkNodeVersion() {
    try {
      const version = process.version;
      const majorVersion = parseInt(version.slice(1).split('.')[0]);
      
      if (majorVersion >= 14) {
        this.success(`Node.js version: ${version} (✓ Compatible)`);
        this.addResult('node_version', true, `Node.js ${version} is compatible`);
        return true;
      } else {
        this.error(`Node.js version: ${version} (✗ Requires v14+)`);
        this.addResult('node_version', false, `Node.js ${version} is too old, requires v14+`);
        return false;
      }
    } catch (error) {
      this.error(`Failed to check Node.js version: ${error.message}`);
      this.addResult('node_version', false, error.message);
      return false;
    }
  }

  // Verificar se package.json existe e tem as dependências necessárias
  async checkPackageJson() {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      
      if (!fs.existsSync(packagePath)) {
        this.error('package.json not found');
        this.addResult('package_json', false, 'package.json file not found');
        return false;
      }

      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const requiredDeps = [
        'express', 'mysql2', 'bcryptjs', 'jsonwebtoken', 
        'helmet', 'cors', 'express-rate-limit', 'winston'
      ];

      const missingDeps = requiredDeps.filter(dep => 
        !packageData.dependencies || !packageData.dependencies[dep]
      );

      if (missingDeps.length === 0) {
        this.success('All required dependencies found in package.json');
        this.addResult('package_json', true, 'All dependencies present');
        return true;
      } else {
        this.warning(`Missing dependencies: ${missingDeps.join(', ')}`);
        this.addResult('package_json', false, `Missing: ${missingDeps.join(', ')}`);
        return false;
      }
    } catch (error) {
      this.error(`Error checking package.json: ${error.message}`);
      this.addResult('package_json', false, error.message);
      return false;
    }
  }

  // Verificar se node_modules existe
  async checkNodeModules() {
    try {
      const nodeModulesPath = path.join(process.cwd(), 'node_modules');
      
      if (fs.existsSync(nodeModulesPath)) {
        const stats = fs.statSync(nodeModulesPath);
        if (stats.isDirectory()) {
          this.success('node_modules directory found');
          this.addResult('node_modules', true, 'Dependencies installed');
          return true;
        }
      }
      
      this.warning('node_modules not found - run npm install');
      this.addResult('node_modules', false, 'Dependencies not installed');
      return false;
    } catch (error) {
      this.error(`Error checking node_modules: ${error.message}`);
      this.addResult('node_modules', false, error.message);
      return false;
    }
  }

  // Verificar estrutura de arquivos
  async checkFileStructure() {
    try {
      const requiredFiles = [
        'server/server.js',
        'server/app.js',
        'server/db-commonjs.js',
        'server/services/LoggerService.js',
        'server/services/CacheService.js',
        'server/services/HealthCheckService.js',
        'server/services/DatabaseInitService.js',
        '.env.example'
      ];

      const missingFiles = requiredFiles.filter(file => 
        !fs.existsSync(path.join(process.cwd(), file))
      );

      if (missingFiles.length === 0) {
        this.success('All required files found');
        this.addResult('file_structure', true, 'Complete file structure');
        return true;
      } else {
        this.error(`Missing files: ${missingFiles.join(', ')}`);
        this.addResult('file_structure', false, `Missing: ${missingFiles.join(', ')}`);
        return false;
      }
    } catch (error) {
      this.error(`Error checking file structure: ${error.message}`);
      this.addResult('file_structure', false, error.message);
      return false;
    }
  }

  // Verificar arquivo .env
  async checkEnvironmentFile() {
    try {
      const envPath = path.join(process.cwd(), '.env');
      const envExamplePath = path.join(process.cwd(), '.env.example');
      
      if (fs.existsSync(envPath)) {
        this.success('.env file found');
        this.addResult('env_file', true, 'Environment file exists');
        return true;
      } else if (fs.existsSync(envExamplePath)) {
        this.warning('.env not found, but .env.example exists');
        this.info('You can copy .env.example to .env and configure it');
        this.addResult('env_file', false, '.env missing but .env.example available');
        return false;
      } else {
        this.error('Neither .env nor .env.example found');
        this.addResult('env_file', false, 'No environment configuration found');
        return false;
      }
    } catch (error) {
      this.error(`Error checking environment file: ${error.message}`);
      this.addResult('env_file', false, error.message);
      return false;
    }
  }

  // Testar carregamento dos serviços
  async testServiceLoading() {
    try {
      this.info('Testing service loading...');
      
      // Configurar variáveis de ambiente mínimas para teste
      process.env.NODE_ENV = process.env.NODE_ENV || 'test';
      process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
      process.env.DB_HOST = process.env.DB_HOST || 'localhost';
      process.env.DB_USER = process.env.DB_USER || 'root';
      process.env.DB_PASSWORD = process.env.DB_PASSWORD || '';
      process.env.DB_NAME = process.env.DB_NAME || 'mymoney_test';

      // Testar LoggerService
      try {
        const { logger } = require('./server/services/LoggerService');
        logger.info('Logger service test');
        this.success('LoggerService loaded successfully');
        this.addResult('logger_service', true, 'Service loaded and functional');
      } catch (error) {
        this.error(`LoggerService failed: ${error.message}`);
        this.addResult('logger_service', false, error.message);
      }

      // Testar CacheService
      try {
        const { cache } = require('./server/services/CacheService');
        await cache.set('test_key', 'test_value', 10);
        const value = await cache.get('test_key');
        
        if (value === 'test_value') {
          this.success('CacheService working (memory fallback)');
          this.addResult('cache_service', true, 'Cache functional with memory fallback');
        } else {
          this.warning('CacheService partially working');
          this.addResult('cache_service', false, 'Cache test failed');
        }
      } catch (error) {
        this.error(`CacheService failed: ${error.message}`);
        this.addResult('cache_service', false, error.message);
      }

      // Testar DatabaseService (sem conexão real)
      try {
        const { DatabaseService } = require('./server/db-commonjs');
        const db = new DatabaseService();
        this.success('DatabaseService loaded successfully');
        this.addResult('database_service', true, 'Service loaded (connection not tested)');
      } catch (error) {
        this.error(`DatabaseService failed: ${error.message}`);
        this.addResult('database_service', false, error.message);
      }

      // Testar HealthCheckService
      try {
        const { healthCheck } = require('./server/services/HealthCheckService');
        await healthCheck.init();
        this.success('HealthCheckService loaded successfully');
        this.addResult('health_service', true, 'Service loaded and initialized');
      } catch (error) {
        this.error(`HealthCheckService failed: ${error.message}`);
        this.addResult('health_service', false, error.message);
      }

      return true;
    } catch (error) {
      this.error(`Service loading test failed: ${error.message}`);
      this.addResult('service_loading', false, error.message);
      return false;
    }
  }

  // Testar carregamento da aplicação Express
  async testAppLoading() {
    try {
      this.info('Testing Express app loading...');
      
      // Tentar carregar a aplicação
      const app = require('./server/app');
      
      if (app && typeof app.listen === 'function') {
        this.success('Express application loaded successfully');
        this.addResult('express_app', true, 'App loaded and ready');
        return true;
      } else {
        this.error('Express application failed to load properly');
        this.addResult('express_app', false, 'App not properly configured');
        return false;
      }
    } catch (error) {
      this.error(`Express app loading failed: ${error.message}`);
      this.addResult('express_app', false, error.message);
      return false;
    }
  }

  // Verificar portas disponíveis
  async checkPortAvailability() {
    try {
      const net = require('net');
      const port = process.env.PORT || 3000;
      
      return new Promise((resolve) => {
        const server = net.createServer();
        
        server.listen(port, () => {
          server.close(() => {
            this.success(`Port ${port} is available`);
            this.addResult('port_availability', true, `Port ${port} available`);
            resolve(true);
          });
        });
        
        server.on('error', () => {
          this.warning(`Port ${port} is already in use`);
          this.addResult('port_availability', false, `Port ${port} in use`);
          resolve(false);
        });
      });
    } catch (error) {
      this.error(`Port check failed: ${error.message}`);
      this.addResult('port_availability', false, error.message);
      return false;
    }
  }

  // Executar todos os testes
  async runAllTests() {
    this.log('Starting MyMoney Application Tests', 'cyan');
    this.log('=====================================', 'cyan');

    const tests = [
      { name: 'Node.js Version', fn: () => this.checkNodeVersion() },
      { name: 'Package.json', fn: () => this.checkPackageJson() },
      { name: 'Node Modules', fn: () => this.checkNodeModules() },
      { name: 'File Structure', fn: () => this.checkFileStructure() },
      { name: 'Environment File', fn: () => this.checkEnvironmentFile() },
      { name: 'Service Loading', fn: () => this.testServiceLoading() },
      { name: 'Express App', fn: () => this.testAppLoading() },
      { name: 'Port Availability', fn: () => this.checkPortAvailability() }
    ];

    for (const test of tests) {
      this.info(`Running: ${test.name}`);
      try {
        await test.fn();
      } catch (error) {
        this.error(`Test "${test.name}" crashed: ${error.message}`);
        this.addResult(test.name.toLowerCase().replace(/\s+/g, '_'), false, error.message);
      }
      this.log(''); // Linha em branco para separar testes
    }

    this.generateReport();
  }

  // Gerar relatório final
  generateReport() {
    const endTime = Date.now();
    const duration = ((endTime - this.startTime) / 1000).toFixed(2);
    
    this.log('=====================================', 'cyan');
    this.log('TEST RESULTS SUMMARY', 'cyan');
    this.log('=====================================', 'cyan');

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    this.log(`Total Tests: ${total}`, 'bright');
    this.log(`Passed: ${passed}`, passed > 0 ? 'green' : 'reset');
    this.log(`Failed: ${failed}`, failed > 0 ? 'red' : 'reset');
    this.log(`Duration: ${duration}s`, 'blue');

    if (this.verbose) {
      this.log('\nDetailed Results:', 'yellow');
      this.results.forEach(result => {
        const status = result.passed ? '✓' : '✗';
        const color = result.passed ? 'green' : 'red';
        this.log(`  ${status} ${result.test}: ${result.message}`, color);
      });
    }

    // Recomendações
    this.log('\nRecommendations:', 'yellow');
    
    if (failed === 0) {
      this.success('All tests passed! Your application is ready to run.');
      this.info('You can start the server with: npm run server:dev');
    } else {
      this.warning('Some tests failed. Please address the issues above.');
      
      const failedTests = this.results.filter(r => !r.passed);
      if (failedTests.some(t => t.test === 'node_modules')) {
        this.info('→ Run: npm install');
      }
      if (failedTests.some(t => t.test === 'env_file')) {
        this.info('→ Copy .env.example to .env and configure it');
      }
      if (failedTests.some(t => t.test === 'port_availability')) {
        this.info('→ Change PORT in .env or stop the service using the port');
      }
    }

    // Salvar relatório em arquivo
    this.saveReport();
  }

  // Salvar relatório em arquivo
  saveReport() {
    try {
      const reportData = {
        timestamp: new Date().toISOString(),
        duration: ((Date.now() - this.startTime) / 1000).toFixed(2),
        summary: {
          total: this.results.length,
          passed: this.results.filter(r => r.passed).length,
          failed: this.results.filter(r => !r.passed).length
        },
        results: this.results
      };

      const reportPath = path.join(process.cwd(), 'test-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      this.info(`Report saved to: ${reportPath}`);
    } catch (error) {
      this.warning(`Could not save report: ${error.message}`);
    }
  }
}

// Executar testes se este arquivo for executado diretamente
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests().catch(error => {
    console.error('Test runner crashed:', error);
    process.exit(1);
  });
}

module.exports = TestRunner;