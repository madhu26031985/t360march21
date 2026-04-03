#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Running post-build tasks for web...');

const distDir = path.join(__dirname, '..', 'dist');
const publicDir = path.join(__dirname, '..', 'public');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  console.error('❌ Error: dist directory not found. Build failed?');
  process.exit(1);
}

// Copy _redirects file for Netlify
const redirectsSource = path.join(publicDir, '_redirects');
const redirectsTarget = path.join(distDir, '_redirects');

if (fs.existsSync(redirectsSource)) {
  fs.copyFileSync(redirectsSource, redirectsTarget);
  console.log('✅ Copied _redirects to dist/');
} else {
  console.log('⚠️  No _redirects file found in public/');
}

// Create .htaccess for Apache hosting (served at /weblogin)
const htaccessContent = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /weblogin/
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /weblogin/index.html [L]
</IfModule>`;

const htaccessPath = path.join(distDir, '.htaccess');
fs.writeFileSync(htaccessPath, htaccessContent);
console.log('✅ Created .htaccess for Apache hosting');

// Reorganize dist for /weblogin subpath (Netlify, Vercel, or any host where root != /weblogin)
const webloginDir = path.join(distDir, 'weblogin');
fs.mkdirSync(webloginDir, { recursive: true });
const items = fs.readdirSync(distDir);
for (const item of items) {
  if (item === 'weblogin') continue;
  const src = path.join(distDir, item);
  const dest = path.join(webloginDir, item);
  fs.renameSync(src, dest);
}
console.log('✅ Reorganized output to dist/weblogin/ for /weblogin subpath');

// Android App Links: must live at https://<domain>/.well-known/assetlinks.json (site root),
// not under /weblogin, so copy after reorganize.
const assetLinksSrc = path.join(publicDir, '.well-known', 'assetlinks.json');
const assetLinksDestDir = path.join(distDir, '.well-known');
const assetLinksDest = path.join(assetLinksDestDir, 'assetlinks.json');
if (fs.existsSync(assetLinksSrc)) {
  const raw = fs.readFileSync(assetLinksSrc, 'utf8');
  if (raw.includes('REPLACE_WITH_PLAY_CONSOLE_APP_SIGNING_CERTIFICATE_SHA256')) {
    console.warn(
      '⚠️  public/.well-known/assetlinks.json still has SHA256 placeholder — Google Play domain verification will fail until you paste the App signing certificate SHA-256 from Play Console.'
    );
  }
  fs.mkdirSync(assetLinksDestDir, { recursive: true });
  fs.copyFileSync(assetLinksSrc, assetLinksDest);
  console.log('✅ Copied .well-known/assetlinks.json to dist/ (site root for Netlify)');
} else {
  console.log('⚠️  No public/.well-known/assetlinks.json — Android App Links verification will fail');
}

console.log('✨ Post-build tasks completed successfully!');
console.log('');
console.log('📦 Deploy the contents of dist/weblogin/ to your server\'s /weblogin path');
console.log('');
console.log('Next steps:');
console.log('1. Deploy the dist/ folder to your hosting provider');
console.log('2. Configure your domain DNS settings');
console.log('3. Update Supabase auth redirect URLs');
console.log('');
console.log('See WEB_DEPLOYMENT_WEOLOGIN.md for detailed instructions');
