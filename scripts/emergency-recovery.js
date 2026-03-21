#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🚨 Emergency Recovery Script for T-360');
console.log('This script will attempt to fix common build issues...\n');

// Function to run command safely
function runCommand(command, description) {
  try {
    console.log(`🔧 ${description}...`);
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed\n`);
    return true;
  } catch (error) {
    console.log(`❌ ${description} failed: ${error.message}\n`);
    return false;
  }
}

// Recovery steps
console.log('Step 1: Clearing all caches...');
runCommand('rm -rf node_modules package-lock.json .expo', 'Removing node_modules and caches');

console.log('Step 2: Reinstalling dependencies...');
runCommand('npm install', 'Installing fresh dependencies');

console.log('Step 3: Checking Expo installation...');
runCommand('npx expo install --check', 'Checking Expo dependencies');

console.log('Step 4: Running Expo doctor...');
runCommand('npx expo doctor', 'Running Expo diagnostics');

console.log('Step 5: Checking TypeScript...');
runCommand('npx tsc --noEmit', 'TypeScript compilation check');

console.log('Step 6: Testing app startup...');
console.log('💡 You can now try building again with: npm run build:safe');

console.log('\n🎯 Recovery completed!');
console.log('If issues persist, try:');
console.log('1. eas build --platform android --profile preview --clear-cache');
console.log('2. Check EAS dashboard for detailed error logs');
console.log('3. Ensure you are logged into EAS: eas login');