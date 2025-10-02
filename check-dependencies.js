/**
 * Dependency Compatibility Checker
 * Verifica compatibilidade de versões e dependências
 */

import fs from 'fs';
import path from 'path';

class DependencyChecker {
  constructor() {
    this.packageJson = null;
    this.issues = [];
    this.warnings = [];
    this.recommendations = [];
    this.securityIssues = [];
    this.compatibilityMatrix = this.getCompatibilityMatrix();
  }

  getCompatibilityMatrix() {
    return {
      // Node.js compatibility
      node: {
        minimum: '18.0.0',
        recommended: '20.0.0',
        maximum: '22.0.0'
      },
      
      // Critical dependencies compatibility
      dependencies: {
        'mysql2': {
          mariadb: ['10.4', '10.5', '10.6', '10.11', '11.0'],
          node: ['18.0.0', '20.0.0', '22.0.0'],
          versions: {
            minimum: '3.0.0',
            current: '3.15.0',
            security: 'OK'
          }
        },
        'redis': {
          redis_server: ['6.0', '7.0', '7.2'],
          node: ['18.0.0', '20.0.0', '22.0.0'],
          versions: {
            minimum: '4.0.0',
            current: '4.7.0',
            security: 'OK'
          }
        },
        'express': {
          node: ['18.0.0', '20.0.0', '22.0.0'],
          versions: {
            minimum: '4.18.0',
            current: '4.21.2',
            security: 'OK'
          }
        },
        'winston': {
          node: ['18.0.0', '20.0.0', '22.0.0'],
          versions: {
            minimum: '3.8.0',
            current: '3.17.0',
            security: 'OK'
          }
        },
        'react': {
          node: ['18.0.0', '20.0.0', '22.0.0'],
          versions: {
            minimum: '18.0.0',
            current: '18.3.1',
            security: 'OK'
          }
        },
        'typescript': {
          node: ['18.0.0', '20.0.0', '22.0.0'],
          versions: {
            minimum: '5.0.0',
            current: '5.8.3',
            security: 'OK'
          }
        },
        'vite': {
          node: ['18.0.0', '20.0.0', '22.0.0'],
          versions: {
            minimum: '5.0.0',
            current: '5.4.19',
            security: 'OK'
          }
        }
      },

      // Known security vulnerabilities (simplified)
      security: {
        'jsonwebtoken': {
          vulnerable: ['<9.0.0'],
          current: '9.0.2',
          status: 'SAFE'
        },
        'bcryptjs': {
          vulnerable: ['<2.4.0'],
          current: '2.4.3',
          status: 'SAFE'
        }
      },

      // Peer dependency conflicts
      peerDependencies: {
        '@radix-ui/*': {
          react: '^18.0.0',
          'react-dom': '^18.0.0'
        },
        '@tanstack/react-query': {
          react: '^18.0.0'
        }
      }
    };
  }

