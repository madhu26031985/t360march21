# T-360 Mobile App

A comprehensive mobile application for Toastmasters International clubs built with Expo and React Native.

## 🚀 Features

- **User Authentication** - Secure login with PIN support
- **Club Management** - Multi-club support with role-based access
- **Meeting Operations** - Role booking, attendance, and collaboration
- **Speech Repository** - Manage and organize speech documents
- **Pathways Tracking** - Track Toastmasters educational progress
- **Live Voting** - Participate in club polls and voting sessions
- **Tag Reports** - Timer, Ah Counter, and Grammarian reports
- **Admin Panel** - Complete club administration tools

## 🛠️ Tech Stack

- **Framework:** Expo SDK 53 with Expo Router
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth with PIN support
- **UI:** React Native with custom theming
- **Icons:** Lucide React Native
- **Storage:** AsyncStorage for local data

## 📱 Supported Platforms

- ✅ Android (Primary)
- ✅ iOS 
- ✅ Web (Limited features)

## 🏗️ Build Instructions

### Prerequisites
- Node.js 18+
- Expo CLI
- EAS CLI
- Android Studio (for Android builds)
- Xcode (for iOS builds)

### Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd toastmaster360-mobile

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building APK
```bash
# Build preview APK
eas build --platform android --profile preview

# Build production APK
eas build --platform android --profile production
```

## 🔧 Configuration

### Environment Variables
The app uses Supabase for backend services. Use `.env` (see `app.config.js`) with:

- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL (often `https://<project-ref>.supabase.co`)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — anon public key

**Web + Realtime / WebSocket errors:** If `EXPO_PUBLIC_SUPABASE_URL` points at a **proxy** (e.g. `*.workers.dev`) that only forwards HTTPS and **not** `wss://…/realtime/v1/websocket`, the browser will log WebSocket failures and live subscriptions won’t work. Fixes:

1. Prefer setting `EXPO_PUBLIC_SUPABASE_URL` to your real `https://<project-ref>.supabase.co` URL (Supabase allows browser CORS for the anon key).
2. Or set **`EXPO_PUBLIC_SUPABASE_WEB_URL`** to `https://<project-ref>.supabase.co` so **web** uses the real host for REST + Realtime while native builds can keep a different `EXPO_PUBLIC_SUPABASE_URL` if you need that.

You can still mirror keys in `app.json` `extra` for legacy tooling:

```json
{
  "extra": {
    "supabaseUrl": "your-supabase-url",
    "supabaseAnonKey": "your-supabase-anon-key"
  }
}
```

### Database Setup
The app requires a Supabase project with the following main tables:
- `app_user_profiles` - User information
- `clubs` - Club data
- `app_club_user_relationship` - User-club relationships
- `app_club_meeting` - Meeting management
- `app_meeting_roles_management` - Role assignments
- And many more for full functionality

## 📂 Project Structure

```
app/
├── (tabs)/           # Tab navigation screens
├── admin/           # Admin panel screens
├── *.tsx           # Individual screens
contexts/           # React contexts (Auth, Theme)
components/         # Reusable components
lib/               # Utilities and configurations
supabase/          # Database migrations and functions
hooks/             # Custom React hooks
types/             # TypeScript type definitions
```

## 🎯 Key Features by Role

### For Members
- View club information and members
- Book roles for meetings
- Track personal pathways progress
- Participate in live voting
- Access club resources

### For ExComm (Executive Committee)
- Complete club administration
- Meeting management
- User invitation and management
- Poll creation and management
- Resource management

### For Tag Team Roles
- Timer reports with stopwatch
- Ah Counter filler word tracking
- Grammarian feedback tools

## 🔐 Security Features

- Supabase Row Level Security (RLS)
- Role-based access control
- PIN authentication option
- Secure password reset flow
- Email invitation system

## 📱 Mobile-First Design

- Responsive design for all screen sizes
- Native mobile interactions
- Optimized for touch interfaces
- Platform-specific adaptations

## 🚀 Deployment

The app is configured for deployment via EAS Build:
- **Preview builds** for testing
- **Production builds** for app stores
- **Web deployment** for browser access

## 📞 Support

For technical support or questions:
- Email: support@t360.in
- Documentation: [Coming Soon]

## 📄 License

[Your License Here]

---

Built with ❤️ for the Toastmasters community