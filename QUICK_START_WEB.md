# T360 Web - Quick Start Guide

Your T360 Toastmasters app is now ready for web deployment at **www.t360.in**!

## What's Been Done

✅ Web build configured in `app.json`
✅ Login page accessible at `/login`
✅ Routing properly configured for SPA
✅ Deep linking configured for your domain
✅ Build scripts set up with post-build optimization
✅ Deployment configuration files created:
   - `netlify.toml` for Netlify
   - `vercel.json` for Vercel
   - `.htaccess` auto-generated for Apache
   - `_redirects` auto-generated for Netlify

## Deploy in 5 Minutes (Netlify - Easiest)

1. **Build the app**:
   ```bash
   npm run build:web
   ```

2. **Sign up for Netlify**: https://www.netlify.com

3. **Deploy**:
   - Drag and drop the `dist` folder into Netlify
   - Or use Netlify CLI: `cd dist && netlify deploy --prod`

4. **Configure Domain**:
   - Go to Site settings → Domain management
   - Add `www.t360.in` and `t360.in`
   - Update your domain's DNS as instructed

5. **Configure Supabase**:
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Add to "Site URL": `https://www.t360.in`
   - Add to "Redirect URLs":
     ```
     https://www.t360.in/*
     https://t360.in/*
     ```

Done! Your app is live at **www.t360.in/login** 🎉

## Test Your Deployment

After deploying, test these URLs:

- ✅ `https://www.t360.in` - Splash screen → Auto redirect
- ✅ `https://www.t360.in/login` - Login page
- ✅ `https://www.t360.in/signup` - Signup page
- ✅ Authentication flow - Sign in/sign up
- ✅ Deep links from email verification

## Need More Options?

See `WEB_DEPLOYMENT_GUIDE.md` for:
- Vercel deployment
- Traditional hosting (Apache/Nginx)
- Continuous deployment from GitHub
- Troubleshooting guide

## Commands

```bash
# Start development server
npm run web

# Build for production
npm run build:web

# The dist/ folder is ready to deploy
```

## Important Notes

1. **Routing**: All routes (like `/login`) will work correctly thanks to the SPA configuration
2. **Authentication**: Email verification links will redirect to your domain
3. **Build Output**: Always deploy the `dist` folder, not the project root
4. **Environment**: Your Supabase credentials are already configured

## Support

For issues or questions, refer to:
- Full deployment guide: `WEB_DEPLOYMENT_GUIDE.md`
- Expo Router docs: https://docs.expo.dev/router/
- Supabase docs: https://supabase.com/docs
