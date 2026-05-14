#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Running post-build tasks for web...');

const distDir = path.join(__dirname, '..', 'dist');
const publicDir = path.join(__dirname, '..', 'public');

async function generateDefaultAgendaOgJpeg(outFile) {
  const sharp = require('sharp');
  /** Maroon + gold T-360 style; 1200×630 for Open Graph. Replace by placing public/images/og-images/agenda-preview.jpg */
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3d0f18"/>
      <stop offset="55%" stop-color="#5c1a2a"/>
      <stop offset="100%" stop-color="#2a0a12"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="8" fill="#c9a227"/>
  <text x="60" y="120" font-family="Georgia, Times New Roman, serif" font-size="52" font-weight="700" fill="#f5e6c8">T-360</text>
  <text x="60" y="200" font-family="Georgia, Times New Roman, serif" font-size="38" fill="#e8d5a8">Meeting agenda</text>
  <text x="60" y="270" font-family="system-ui, Segoe UI, sans-serif" font-size="28" fill="#d4c4b0">Smart &amp; automated club meetings</text>
  <rect x="60" y="340" rx="10" ry="10" width="220" height="48" fill="#c9a227" opacity="0.95"/>
  <text x="170" y="374" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#3d0f18">Smart &amp; Automated</text>
  <rect x="700" y="80" rx="24" ry="24" width="420" height="480" fill="#1a0a0e" stroke="#c9a227" stroke-width="3" opacity="0.9"/>
  <rect x="730" y="120" width="360" height="56" rx="8" fill="#2d1218"/>
  <rect x="730" y="200" width="280" height="20" rx="4" fill="#4a2a32"/>
  <rect x="730" y="240" width="320" height="20" rx="4" fill="#4a2a32"/>
  <rect x="730" y="280" width="240" height="20" rx="4" fill="#4a2a32"/>
  <text x="720" y="560" font-family="system-ui, sans-serif" font-size="20" fill="#a89070">Preview — open link for full agenda</text>
  <text x="60" y="580" font-family="system-ui, sans-serif" font-size="22" fill="#9a7b60">Powered by T-360</text>
</svg>`.trim();
  await sharp(Buffer.from(svg, 'utf8')).jpeg({ quality: 88, mozjpeg: true }).toFile(outFile);
}

async function main() {
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

  // Open Graph static image at site root: /images/og-images/agenda-preview.jpg (for crawlers + og:image)
  const ogOutDir = path.join(distDir, 'images', 'og-images');
  const ogOutFile = path.join(ogOutDir, 'agenda-preview.jpg');
  const customOgSrc = path.join(publicDir, 'images', 'og-images', 'agenda-preview.jpg');
  try {
    fs.mkdirSync(ogOutDir, { recursive: true });
    if (fs.existsSync(customOgSrc)) {
      fs.copyFileSync(customOgSrc, ogOutFile);
      console.log('✅ Copied public/images/og-images/agenda-preview.jpg → dist/images/og-images/');
    } else {
      await generateDefaultAgendaOgJpeg(ogOutFile);
      console.log('✅ Generated default dist/images/og-images/agenda-preview.jpg (replace via public/ path to customize)');
    }
  } catch (e) {
    console.warn('⚠️  Could not create OG agenda image:', e && e.message ? e.message : e);
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
