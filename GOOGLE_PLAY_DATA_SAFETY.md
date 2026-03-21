# Google Play Data Safety Declaration
## T360 - Toastmaster Management App

### App Overview
T360 is a Toastmasters club management application that helps clubs organize meetings, track member progress, and manage club activities.

---

## DATA COLLECTION SUMMARY

### ✅ Data Collected (With User Consent)

#### 1. **Personal Information**
- **Email Address** - Required for account creation and authentication
- **Full Name** - Required for member identification
- **Phone Number** - Optional, user-provided
- **Profile Picture/Avatar** - Optional, user-provided via device camera or photo library

#### 2. **Optional Profile Information**
- Location (text)
- Occupation (text)
- Interests (text)
- Achievements (text)
- About section (text)

#### 3. **Social Media Links** (Optional, User-Provided URLs)
- Facebook
- LinkedIn
- Instagram
- Twitter/X
- YouTube

#### 4. **Toastmasters Club Data**
- Toastmaster ID
- Member since date
- Mentor name
- Club memberships
- Meeting attendance records
- Speech delivery records
- Role completion records
- Evaluations given/received
- Meeting participation data

#### 5. **Authentication & Session Data**
- User authentication tokens (managed by Supabase Auth)
- Session information for app access
- Last login timestamps

---

## ❌ DATA NOT COLLECTED

The app **DOES NOT** collect:
- ❌ Device IDs or Advertising IDs
- ❌ IDFA (iOS Identifier for Advertisers)
- ❌ AAID (Android Advertising ID)
- ❌ Device fingerprints
- ❌ Push notification tokens
- ❌ Location coordinates (GPS)
- ❌ Contacts from device
- ❌ SMS or call logs
- ❌ Calendar data
- ❌ Files from device storage (except photos when explicitly selected by user)
- ❌ Browsing history
- ❌ App usage analytics from other apps
- ❌ Financial information
- ❌ Health & fitness data

---

## DATA USAGE

### How We Use Collected Data
1. **Account Management** - Email and name for user identification and authentication
2. **Profile Display** - User-provided information displayed in club directory
3. **Meeting Organization** - Track attendance, roles, and participation
4. **Progress Tracking** - Monitor speech delivery and skill development
5. **Club Communication** - Share member profiles with fellow club members

### Data Sharing
- Data is shared **ONLY** within the user's Toastmasters club(s)
- No data is sold to third parties
- No data is shared with advertisers
- No data is used for marketing purposes

---

## SECURITY & PRIVACY

### Data Storage
- All data is securely stored using Supabase (PostgreSQL database with encryption)
- Authentication managed by Supabase Auth with secure token-based sessions
- Row Level Security (RLS) policies ensure users can only access their authorized data

### User Control
- Users can update or delete their profile information anytime
- Users can request complete account deletion through the app settings
- Users control what optional information they provide

### Permissions Required

#### Android Permissions:
```
- INTERNET - Required for app functionality
- ACCESS_NETWORK_STATE - Check network connectivity
```

#### iOS Permissions:
- Photo Library Access - Only when user wants to select profile picture
- Camera Access - Only when user wants to take profile picture

---

## CHANGES FROM PREVIOUS VERSION

### Removed in Version 56.0.0+
- ✅ Removed expo-notifications dependency
- ✅ Removed POST_NOTIFICATIONS permission (Android)
- ✅ Removed push notification entitlements (iOS)
- ✅ No longer collects or stores device tokens

**Result:** The app no longer collects "Device or other IDs" category data.

---

## COMPLIANCE

### Google Play Data Safety
- ✅ No device IDs collected
- ✅ No advertising IDs collected
- ✅ All data collection is transparent and with user consent
- ✅ Users have full control over their data

### Privacy Policy
Available at: https://t360.in/privacy (Update this URL with your actual privacy policy)

---

## GOOGLE PLAY STORE DECLARATION

When filling out the Data Safety form in Google Play Console:

### Data Types to Declare:

1. **Personal Info**
   - ✅ Name
   - ✅ Email address
   - ✅ Phone number (optional)
   - Purpose: Account creation, app functionality
   - Shared: Within user's club only

2. **Photos and Videos**
   - ✅ Photos (optional - profile picture only)
   - Purpose: Profile display
   - Shared: Within user's club only

3. **App Activity**
   - ✅ In-app actions (meeting attendance, role completion)
   - Purpose: Progress tracking
   - Shared: Within user's club only

### Data Types to Mark as NOT Collected:

- ❌ Location
- ❌ Web browsing
- ❌ App activity (from other apps)
- ❌ Device or other IDs ← **THIS IS THE KEY ONE**
- ❌ Contacts
- ❌ Calendar
- ❌ Files and docs (except user-selected photos)
- ❌ Messages
- ❌ Audio
- ❌ Music
- ❌ Health & Fitness
- ❌ Financial info

---

## CONTACT

For data privacy inquiries:
- Support: https://t360.in/support
- WhatsApp: +91 9597491113

---

**Last Updated:** January 30, 2026
**App Version:** 56.0.0
**Bundle ID (Android):** com.toastmaster360.mobile
**Bundle ID (iOS):** com.toastmaster360.mobile
