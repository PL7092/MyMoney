/**
 * Service Syntax and Logic Validator
 * Tests all services for syntax errors and logical issues without execution
 */

import fs from 'fs';
import path from 'path';

class ServiceValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.validServices = [];
    this.testResults = {
      syntax: { passed: 0, failed: 0 },
      logic: { passed: 0, failed: 0 },
      dependencies: { passed: 0, failed: 0 }
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': '[INFO]',
      'warn': '[WARN]',
      'error': '[ERROR]',
      'success': '[PASS]'
    }[type] || '[INFO]';
    
    console.log(`${prefix} ${message}`);
  }

  validateSyntax(filePath, content) {
    this.log(`Validating syntax: ${path.basename(filePath)}`);
    
    try {
      // Basic syntax checks
      this.checkBasicSyntax(filePath, content);
      
      // JavaScript/TypeScript specific checks
      if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
        this.checkJSTS(filePath, content);
      }
      
      this.testResults.syntax.passed++;
      this.log(`Syntax validation passed: ${path.basename(filePath)}`, 'success');
      return true;
      
    } catch (error) {
      this.errors.push({ file: filePath, type: 'syntax', error: error.message });
      this.testResults.syntax.failed++;
      this.log(`Syntax error in ${path.basename(filePath)}: ${error.message}`, 'error');
      return false;
    }
  }

  checkBasicSyntax(filePath, content) {
    // Check for balanced brackets
    const brackets = { '(': ')', '[': ']', '{': '}' };
    const stack = [];
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (brackets[char]) {
        stack.push(char);
      } else if (Object.values(brackets).includes(char)) {
        const last = stack.pop();
        if (!last || brackets[last] !== char) {
          throw new Error(`Unmatched bracket at position ${i}`);
        }
      }
    }
    
    if (stack.length > 0) {
      throw new Error(`Unclosed brackets: ${stack.join(', ')}`);
    }

    // Check for common syntax issues
    if (content.includes('function(') && !content.includes('function (')) {
      this.warnings.push({ file: filePath, warning: 'Consider adding space after function keyword' });
    }

    // Check for semicolon consistency
    const lines = content.split('\n');
    let semicolonLines = 0;
    let nonSemicolonLines = 0;
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
        if (trimmed.endsWith(';')) semicolonLines++;
        else if (!trimmed.endsWith('{') && !trimmed.endsWith('}')) nonSemicolonLines++;
      }
    });

    if (semicolonLines > 0 && nonSemicolonLines > 0) {
      this.warnings.push({ file: filePath, warning: 'Inconsistent semicolon usage' });
    }
  }

  checkJSTS(filePath, content) {
    // Check for ES6+ features compatibility
    const es6Features = [
      { pattern: /const\s+\w+\s*=/, name: 'const declarations' },
      { pattern: /let\s+\w+\s*=/, name: 'let declarations' },
      { pattern: /=>\s*{/, name: 'arrow functions' },
      { pattern: /`[^`]*\$\{[^}]*\}[^`]*`/, name: 'template literals' },
      { pattern: /async\s+function/, name: 'async functions' },
      { pattern: /await\s+/, name: 'await expressions' }
    ];

    es6Features.forEach(feature => {
      if (feature.pattern.test(content)) {
        this.log(`ES6+ feature detected: ${feature.name} in ${path.basename(filePath)}`);
      }
    });

    // Check for require/import consistency
    const hasRequire = /require\s*\(/.test(content);
    const hasImport = /import\s+.*from/.test(content);
    
    if (hasRequire && hasImport) {
      this.warnings.push({ file: filePath, warning: 'Mixed require() and import statements' });
    }

    // Check for proper error handling
    if (content.includes('try') && !content.includes('catch')) {
      this.warnings.push({ file: filePath, warning: 'try block without catch' });
    }

    // Check for async/await without proper error handling
    if (content.includes('await') && !content.includes('try') && !content.includes('.catch(')) {
      this.warnings.push({ file: filePath, warning: 'await without error handling' });
    }
  }

  validateLogic(filePath, content) {
    this.log(`Validating logic: ${path.basename(filePath)}`);
    
    try {
      // Check for common logical issues
      this.checkCommonLogicIssues(filePath, content);
      
      // Service-specific checks
      if (filePath.includes('Service')) {
        this.checkServicePattern(filePath, content);
      }
      
      this.testResults.logic.passed++;
      this.log(`Logic validation passed: ${path.basename(filePath)}`, 'success');
      return true;
      
    } catch (error) {
      this.errors.push({ file: filePath, type: 'logic', error: error.message });
      this.testResults.logic.failed++;
      this.log(`Logic error in ${path.basename(filePath)}: ${error.message}`, 'error');
      return false;
    }
  }

  checkCommonLogicIssues(filePath, content) {
    // Check for potential null/undefined issues
    if (content.includes('.length') && !content.includes('&& ') && !content.includes('?.')) {
      this.warnings.push({ file: filePath, warning: 'Potential null reference on .length' });
    }

    // Check for hardcoded values
    const hardcodedPatterns = [
      /localhost:\d+/g,
      /127\.0\.0\.1/g,
      /password.*=.*"[^"]*"/gi,
      /secret.*=.*"[^"]*"/gi
    ];

    hardcodedPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        this.warnings.push({ file: filePath, warning: 'Hardcoded values detected' });
      }
    });

    // Check for console.log in production code
    if (content.includes('console.log') && !filePath.includes('test')) {
      this.warnings.push({ file: filePath, warning: 'console.log found in production code' });
    }

    // Check for TODO/FIXME comments
    if (/TODO|FIXME|HACK/i.test(content)) {
      this.warnings.push({ file: filePath, warning: 'TODO/FIXME comments found' });
    }
  }

  checkServicePattern(filePath, content) {
    const serviceName = path.basename(filePath, path.extname(filePath));
    
    // Check if service follows class pattern
    if (!content.includes(`class ${serviceName}`)) {
      this.warnings.push({ file: filePath, warning: 'Service should follow class pattern' });
    }

    // Check for constructor
    if (content.includes('class') && !content.includes('constructor')) {
      this.warnings.push({ file: filePath, warning: 'Service class should have constructor' });
    }

    // Check for proper method definitions
    const methods = content.match(/^\s*(async\s+)?(\w+)\s*\([^)]*\)\s*{/gm);
    if (!methods || methods.length === 0) {
      this.warnings.push({ file: filePath, warning: 'Service should have methods' });
    }

    // Check for error handling in service methods
    if (content.includes('async') && !content.includes('try') && !content.includes('.catch(')) {
      this.warnings.push({ file: filePath, warning: 'Async service methods should have error handling' });
    }
  }

  validateDependencies(filePath, content) {
    this.log(`Validating dependencies: ${path.basename(filePath)}`);
    
    try {
      const dependencies = this.extractDependencies(content);
      this.checkDependencyAvailability(filePath, dependencies);
      
      this.testResults.dependencies.passed++;
      this.log(`Dependencies validation passed: ${path.basename(filePath)}`, 'success');
      return true;
      
    } catch (error) {
      this.errors.push({ file: filePath, type: 'dependencies', error: error.message });
      this.testResults.dependencies.failed++;
      this.log(`Dependencies error in ${path.basename(filePath)}: ${error.message}`, 'error');
      return false;
    }
  }

  extractDependencies(content) {
    const dependencies = new Set();
    
    // Extract require() statements
    const requireMatches = content.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g);
    if (requireMatches) {
      requireMatches.forEach(match => {
        const dep = match.match(/['"`]([^'"`]+)['"`]/)[1];
        if (!dep.startsWith('.') && !dep.startsWith('/')) {
          dependencies.add(dep);
        }
      });
    }

    // Extract import statements
    const importMatches = content.match(/import\s+.*from\s+['"`]([^'"`]+)['"`]/g);
    if (importMatches) {
      importMatches.forEach(match => {
        const dep = match.match(/['"`]([^'"`]+)['"`]/)[1];
        if (!dep.startsWith('.') && !dep.startsWith('/')) {
          dependencies.add(dep);
        }
      });
    }

    return Array.from(dependencies);
  }

  checkDependencyAvailability(filePath, dependencies) {
    // Check if package.json exists
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found');
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const allDeps = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {}
    };

    dependencies.forEach(dep => {
      if (!allDeps[dep] && !this.isBuiltinModule(dep)) {
        this.warnings.push({ 
          file: filePath, 
          warning: `Dependency '${dep}' not found in package.json` 
        });
      }
    });
  }

  isBuiltinModule(moduleName) {
    const builtinModules = [
      'fs', 'path', 'http', 'https', 'url', 'crypto', 'os', 'util',
      'events', 'stream', 'buffer', 'querystring', 'zlib'
    ];
    return builtinModules.includes(moduleName);
  }

  async validateFile(filePath) {
    try {
      this.log(`\nValidating file: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const content = fs.readFileSync(filePath, 'utf8');
      
      // Run all validations
      const syntaxValid = this.validateSyntax(filePath, content);
      const logicValid = this.validateLogic(filePath, content);
      const depsValid = this.validateDependencies(filePath, content);
      
      if (syntaxValid && logicValid && depsValid) {
        this.validServices.push(filePath);
      }
      
    } catch (error) {
      this.errors.push({ file: filePath, type: 'general', error: error.message });
      this.log(`Failed to validate ${filePath}: ${error.message}`, 'error');
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('SERVICE VALIDATION REPORT');
    console.log('='.repeat(80));
    
    console.log(`\nSyntax Tests:`);
    console.log(`  Passed: ${this.testResults.syntax.passed}`);
    console.log(`  Failed: ${this.testResults.syntax.failed}`);
    
    console.log(`\nLogic Tests:`);
    console.log(`  Passed: ${this.testResults.logic.passed}`);
    console.log(`  Failed: ${this.testResults.logic.failed}`);
    
    console.log(`\nDependency Tests:`);
    console.log(`  Passed: ${this.testResults.dependencies.passed}`);
    console.log(`  Failed: ${this.testResults.dependencies.failed}`);
    
    console.log(`\nValid Services: ${this.validServices.length}`);
    console.log(`Warnings: ${this.warnings.length}`);
    console.log(`Errors: ${this.errors.length}`);
    
    if (this.warnings.length > 0) {
      console.log('\nWARNINGS:');
      console.log('-'.repeat(40));
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. [${path.basename(warning.file)}] ${warning.warning}`);
      });
    }
    
    if (this.errors.length > 0) {
      console.log('\nERRORS:');
      console.log('-'.repeat(40));
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. [${path.basename(error.file)}] ${error.error}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    
    const status = this.errors.length === 0 ? 'PASSED' : 'FAILED';
    console.log(`VALIDATION ${status}`);
    console.log('='.repeat(80));

    return {
      status,
      results: this.testResults,
      validServices: this.validServices.length,
      warnings: this.warnings.length,
      errors: this.errors.length,
      details: {
        warnings: this.warnings,
        errors: this.errors
      }
    };
  }
}

async function main() {
  console.log('Starting Service Validation...');
  
  const validator = new ServiceValidator();
  
  // Service files to validate
  const serviceFiles = [
    'server/services/AuthService.js',
    'server/services/BackupService.js',
    'server/services/CacheService.js',
    'server/services/DatabaseInitService.js',
    'server/services/DatabaseService.js',
    'server/services/HealthCheckService.js',
    'server/services/LoggerService.js',
    'src/services/AICategorizationService.ts',
    'src/services/AutomationService.ts',
    'src/services/DatabaseService.ts',
    'src/services/FileParsingService.ts',
    'src/services/NotificationService.ts',
    'src/services/PromptService.ts'
  ];

  // Validate each service file
  for (const file of serviceFiles) {
    const fullPath = path.join(process.cwd(), file);
    await validator.validateFile(fullPath);
  }

  // Generate final report
  const report = validator.generateReport();
  
  // Save report to file
  const reportPath = path.join(process.cwd(), 'service-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(report.errors.length > 0 ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

export default ServiceValidator;