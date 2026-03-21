# T360 Web Deployment Guide

This guide will help you deploy your T360 Toastmasters app to the web using your domain **www.t360.in**.

## Prerequisites

- Node.js and npm installed
- Access to your domain DNS settings
- Account on a hosting platform (Netlify, Vercel, or similar)

## Build the Web Version

The web version has already been configured. To build it, run:

```bash
npm run build:web
```

This will create a `dist` folder containing all the necessary files for deployment.

## Hosting Options

### Option 1: Netlify (Recommended)

1. **Install Netlify CLI** (optional):
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy via Netlify UI**:
   - Go to [Netlify](https://www.netlify.com)
   - Sign up or log in
   - Click "Add new site" → "Deploy manually"
   - Drag and drop the `dist` folder

3. **Configure Custom Domain**:
   - In Netlify dashboard, go to Site settings → Domain management
   - Click "Add custom domain"
   - Enter `www.t360.in` and `t360.in`
   - Follow the DNS configuration instructions

4. **Set up Redirects** (Important for SPA routing):
   - Create a file `dist/_redirects` with:
     ```
     /* /index.html 200
     ```
   - Redeploy the site

### Option 2: Vercel

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   cd dist
   vercel --prod
   ```

3. **Configure Custom Domain**:
   - Go to Vercel dashboard → Project settings → Domains
   - Add `www.t360.in` and `t360.in`
   - Follow DNS configuration instructions

4. **Configure Rewrites**:
   - Create `vercel.json` in the project root:
     ```json
     {
       "rewrites": [
         { "source": "/(.*)", "destination": "/index.html" }
       ]
     }
     ```

### Option 3: Traditional Web Hosting (Apache/Nginx)

#### For Apache (.htaccess):
Create a `.htaccess` file in the `dist` folder:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

#### For Nginx:
Add to your nginx configuration:
```nginx
server {
    listen 80;
    server_name www.t360.in t360.in;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## DNS Configuration

Configure your domain DNS settings:

### For Netlify:
1. Add an A record:
   - Type: A
   - Name: @
   - Value: 75.2.60.5 (Netlify's load balancer IP)

2. Add a CNAME record:
   - Type: CNAME
   - Name: www
   - Value: [your-site-name].netlify.app

### For Vercel:
1. Add an A record:
   - Type: A
   - Name: @
   - Value: 76.76.21.21 (Vercel's IP)

2. Add a CNAME record:
   - Type: CNAME
   - Name: www
   - Value: cname.vercel-dns.com

## Supabase Configuration

Configure Supabase to accept authentication callbacks from your domain:

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add the following to "Site URL":
   ```
   https://www.t360.in
   ```

3. Add the following to "Redirect URLs":
   ```
   https://www.t360.in/*
   https://t360.in/*
   https://www.t360.in/login
   https://t360.in/login
   ```

## Testing

After deployment, test the following:

1. **Homepage**: Visit `https://www.t360.in` - should show the splash screen then redirect
2. **Login Page**: Visit `https://www.t360.in/login` - should show login page
3. **Authentication**: Try logging in - should work and redirect to dashboard
4. **Direct URL Access**: Type `https://www.t360.in/profile` directly - should work (not 404)
5. **Deep Links**: Email verification links should work properly

## Continuous Deployment (Optional)

### GitHub + Netlify:
1. Push your code to GitHub
2. Connect Netlify to your GitHub repository
3. Set build command: `npm run build:web`
4. Set publish directory: `dist`
5. Enable automatic deployments on push

### GitHub + Vercel:
1. Push your code to GitHub
2. Import project in Vercel
3. Set build command: `npm run build:web`
4. Set output directory: `dist`
5. Enable automatic deployments

## Environment Variables

Make sure your hosting platform has access to:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

These are already configured in your project, but some hosting platforms may need them explicitly set.

## Troubleshooting

### Issue: Routes return 404
**Solution**: Ensure SPA redirect rules are properly configured (see hosting options above)

### Issue: Authentication redirects fail
**Solution**: Check Supabase redirect URLs configuration

### Issue: Assets not loading
**Solution**: Verify all assets are in the `dist` folder and paths are correct

### Issue: Blank page after deployment
**Solution**: Check browser console for errors, verify environment variables are set

## Support

For issues specific to:
- Expo Router: https://docs.expo.dev/router/introduction/
- Supabase Auth: https://supabase.com/docs/guides/auth
- Netlify: https://docs.netlify.com
- Vercel: https://vercel.com/docs
