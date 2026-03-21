# 🏗️ Build Guide for Toastmaster360

## Pre-Build Checklist

Before building the APK, ensure all these items are checked:

### ✅ Environment Setup
- [ ] Node.js 18+ installed
- [ ] Expo CLI installed globally (`npm install -g @expo/cli`)
- [ ] EAS CLI installed globally (`npm install -g eas-cli`)
- [ ] EAS account configured (`eas login`)

### ✅ Project Validation
- [ ] All dependencies installed (`npm install`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] App starts successfully (`npm run dev`)
- [ ] Supabase connection working

### ✅ Build Configuration
- [ ] `app.json` properly configured
- [ ] Bundle identifier set for Android
- [ ] All required permissions listed
- [ ] Build profiles configured in `eas.json`

## 🚀 Build Commands

### Development Build
```bash
eas build --platform android --profile development
```

### Preview Build (Recommended for testing)
```bash
eas build --platform android --profile preview
```

### Production Build
```bash
eas build --platform android --profile production
```

## 🔧 Troubleshooting Common Build Issues

### Memory Issues
```bash
# Clear all caches
npm run clean
# Or manually:
rm -rf node_modules package-lock.json .expo
npm install
```

### Dependency Conflicts
```bash
# Check for dependency issues
npx expo install --check
# Fix automatically
npx expo install --fix
```

### Build Timeout
- Try building during off-peak hours
- Use `--clear-cache` flag
- Consider upgrading EAS plan for faster builds

### Network Issues
- Check internet connection
- Try building from different network
- Verify EAS service status

## 📱 Testing the APK

1. **Download** the APK from EAS dashboard
2. **Install** on Android device (enable "Install from unknown sources")
3. **Test** core functionality:
   - User registration/login
   - Club switching
   - Meeting operations
   - Role booking
   - Reports generation

## 🎯 Build Success Indicators

- ✅ Build completes without errors
- ✅ APK size is reasonable (< 50MB)
- ✅ App launches on device
- ✅ Authentication works
- ✅ Database connections successful
- ✅ All major features functional

## 📊 Build Monitoring

Monitor your build progress:
1. **EAS Dashboard:** https://expo.dev/accounts/[username]/projects/toastmaster360-mobile
2. **Build Logs:** Available in dashboard
3. **Build Artifacts:** APK download links

## 🔄 Continuous Integration

For automated builds, consider setting up:
- GitHub Actions with EAS
- Automated testing pipeline
- Version management
- Release automation

---

**Need Help?** Check the Expo documentation or contact support.