const fs = require('fs');
const path = require('path');

/**
 * MariaDB SQL Query Validator
 * Tests all SQL queries for MariaDB compatibility without executing them
 */

class MariaDBQueryValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.validQueries = [];
    this.mariadbKeywords = new Set([
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'INDEX',
      'TABLE', 'DATABASE', 'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'EVENT',
      'AUTO_INCREMENT', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT',
      'ENGINE', 'CHARSET', 'COLLATE', 'DEFAULT', 'NULL', 'NOT', 'UNIQUE',
      'TIMESTAMP', 'DATETIME', 'DATE', 'TIME', 'VARCHAR', 'TEXT', 'INT', 'DECIMAL',
      'BOOLEAN', 'JSON', 'ENUM', 'ON', 'DELETE', 'CASCADE', 'SET', 'CURRENT_TIMESTAMP'
    ]);
  }

  validateQuery(query, source = 'unknown') {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    console.log(`\n🔍 Validating query from ${source}:`);
    console.log(`   ${trimmedQuery.substring(0, 80)}${trimmedQuery.length > 80 ? '...' : ''}`);

    try {
      // Basic syntax validation
      this.validateBasicSyntax(trimmedQuery, source);
      
      // MariaDB specific validation
      this.validateMariaDBCompatibility(trimmedQuery, source);
      
      // Data type validation
      this.validateDataTypes(trimmedQuery, source);
      
      // Index and constraint validation
      this.validateIndexesAndConstraints(trimmedQuery, source);
      
      this.validQueries.push({ query: trimmedQuery, source });
      console.log(`   ✅ Query is valid`);
      
    } catch (error) {
      this.errors.push({ query: trimmedQuery, source, error: error.message });
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  validateBasicSyntax(query, source) {
    // Check for balanced parentheses
    let parenCount = 0;
    for (const char of query) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) {
        throw new Error('Unbalanced parentheses - closing before opening');
      }
    }
    if (parenCount !== 0) {
      throw new Error('Unbalanced parentheses - missing closing parentheses');
    }

    // Check for proper statement termination
    if (query.includes(';') && !query.trim().endsWith(';')) {
      this.warnings.push({ query, source, warning: 'Query contains semicolon but does not end with one' });
    }

    // Check for SQL injection patterns
    const dangerousPatterns = [
      /--\s*[^-]/,  // SQL comments that might be injection
      /\/\*.*\*\//,  // Block comments
      /;\s*(DROP|DELETE|UPDATE|INSERT)\s+/i  // Multiple statements
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        this.warnings.push({ query, source, warning: 'Potentially dangerous SQL pattern detected' });
      }
    }
  }

  validateMariaDBCompatibility(query, source) {
    const upperQuery = query.toUpperCase();

    // Check for MariaDB-specific features
    if (upperQuery.includes('JSON')) {
      if (!upperQuery.includes('JSON DEFAULT NULL') && !upperQuery.includes('JSON NOT NULL')) {
        this.warnings.push({ query, source, warning: 'JSON column should specify DEFAULT NULL or NOT NULL' });
      }
    }

    // Check for proper ENGINE specification
    if (upperQuery.includes('CREATE TABLE') && !upperQuery.includes('ENGINE=')) {
      this.warnings.push({ query, source, warning: 'CREATE TABLE should specify ENGINE (recommended: InnoDB)' });
    }

    // Check for proper charset and collation
    if (upperQuery.includes('CREATE TABLE')) {
      if (!upperQuery.includes('CHARSET') && !upperQuery.includes('CHARACTER SET')) {
        this.warnings.push({ query, source, warning: 'CREATE TABLE should specify charset (recommended: utf8mb4)' });
      }
      if (!upperQuery.includes('COLLATE')) {
        this.warnings.push({ query, source, warning: 'CREATE TABLE should specify collation (recommended: utf8mb4_unicode_ci)' });
      }
    }

    // Check for deprecated MySQL features
    const deprecatedFeatures = [
      { pattern: /TYPE\s*=/i, message: 'TYPE= is deprecated, use ENGINE=' },
      { pattern: /TIMESTAMP\(\d+\)/i, message: 'TIMESTAMP with precision may have compatibility issues' }
    ];

    for (const { pattern, message } of deprecatedFeatures) {
      if (pattern.test(query)) {
        this.warnings.push({ query, source, warning: message });
      }
    }
  }

  validateDataTypes(query, source) {
    const upperQuery = query.toUpperCase();

    // Check for proper decimal precision
    const decimalMatches = query.match(/DECIMAL\((\d+),(\d+)\)/gi);
    if (decimalMatches) {
      for (const match of decimalMatches) {
        const [, precision, scale] = match.match(/DECIMAL\((\d+),(\d+)\)/i);
        if (parseInt(precision) > 65) {
          throw new Error(`DECIMAL precision ${precision} exceeds MariaDB maximum of 65`);
        }
        if (parseInt(scale) > parseInt(precision)) {
          throw new Error(`DECIMAL scale ${scale} cannot exceed precision ${precision}`);
        }
      }
    }

    // Check for proper VARCHAR lengths
    const varcharMatches = query.match(/VARCHAR\((\d+)\)/gi);
    if (varcharMatches) {
      for (const match of varcharMatches) {
        const [, length] = match.match(/VARCHAR\((\d+)\)/i);
        if (parseInt(length) > 65535) {
          throw new Error(`VARCHAR length ${length} exceeds MariaDB maximum of 65535`);
        }
        if (parseInt(length) > 255 && upperQuery.includes('INDEX')) {
          this.warnings.push({ query, source, warning: `VARCHAR(${length}) in index may cause performance issues` });
        }
      }
    }

    // Check for TEXT types with lengths
    if (/TEXT\(\d+\)/i.test(query)) {
      this.warnings.push({ query, source, warning: 'TEXT type with length specification is not standard' });
    }
  }

  validateIndexesAndConstraints(query, source) {
    const upperQuery = query.toUpperCase();

    // Check for foreign key constraints
    if (upperQuery.includes('FOREIGN KEY')) {
      if (!upperQuery.includes('ON DELETE') && !upperQuery.includes('ON UPDATE')) {
        this.warnings.push({ query, source, warning: 'Foreign key should specify ON DELETE/UPDATE actions' });
      }
    }

    // Check for index naming
    const indexMatches = query.match(/INDEX\s+(\w+)/gi);
    if (indexMatches) {
      for (const match of indexMatches) {
        const [, indexName] = match.match(/INDEX\s+(\w+)/i);
        if (!indexName.startsWith('idx_')) {
          this.warnings.push({ query, source, warning: `Index name '${indexName}' should follow idx_ naming convention` });
        }
      }
    }

    // Check for primary key definition
    if (upperQuery.includes('CREATE TABLE') && !upperQuery.includes('PRIMARY KEY')) {
      this.warnings.push({ query, source, warning: 'Table should have a PRIMARY KEY defined' });
    }
  }

  async validateFile(filePath) {
    try {
      console.log(`\n📁 Reading SQL file: ${filePath}`);
      const content = await fs.promises.readFile(filePath, 'utf8');
      
      // Split by semicolons and validate each query
      const queries = content.split(';').filter(q => q.trim());
      
      for (const query of queries) {
        this.validateQuery(query, path.basename(filePath));
      }
      
    } catch (error) {
      console.error(`❌ Failed to read file ${filePath}:`, error.message);
      this.errors.push({ source: filePath, error: `File read error: ${error.message}` });
    }
  }

  async validateJavaScriptFile(filePath) {
    try {
      console.log(`\n📁 Reading JavaScript file: ${filePath}`);
      const content = await fs.promises.readFile(filePath, 'utf8');
      
      // Extract SQL queries from JavaScript/TypeScript files
      const sqlPatterns = [
        /`([^`]*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)[^`]*)`/gi,
        /'([^']*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)[^']*)'/gi,
        /"([^"]*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)[^"]*)"/gi
      ];

      for (const pattern of sqlPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const query = match[1].trim();
          if (query.length > 10) { // Filter out very short matches
            this.validateQuery(query, path.basename(filePath));
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ Failed to read file ${filePath}:`, error.message);
      this.errors.push({ source: filePath, error: `File read error: ${error.message}` });
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 MARIADB SQL VALIDATION REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n✅ Valid Queries: ${this.validQueries.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log(`❌ Errors: ${this.errors.length}`);
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      console.log('-'.repeat(40));
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. [${warning.source}] ${warning.warning}`);
        if (warning.query) {
          console.log(`   Query: ${warning.query.substring(0, 100)}...`);
        }
      });
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      console.log('-'.repeat(40));
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.source}] ${error.error}`);
        if (error.query) {
          console.log(`   Query: ${error.query.substring(0, 100)}...`);
        }
      });
    }

    console.log('\n' + '='.repeat(80));
    
    const status = this.errors.length === 0 ? 'PASSED' : 'FAILED';
    const statusIcon = this.errors.length === 0 ? '✅' : '❌';
    console.log(`${statusIcon} VALIDATION ${status}`);
    console.log('='.repeat(80));

    return {
      status,
      validQueries: this.validQueries.length,
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
  console.log('🚀 Starting MariaDB SQL Validation...');
  
  const validator = new MariaDBQueryValidator();
  
  // Files to validate
  const filesToValidate = [
    'sql/init.sql',
    'server/services/DatabaseService.js',
    'src/services/DatabaseService.ts'
  ];

  // Validate each file
  for (const file of filesToValidate) {
    const fullPath = path.join(__dirname, file);
    
    try {
      await fs.promises.access(fullPath);
      
      if (file.endsWith('.sql')) {
        await validator.validateFile(fullPath);
      } else if (file.endsWith('.js') || file.endsWith('.ts')) {
        await validator.validateJavaScriptFile(fullPath);
      }
    } catch (error) {
      console.log(`⚠️  File not found: ${file}`);
    }
  }

  // Generate final report
  const report = validator.generateReport();
  
  // Save report to file
  const reportPath = path.join(__dirname, 'mariadb-validation-report.json');
  await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(report.errors.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
}

module.exports = MariaDBQueryValidator;