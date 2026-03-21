#!/usr/bin/env node

const { execSync } = require('child_process');

const platform = process.argv[2] || 'android';
const profile = process.argv[3] || 'preview';

console.log(`🔍 Monitoring EAS build for ${platform} (${profile} profile)...`);

try {
  // Get the latest build status
  const buildList = execSync('eas build:list --limit=1 --json', { encoding: 'utf8' });
  const builds = JSON.parse(buildList);
  
  if (builds.length === 0) {
    console.log('❌ No builds found');
    process.exit(1);
  }
  
  const latestBuild = builds[0];
  
  console.log('\n📊 Latest Build Status:');
  console.log(`Build ID: ${latestBuild.id}`);
  console.log(`Status: ${latestBuild.status}`);
  console.log(`Platform: ${latestBuild.platform}`);
  console.log(`Profile: ${latestBuild.buildProfile}`);
  console.log(`Created: ${new Date(latestBuild.createdAt).toLocaleString()}`);
  
  if (latestBuild.status === 'finished') {
    console.log(`✅ Build completed successfully!`);
    console.log(`📱 Download URL: ${latestBuild.artifacts?.buildUrl || 'Check EAS dashboard'}`);
  } else if (latestBuild.status === 'errored') {
    console.log(`❌ Build failed`);
    console.log(`Error: ${latestBuild.error || 'Check EAS dashboard for details'}`);
  } else {
    console.log(`⏳ Build is ${latestBuild.status}...`);
    console.log('Monitor progress at: https://expo.dev/accounts/[username]/projects/toastmaster360-mobile');
  }
  
} catch (error) {
  console.log('❌ Error monitoring build:', error.message);
  console.log('💡 You can check build status manually with: eas build:list');
}