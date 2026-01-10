#!/usr/bin/env node

/**
 * Pre-flight check for MDA Shift Scheduler
 * Run this before starting the application to verify everything is set up correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 MDA Shift Scheduler - Pre-flight Check\n');
console.log('=' .repeat(50));

let hasErrors = false;

// Check 1: Node.js version
console.log('\n📦 Checking Node.js version...');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
if (majorVersion >= 16) {
    console.log(`✅ Node.js ${nodeVersion} - OK`);
} else {
    console.log(`❌ Node.js ${nodeVersion} - Need version 16 or higher`);
    hasErrors = true;
}

// Check 2: Package dependencies
console.log('\n📚 Checking dependencies...');
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
    console.log('✅ package.json found');
    
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
        console.log('✅ node_modules found');
    } else {
        console.log('❌ node_modules not found - Run: npm install');
        hasErrors = true;
    }
} else {
    console.log('❌ package.json not found');
    hasErrors = true;
}

// Check 3: Environment file
console.log('\n🔐 Checking environment configuration...');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    console.log('✅ .env file found');
    
    // Read and validate .env
    const envContent = fs.readFileSync(envPath, 'utf8');
    const hasUrl = envContent.includes('SUPABASE_URL=') && !envContent.includes('your_supabase_url_here');
    const hasKey = envContent.includes('SUPABASE_KEY=') && !envContent.includes('your_supabase_anon_key_here');
    
    if (hasUrl) {
        console.log('✅ SUPABASE_URL is set');
    } else {
        console.log('❌ SUPABASE_URL not configured');
        hasErrors = true;
    }
    
    if (hasKey) {
        console.log('✅ SUPABASE_KEY is set');
    } else {
        console.log('❌ SUPABASE_KEY not configured');
        hasErrors = true;
    }
} else {
    console.log('❌ .env file not found - Copy .env.example to .env and configure it');
    hasErrors = true;
}

// Check 4: Required directories
console.log('\n📁 Checking directory structure...');
const requiredDirs = [
    'config',
    'routes',
    'public',
    'public/css',
    'public/js',
    'database',
    'scripts'
];

requiredDirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (fs.existsSync(dirPath)) {
        console.log(`✅ ${dir}/ exists`);
    } else {
        console.log(`❌ ${dir}/ not found`);
        hasErrors = true;
    }
});

// Check 5: Required files
console.log('\n📄 Checking required files...');
const requiredFiles = [
    'server.js',
    'config/database.js',
    'routes/auth.js',
    'routes/employees.js',
    'routes/schedules.js',
    'routes/export.js',
    'public/css/style.css',
    'public/js/common.js',
    'public/js/login.js',
    'public/js/dashboard.js',
    'public/js/employees.js',
    'public/js/schedule.js',
    'public/login.html',
    'public/index.html',
    'public/employees.html',
    'public/schedule.html',
    'database/schema.sql',
    'scripts/setup-admin.js'
];

requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} not found`);
        hasErrors = true;
    }
});

// Final summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
    console.log('\n❌ Pre-flight check FAILED');
    console.log('\nPlease fix the errors above before starting the application.');
    console.log('\nCommon fixes:');
    console.log('  - Run: npm install');
    console.log('  - Create .env file from .env.example');
    console.log('  - Configure Supabase credentials in .env');
    console.log('\nSee QUICK_START.md for detailed instructions.');
} else {
    console.log('\n✅ Pre-flight check PASSED');
    console.log('\nAll systems ready!');
    console.log('\nNext steps:');
    console.log('  1. Run database schema in Supabase: database/schema.sql');
    console.log('  2. Create admin user: npm run setup-admin');
    console.log('  3. Start the server: npm start');
    console.log('\nSee QUICK_START.md for detailed instructions.');
}
console.log('');

process.exit(hasErrors ? 1 : 0);
