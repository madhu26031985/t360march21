#!/usr/bin/env node
/**
 * Start the full T360 app in the browser (Expo web).
 * Ensures Supabase env is present before booting (see .env.example).
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!url || !key) {
  console.error('');
  console.error('Supabase is not configured for local web.');
  console.error('Create a `.env` file in the project root (see `.env.example`) with:');
  console.error('  EXPO_PUBLIC_SUPABASE_URL');
  console.error('  EXPO_PUBLIC_SUPABASE_ANON_KEY');
  console.error('');
  process.exit(1);
}

const child = spawn('npx', ['expo', 'start', '--web', '--clear'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, CI: '0', EXPO_NO_TELEMETRY: '1' },
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
