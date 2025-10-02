const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=================================');
console.log('MyMoney Application Check');
console.log('=================================\n');

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
    console.error('❌ package.json not found. Are you in the right directory?');
    process.exit(1);
}

console.log('✅ Found package.json');

// Check if node_modules exists
if (!fs.existsSync('node_modules')) {
    console.log('⚠️  node_modules not found. Installing dependencies...');
    try {
        console.log('Running npm install...');
        execSync('npm install', { stdio: 'inherit' });
        console.log('✅ Dependencies installed successfully');
    } catch (error) {
        console.error('❌ Failed to install dependencies:', error.message);
        process.exit(1);
    }
} else {
    console.log('✅ node_modules directory found');
}

// Check .env file
if (!fs.existsSync('.env')) {
    if (fs.existsSync('.env.example')) {
        console.log('⚠️  .env not found. Creating from .env.example...');
        fs.copyFileSync('.env.example', '.env');
        console.log('✅ .env file created');
    } else {
        console.error('❌ Neither .env nor .env.example found');
        process.exit(1);
    }
} else {
    console.log('✅ .env file found');
}

// Check server files
const serverFiles = [
    'server/server.js',
    'server/app.js',
    'server/services/LoggerService.js',
    'server/services/CacheService.js',
    'server/services/HealthCheckService.js',
    'server/services/DatabaseInitService.js'
];

let missingFiles = [];
for (const file of serverFiles) {
    if (!fs.existsSync(file)) {
        missingFiles.push(file);
    }
}

if (missingFiles.length > 0) {
    console.error('❌ Missing server files:', missingFiles.join(', '));
    process.exit(1);
} else {
    console.log('✅ All server files found');
}

// Try to load the main services
try {
    console.log('🔍 Testing service loading...');
    
    // Set minimal environment for testing
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret';
    process.env.DB_HOST = 'localhost';
    process.env.DB_USER = 'test';
    process.env.DB_PASSWORD = 'test';
    process.env.DB_NAME = 'test';
    
    const LoggerService = require('./server/services/LoggerService');
    console.log('  ✅ LoggerService loaded');
    
    const CacheService = require('./server/services/CacheService');
    console.log('  ✅ CacheService loaded');
    
    const HealthCheckService = require('./server/services/HealthCheckService');
    console.log('  ✅ HealthCheckService loaded');
    
    const DatabaseInitService = require('./server/services/DatabaseInitService');
    console.log('  ✅ DatabaseInitService loaded');
    
    console.log('✅ All services loaded successfully');
    
} catch (error) {
    console.error('❌ Service loading failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
}

console.log('\n=================================');
console.log('✅ Application check completed successfully!');
console.log('=================================');

console.log('\nNext steps:');
console.log('1. Configure your .env file with proper database settings');
console.log('2. Start the server: npm run server:dev');
console.log('3. Access the application at http://localhost:3000');

console.log('\nAvailable scripts:');
console.log('- npm run server:dev    (Development mode)');
console.log('- npm run server:prod   (Production mode)');
console.log('- npm run health        (Check system health)');
console.log('- npm run db:status     (Check database status)');