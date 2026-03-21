#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Running pre-build checks for T-360...');

// Check if required files exist
const requiredFiles = [
  'app.json',
  'package.json',
  'eas.json',
  'app/_layout.tsx',
  'app/(tabs)/_layout.tsx'
];

let allFilesExist = true;

console.log('\n📁 Checking required files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

// Check package.json for required dependencies
console.log('\n📦 Checking dependencies...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = [
    'expo',
    'expo-router',
    'react',
    'react-native',
    '@supabase/supabase-js'
  ];

  requiredDeps.forEach(dep => {
    if (packageJson.dependencies[dep]) {
      console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
    } else {
      console.log(`❌ ${dep} - MISSING`);
      allFilesExist = false;
    }
  });
} catch (error) {
  console.log('❌ Error reading package.json');
  allFilesExist = false;
}

// Check app.json configuration
console.log('\n⚙️  Checking app.json configuration...');
try {
  const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  const expo = appJson.expo;
  
  if (expo.name) {
    console.log(`✅ App name: ${expo.name}`);
  } else {
    console.log('❌ App name missing');
    allFilesExist = false;
  }
  
  if (expo.slug) {
    console.log(`✅ App slug: ${expo.slug}`);
  } else {
    console.log('❌ App slug missing');
    allFilesExist = false;
  }
  
  if (expo.android?.package) {
    console.log(`✅ Android package: ${expo.android.package}`);
  } else {
    console.log('❌ Android package missing');
    allFilesExist = false;
  }
  
  if (expo.extra?.supabaseUrl && expo.extra?.supabaseAnonKey) {
    console.log('✅ Supabase configuration found');
  } else {
    console.log('❌ Supabase configuration missing');
    allFilesExist = false;
  }
} catch (error) {
  console.log('❌ Error reading app.json');
  allFilesExist = false;
}

// Check EAS configuration
console.log('\n🏗️  Checking EAS configuration...');
try {
  const easJson = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
  
  if (easJson.build?.preview) {
    console.log('✅ Preview build profile configured');
  } else {
    console.log('❌ Preview build profile missing');
    allFilesExist = false;
  }
  
  if (easJson.build?.production) {
    console.log('✅ Production build profile configured');
  } else {
    console.log('❌ Production build profile missing');
    allFilesExist = false;
  }
} catch (error) {
  console.log('❌ Error reading eas.json');
  allFilesExist = false;
}

// Final result
console.log('\n🎯 Pre-build check results:');
if (allFilesExist) {
  console.log('✅ All checks passed! Ready to build APK.');
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Please fix the issues above before building.');
  process.exit(1);
}