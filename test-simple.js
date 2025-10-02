#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=================================');
console.log('MyMoney Application Test');
console.log('=================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        const result = fn();
        if (result) {
            console.log(`✓ ${name}`);
            passed++;
        } else {
            console.log(`✗ ${name}`);
            failed++;
        }
    } catch (error) {
        console.log(`✗ ${name} - ${error.message}`);
        failed++;
    }
}

// Test 1: Check Node.js version
test('Node.js version check', () => {
    const version = process.version;
    const majorVersion = parseInt(version.slice(1).split('.')[0]);
    console.log(`  Node.js version: ${version}`);
    return majorVersion >= 14;
});

// Test 2: Check package.json
test('package.json exists', () => {
    return fs.existsSync('package.json');
});

// Test 3: Check main server files
test('Server files exist', () => {
    const files = [
        'server/server.js',
        'server/app.js',
        'server/db-commonjs.js'
    ];
    
    for (const file of files) {
        if (!fs.existsSync(file)) {
            throw new Error(`Missing: ${file}`);
        }
    }
    return true;
});

// Test 4: Check service files
test('Service files exist', () => {
    const services = [
        'server/services/LoggerService.js',
        'server/services/CacheService.js',
        'server/services/HealthCheckService.js',
        'server/services/DatabaseInitService.js'
    ];
    
    for (const service of services) {
        if (!fs.existsSync(service)) {
            throw new Error(`Missing: ${service}`);
        }
    }
    return true;
});

// Test 5: Check environment file
test('Environment configuration', () => {
    if (fs.existsSync('.env')) {
        console.log('  .env file found');
        return true;
    } else if (fs.existsSync('.env.example')) {
        console.log('  Creating .env from .env.example');
        fs.copyFileSync('.env.example', '.env');
        return true;
    } else {
        throw new Error('No .env or .env.example found');
    }
});

// Test 6: Check node_modules
test('Dependencies installed', () => {
    if (fs.existsSync('node_modules')) {
        const stats = fs.readdirSync('node_modules');
        console.log(`  Found ${stats.length} packages`);
        return stats.length > 0;
    } else {
        console.log('  Installing dependencies...');
        try {
            execSync('npm install', { stdio: 'inherit' });
            return fs.existsSync('node_modules');
        } catch (error) {
            throw new Error('Failed to install dependencies');
        }
    }
});

// Test 7: Test service loading
test('Services can be loaded', () => {
    try {
        // Test if we can require the main services
        const LoggerService = require('./server/services/LoggerService');
        const CacheService = require('./server/services/CacheService');
        const HealthCheckService = require('./server/services/HealthCheckService');
        const DatabaseInitService = require('./server/services/DatabaseInitService');
        
        console.log('  All services loaded successfully');
        return true;
    } catch (error) {
        throw new Error(`Service loading failed: ${error.message}`);
    }
});

// Test 8: Test basic app loading
test('App can be loaded', () => {
    try {
        // Set required environment variables for testing
        process.env.NODE_ENV = 'test';
        process.env.PORT = '3001';
        process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
        process.env.DB_HOST = 'localhost';
        process.env.DB_USER = 'test';
        process.env.DB_PASSWORD = 'test';
        process.env.DB_NAME = 'mymoney_test';
        
        const App = require('./server/app');
        console.log('  App loaded successfully');
        return true;
    } catch (error) {
        throw new Error(`App loading failed: ${error.message}`);
    }
});

// Test 9: Check port availability
test('Port availability', () => {
    const net = require('net');
    const port = 3000;
    
    return new Promise((resolve) => {
        const server = net.createServer();
        
        server.listen(port, () => {
            server.close(() => {
                console.log(`  Port ${port} is available`);
                resolve(true);
            });
        });
        
        server.on('error', () => {
            console.log(`  Port ${port} is in use`);
            resolve(false);
        });
    });
});

// Summary
console.log('\n=================================');
console.log('TEST RESULTS SUMMARY');
console.log('=================================');
console.log(`Total tests: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed === 0) {
    console.log('\n✓ All tests passed! Your application is ready to run.');
    console.log('\nNext steps:');
    console.log('1. Configure your .env file with proper database settings');
    console.log('2. Start the server: npm run server:dev');
    console.log('3. Test the API endpoints');
} else {
    console.log('\n✗ Some tests failed. Please check the issues above.');
    process.exit(1);
}

// Create status file
const status = {
    timestamp: new Date().toISOString(),
    passed,
    failed,
    total: passed + failed,
    success: failed === 0
};

fs.writeFileSync('test-status.json', JSON.stringify(status, null, 2));
console.log('\nTest status saved to: test-status.json');