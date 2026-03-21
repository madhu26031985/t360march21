// Injects Supabase config from env (no secrets in app.json)
// Required: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
const base = require('./app.json');

module.exports = {
  ...base,
  expo: {
    ...base.expo,
    extra: {
      ...base.expo.extra,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || base.expo.extra?.supabaseUrl || '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || base.expo.extra?.supabaseAnonKey || '',
    },
  },
};