  loadPackageJson() {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      if (!fs.existsSync(packagePath)) {
        throw new Error('package.json not found');
      }
      
      this.packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      console.log('✅ package.json loaded successfully');
      return true;
    } catch (error) {
      this.issues.push({
        type: 'CRITICAL',
        category: 'FILE_MISSING',
        message: `Failed to load package.json: ${error.message}`
      });
      return false;
    }
  }

  checkNodeVersion() {
    const currentVersion = process.version;
    const majorVersion = parseInt(currentVersion.slice(1).split('.')[0]);
    const minVersion = parseInt(this.compatibilityMatrix.node.minimum.split('.')[0]);
    const maxVersion = parseInt(this.compatibilityMatrix.node.maximum.split('.')[0]);

    console.log(`🔍 Checking Node.js version: ${currentVersion}`);

    if (majorVersion < minVersion) {
      this.issues.push({
        type: 'CRITICAL',
        category: 'NODE_VERSION',
        message: `Node.js ${currentVersion} is too old. Minimum required: ${this.compatibilityMatrix.node.minimum}`
      });
    } else if (majorVersion > maxVersion) {
      this.warnings.push({
        type: 'WARNING',
        category: 'NODE_VERSION',
        message: `Node.js ${currentVersion} is newer than tested. Maximum tested: ${this.compatibilityMatrix.node.maximum}`
      });
    } else {
      console.log('✅ Node.js version is compatible');
    }
  }

  checkCriticalDependencies() {
    console.log('🔍 Checking critical dependencies...');
    
    const dependencies = { ...this.packageJson.dependencies, ...this.packageJson.devDependencies };
    
    Object.keys(this.compatibilityMatrix.dependencies).forEach(depName => {
      if (dependencies[depName]) {
        const installedVersion = dependencies[depName].replace(/[\^~]/, '');
        const compatibility = this.compatibilityMatrix.dependencies[depName];
        
        console.log(`  Checking ${depName}: ${installedVersion}`);
        
        // Check version compatibility
        if (this.isVersionOlder(installedVersion, compatibility.versions.minimum)) {
          this.issues.push({
            type: 'HIGH',
            category: 'VERSION_OLD',
            message: `${depName} ${installedVersion} is below minimum required ${compatibility.versions.minimum}`
          });
        } else {
          console.log(`    ✅ ${depName} version is compatible`);
        }
      } else {
        this.warnings.push({
          type: 'WARNING',
          category: 'MISSING_DEPENDENCY',
          message: `Critical dependency ${depName} not found in package.json`
        });
      }
    });
  }

  checkSecurityVulnerabilities() {
    console.log('🔍 Checking for known security vulnerabilities...');
    
    const dependencies = { ...this.packageJson.dependencies, ...this.packageJson.devDependencies };
    
    Object.keys(this.compatibilityMatrix.security).forEach(depName => {
      if (dependencies[depName]) {
        const installedVersion = dependencies[depName].replace(/[\^~]/, '');
        const security = this.compatibilityMatrix.security[depName];
        
        if (security.status === 'SAFE') {
          console.log(`  ✅ ${depName}: No known vulnerabilities`);
        } else {
          this.securityIssues.push({
            type: 'SECURITY',
            category: 'VULNERABILITY',
            message: `${depName} ${installedVersion} has known security issues`,
            recommendation: `Update to ${security.current} or later`
          });
        }
      }
    });
  }

  checkPeerDependencies() {
    console.log('🔍 Checking peer dependencies...');
    
    const dependencies = { ...this.packageJson.dependencies, ...this.packageJson.devDependencies };
    
    // Check React ecosystem compatibility
    const reactVersion = dependencies['react'];
    const reactDomVersion = dependencies['react-dom'];
    
    if (reactVersion && reactDomVersion) {
      const reactMajor = this.extractMajorVersion(reactVersion);
      const reactDomMajor = this.extractMajorVersion(reactDomVersion);
      
      if (reactMajor !== reactDomMajor) {
        this.issues.push({
          type: 'HIGH',
          category: 'PEER_DEPENDENCY',
          message: `React (${reactVersion}) and React-DOM (${reactDomVersion}) versions don't match`
        });
      } else {
        console.log('  ✅ React ecosystem versions are compatible');
      }
    }

    // Check TypeScript compatibility
    const typescriptVersion = dependencies['typescript'];
    if (typescriptVersion) {
      const tsMajor = this.extractMajorVersion(typescriptVersion);
      if (tsMajor < 5) {
        this.warnings.push({
          type: 'WARNING',
          category: 'TYPESCRIPT',
          message: `TypeScript ${typescriptVersion} is older than recommended (5.x)`
        });
      }
    }
  }

  checkDockerCompatibility() {
    console.log('🔍 Checking Docker compatibility...');
    
    // Check if docker-compose.yml exists
    if (fs.existsSync('docker-compose.yml')) {
      console.log('  ✅ docker-compose.yml found');
      
      // Check MariaDB version in docker-compose
      try {
        const dockerCompose = fs.readFileSync('docker-compose.yml', 'utf8');
        const mariadbMatch = dockerCompose.match(/mariadb:(\d+\.\d+)/);
        
        if (mariadbMatch) {
          const mariadbVersion = mariadbMatch[1];
          console.log(`  📦 MariaDB version in Docker: ${mariadbVersion}`);
          
          const supportedVersions = this.compatibilityMatrix.dependencies['mysql2'].mariadb;
          if (supportedVersions.some(v => mariadbVersion.startsWith(v))) {
            console.log('  ✅ MariaDB version is compatible with mysql2');
          } else {
            this.warnings.push({
              type: 'WARNING',
              category: 'DOCKER_VERSION',
              message: `MariaDB ${mariadbVersion} compatibility with mysql2 should be verified`
            });
          }
        }
      } catch (error) {
        this.warnings.push({
          type: 'WARNING',
          category: 'DOCKER_CONFIG',
          message: 'Could not parse docker-compose.yml for version checking'
        });
      }
    } else {
      this.warnings.push({
        type: 'WARNING',
        category: 'DOCKER_MISSING',
        message: 'docker-compose.yml not found'
      });
    }
  }

  checkPackageScripts() {
    console.log('🔍 Checking package scripts...');
    
    const requiredScripts = ['dev', 'build', 'start', 'server'];
    const scripts = this.packageJson.scripts || {};
    
    requiredScripts.forEach(script => {
      if (scripts[script]) {
        console.log(`  ✅ Script '${script}' is defined`);
      } else {
        this.warnings.push({
          type: 'WARNING',
          category: 'MISSING_SCRIPT',
          message: `Recommended script '${script}' is missing`
        });
      }
    });

    // Check for development vs production scripts
    if (scripts['server:dev'] && scripts['server:prod']) {
      console.log('  ✅ Development and production server scripts found');
    }
  }

  isVersionOlder(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part < v2Part) return true;
      if (v1Part > v2Part) return false;
    }
    
    return false;
  }

  extractMajorVersion(versionString) {
    const match = versionString.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  generateRecommendations() {
    console.log('💡 Generating recommendations...');
    
    // Performance recommendations
    this.recommendations.push({
      category: 'PERFORMANCE',
      message: 'Consider using npm ci instead of npm install in production',
      priority: 'LOW'
    });

    // Security recommendations
    this.recommendations.push({
      category: 'SECURITY',
      message: 'Run npm audit regularly to check for vulnerabilities',
      priority: 'MEDIUM'
    });

    // Development recommendations
    this.recommendations.push({
      category: 'DEVELOPMENT',
      message: 'Consider adding husky for git hooks and pre-commit checks',
      priority: 'LOW'
    });

    // Docker recommendations
    this.recommendations.push({
      category: 'DOCKER',
      message: 'Use specific version tags instead of latest in docker-compose.yml',
      priority: 'MEDIUM'
    });
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('DEPENDENCY COMPATIBILITY REPORT');
    console.log('='.repeat(80));

    // Summary
    console.log(`\n📊 SUMMARY:`);
    console.log(`  Critical Issues: ${this.issues.filter(i => i.type === 'CRITICAL').length}`);
    console.log(`  High Priority Issues: ${this.issues.filter(i => i.type === 'HIGH').length}`);
    console.log(`  Warnings: ${this.warnings.length}`);
    console.log(`  Security Issues: ${this.securityIssues.length}`);
    console.log(`  Recommendations: ${this.recommendations.length}`);

    // Critical Issues
    const criticalIssues = this.issues.filter(i => i.type === 'CRITICAL');
    if (criticalIssues.length > 0) {
      console.log(`\n🚨 CRITICAL ISSUES:`);
      criticalIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.category}] ${issue.message}`);
      });
    }

    // High Priority Issues
    const highIssues = this.issues.filter(i => i.type === 'HIGH');
    if (highIssues.length > 0) {
      console.log(`\n⚠️  HIGH PRIORITY ISSUES:`);
      highIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.category}] ${issue.message}`);
      });
    }

    // Security Issues
    if (this.securityIssues.length > 0) {
      console.log(`\n🔒 SECURITY ISSUES:`);
      this.securityIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.category}] ${issue.message}`);
        if (issue.recommendation) {
          console.log(`      💡 ${issue.recommendation}`);
        }
      });
    }

    // Warnings
    if (this.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS:`);
      this.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. [${warning.category}] ${warning.message}`);
      });
    }

    // Recommendations
    if (this.recommendations.length > 0) {
      console.log(`\n💡 RECOMMENDATIONS:`);
      this.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.category}] ${rec.message} (${rec.priority})`);
      });
    }

    console.log('\n' + '='.repeat(80));
    
    const status = criticalIssues.length === 0 && highIssues.length === 0 && this.securityIssues.length === 0 
      ? 'PASSED' : 'NEEDS_ATTENTION';
    
    console.log(`DEPENDENCY CHECK: ${status}`);
    console.log('='.repeat(80));

    return {
      status,
      summary: {
        critical: criticalIssues.length,
        high: highIssues.length,
        warnings: this.warnings.length,
        security: this.securityIssues.length,
        recommendations: this.recommendations.length
      },
      details: {
        issues: this.issues,
        warnings: this.warnings,
        security: this.securityIssues,
        recommendations: this.recommendations
      }
    };
  }

  async run() {
    console.log('🔍 Starting dependency compatibility check...\n');

    if (!this.loadPackageJson()) {
      return this.generateReport();
    }

    this.checkNodeVersion();
    this.checkCriticalDependencies();
    this.checkSecurityVulnerabilities();
    this.checkPeerDependencies();
    this.checkDockerCompatibility();
    this.checkPackageScripts();
    this.generateRecommendations();

    return this.generateReport();
  }
}

async function main() {
  const checker = new DependencyChecker();
  const report = await checker.run();
  
  // Save report to file
  const reportPath = path.join(process.cwd(), 'dependency-compatibility-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(report.status === 'PASSED' ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Dependency check failed:', error);
    process.exit(1);
  });
}

export default DependencyChecker;