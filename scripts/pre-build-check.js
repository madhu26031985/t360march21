#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load .env for EAS build (Supabase config comes from env, not app.json)
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
} catch (e) { /* ignore */ }

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
  
  const supabaseUrl = expo.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = expo.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey) {
    console.log('✅ Supabase configuration found');
  } else {
    console.log('❌ Supabase configuration missing (set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env or app.json extra)');
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