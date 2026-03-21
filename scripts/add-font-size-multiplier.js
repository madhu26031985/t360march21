#!/usr/bin/env node
/**
 * Script to add maxFontSizeMultiplier to all Text components in the project
 * This prevents text overflow when users have large font sizes enabled on their devices
 *
 * Usage: node scripts/add-font-size-multiplier.js
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_MULTIPLIER = '1.3';

// Directories to search
const SEARCH_DIRS = [
  path.join(__dirname, '../app'),
  path.join(__dirname, '../components'),
];

// Files to skip
const SKIP_FILES = [
  'node_modules',
  '.git',
  '.expo',
  'build',
  'dist',
];

function shouldSkipPath(filePath) {
  return SKIP_FILES.some(skip => filePath.includes(skip));
}

function getAllTsxFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;

  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);

    if (shouldSkipPath(filePath)) return;

    if (fs.statSync(filePath).isDirectory()) {
      fileList = getAllTsxFiles(filePath, fileList);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Pattern to match <Text ...> but not if it already has maxFontSizeMultiplier
  const textRegex = /<Text\s+([^>]*?)(?<!maxFontSizeMultiplier={[^}]+})>/g;

  const newContent = content.replace(textRegex, (match, attributes) => {
    // Check if this Text component already has maxFontSizeMultiplier
    if (attributes.includes('maxFontSizeMultiplier')) {
      return match;
    }

    modified = true;
    // Add maxFontSizeMultiplier before the closing >
    return `<Text ${attributes.trim()} maxFontSizeMultiplier={${DEFAULT_MULTIPLIER}}>`;
  });

  if (modified) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ Updated: ${filePath}`);
    return 1;
  }

  return 0;
}

function main() {
  console.log('🔍 Searching for .tsx files...\n');

  let allFiles = [];
  SEARCH_DIRS.forEach(dir => {
    allFiles = allFiles.concat(getAllTsxFiles(dir));
  });

  console.log(`📝 Found ${allFiles.length} files to process\n`);

  let updatedCount = 0;

  allFiles.forEach(file => {
    updatedCount += processFile(file);
  });

  console.log(`\n✨ Done! Updated ${updatedCount} files`);
  console.log(`\n💡 Tip: Review the changes and adjust maxFontSizeMultiplier values as needed:`);
  console.log(`   - Use 1.1-1.2 for UI elements that must not overflow (headers, buttons)`);
  console.log(`   - Use 1.3-1.5 for body text and descriptions`);
}

main();
