const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Simplify configuration for better compatibility
config.resetCache = true;

module.exports = config;