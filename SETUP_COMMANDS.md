# 🚀 T360 - Complete Setup & Build Guide

## 📋 Prerequisites Setup

### 1. Install Required Tools
```bash
# Install Node.js 18+ (if not installed)
# Download from: https://nodejs.org/

# Install Expo CLI globally
npm install -g @expo/cli

# Install EAS CLI globally  
npm install -g eas-cli

# Login to EAS (create account if needed)
eas login
```

## 🔄 Fresh Repository Setup

### 2. Push Current Code to GitHub
```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit - Toastmaster360 mobile app"

# Add your GitHub repository as remote
git remote add origin https://github.com/yourusername/toastmaster360-mobile.git

# Push to GitHub
git push -u origin main
```

### 3. Clone Fresh Repository
```bash
# Clone to a new directory
git clone https://github.com/yourusername/toastmaster360-mobile.git toastmaster360-fresh

# Navigate to fresh directory
cd toastmaster360-fresh
```

## 📦 Fresh Installation

### 4. Install Dependencies
```bash
# Install all dependencies
npm install

# Verify installation
npm list --depth=0
```

### 5. Configure EAS Project
```bash
# Initialize EAS project
eas init

# Configure build profiles (if prompted)
eas build:configure
```

## 🔍 Pre-Build Validation

### 6. Run Validation Checks
```bash
# Check TypeScript compilation
npx tsc --noEmit

# Test app startup
npm run dev
# Press Ctrl+C to stop after confirming it starts

# Run Expo doctor
npx expo doctor

# Check for dependency issues
npx expo install --check
```

## 🏗️ APK Build Process

### 7. Build APK
```bash
# Clear any existing cache
eas build --platform android --profile preview --clear-cache

# Alternative: If above fails, try without cache flag
eas build --platform android --profile preview
```

### 8. Monitor Build Progress
```bash
# Check build status
eas build:list

# View build logs (if needed)
eas build:view [BUILD_ID]
```

## 🎯 Success Verification

### 9. Download & Test APK
1. **Download APK** from EAS dashboard
2. **Install on Android device** (enable "Install from unknown sources")
3. **Test core functionality:**
   - User registration/login
   - Club switching
   - Meeting operations
   - Role booking

## 🚨 Troubleshooting Commands

### If Build Fails:
```bash
# Emergency cleanup
npm run clean

# Or manual cleanup
rm -rf node_modules package-lock.json .expo
npm install

# Check for conflicts
npm audit fix

# Retry build with fresh cache
eas build --platform android --profile preview --clear-cache
```

### If Dependencies Fail:
```bash
# Fix dependency issues
npx expo install --fix

# Check for peer dependency issues
npm ls

# Force clean install
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

## 📊 Build Success Indicators

✅ **Build Completed** - No errors in EAS dashboard  
✅ **APK Generated** - Download link available  
✅ **App Installs** - Successfully installs on device  
✅ **App Launches** - Opens without crashes  
✅ **Core Features Work** - Login, navigation, basic functionality  

## 🎉 Final Steps

### 10. Production Build (Optional)
```bash
# For Play Store release
eas build --platform android --profile production
```

### 11. App Store Submission
```bash
# Submit to Google Play Store
eas submit --platform android
```

---

## 🔗 Useful Links

- **EAS Dashboard:** https://expo.dev/accounts/[username]/projects/toastmaster360-mobile
- **Build Logs:** Available in EAS dashboard
- **Documentation:** https://docs.expo.dev/build/introduction/

---

**🎯 Your app is ready for a successful build!**