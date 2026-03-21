#!/usr/bin/env node
/**
 * Test Supabase connection using .env configuration.
 * Run: node scripts/test-supabase-connection.js
 */

const fs = require('fs');
const path = require('path');

// Load .env manually (no dotenv dependency)
delete process.env.EXPO_PUBLIC_SUPABASE_URL;
delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  });
}

const { createClient } = require('@supabase/supabase-js');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('❌ Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

console.log('🔌 Testing Supabase connection...');
console.log('   URL:', url);
console.log('   Proxy:', url?.includes('workers.dev') ? 'Yes' : 'No');

const supabase = createClient(url, key);

async function test() {
  try {
    // Simple health check: query a table that exists (clubs is typically public)
    const { data, error } = await supabase.from('clubs').select('id').limit(1);
    
    if (error) {
      console.error('❌ Connection failed:', error.message);
      if (error.code) console.error('   Code:', error.code);
      process.exit(1);
    }
    
    console.log('✅ Supabase connection successful!');
    console.log('   Response:', data?.length >= 0 ? `${data?.length} row(s) returned` : 'OK');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

test();
