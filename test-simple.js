#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('=================================');
console.log('MyMoney Application Test');
console.log('=================================\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        const result = await fn();
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

async function runTests() {
    // Test 1: Check Node.js version
    await test('Node.js version check', () => {
        const version = process.version;
        const majorVersion = parseInt(version.slice(1).split('.')[0]);
        console.log(`  Node.js version: ${version}`);
        return majorVersion >= 14;
    });

    // Test 2: Check package.json
    await test('package.json exists', () => {
        return fs.existsSync('package.json');
    });

    // Test 3: Check main server files
    await test('Server files exist', () => {
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
    await test('Service files exist', () => {
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
    await test('Environment configuration', () => {
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
    await test('Dependencies installed', () => {
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
    await test('Services can be loaded', async () => {
        try {
            // Test if we can import the main services
            await import('./server/services/LoggerService.js');
            await import('./server/services/CacheService.js');
            await import('./server/services/HealthCheckService.js');
            await import('./server/services/DatabaseInitService.js');
            
            console.log('  All services loaded successfully');
            return true;
        } catch (error) {
            throw new Error(`Service loading failed: ${error.message}`);
        }
    });

    // Test 8: Test basic app loading
    await test('App can be loaded', async () => {
        try {
            // Set required environment variables for testing
            process.env.NODE_ENV = 'test';
            process.env.PORT = '3001';
            process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
            process.env.DB_HOST = 'localhost';
            process.env.DB_USER = 'test';
            process.env.DB_PASSWORD = 'test';
            process.env.DB_NAME = 'mymoney_test';
            
            await import('./server/app.js');
            console.log('  App loaded successfully');
            return true;
        } catch (error) {
            throw new Error(`App loading failed: ${error.message}`);
        }
    });

    // Test 9: Check port availability
    await test('Port availability', async () => {
        const { default: net } = await import('net');
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
}

// Run tests
runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});