# Deploy T360 Web App to t360.in/weblogin

This guide explains how to serve the T360 web app at **https://t360.in/weblogin**.

## Prerequisites

- Node.js 18+ installed
- Access to deploy to t360.in (Apache, Nginx, Netlify, Vercel, etc.)

## 1. Build for Production

```bash
npm run build:web
```

This produces a `dist/weblogin/` folder with the static web app built for the `/weblogin` base path.

## 2. Deployment Options

### Option A: Apache (shared hosting, cPanel)

1. Upload the **contents** of the `dist/weblogin/` folder into your web server's `weblogin` directory:
   - Target path: `public_html/weblogin/` (or `www/weblogin/` or `htdocs/weblogin/`)
   - So that `index.html` is at `public_html/weblogin/index.html`

2. The `.htaccess` file is auto-generated with `RewriteBase /weblogin` and SPA routing rules.

3. Ensure `mod_rewrite` is enabled on your Apache server.

4. The app will be available at **https://t360.in/weblogin**

### Option B: Nginx

1. Upload the contents of `dist/weblogin/` to your server (e.g. `/var/www/html/weblogin/`).

2. Add this location block to your Nginx server config:

```nginx
location /weblogin {
    alias /var/www/html/weblogin;
    try_files $uri $uri/ /weblogin/index.html;
}
```

3. Reload Nginx: `sudo nginx -s reload`

### Option C: Netlify

1. In Netlify Dashboard → Site settings → Build & deploy:
   - **Base directory:** (leave empty)
   - **Build command:** `npm run build:web`
   - **Publish directory:** `dist`

2. The `_redirects` file (in `dist/weblogin/`) is auto-generated for SPA routing at `/weblogin`.

3. Ensure **Publish directory** is `dist` so that `dist/weblogin/` is served at `/weblogin`. The app will be at **https://t360.in/weblogin**

### Option D: Vercel

1. In `vercel.json` (create if missing):

```json
{
  "buildCommand": "npm run build:web",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/weblogin/:path*", "destination": "/weblogin/index.html" }
  ]
}
```

2. Deploy: `vercel --prod`

## 3. Supabase Auth Redirect URLs

Add these URLs in Supabase Dashboard → Authentication → URL Configuration:

- **Site URL:** `https://t360.in/weblogin`
- **Redirect URLs:**
  - `https://t360.in/weblogin`
  - `https://t360.in/weblogin/**`
  - `https://t360.in/weblogin/auth/callback` (if using OAuth callback)

## 4. Verify Deployment

1. Open **https://t360.in/weblogin**
2. Check that the app loads and routing works (e.g. navigate to a sub-page and refresh).
3. Test login flow and ensure redirects work.

## 5. Local Development at /weblogin

To test locally at `/weblogin`:

```bash
npx serve dist -l 3000
```

Then open `http://localhost:3000/weblogin` (the app is in `dist/weblogin/`)

Or run the Expo web dev server (serves at root by default):

```bash
npm run web
```

---

## Troubleshooting

- **Blank page:** Check browser console for 404s. Ensure assets load from `/weblogin/` (not `/`).
- **Routing 404s:** Ensure your server rewrites all `/weblogin/*` requests to `/weblogin/index.html`.
- **Auth redirect issues:** Double-check Supabase redirect URLs include `https://t360.in/weblogin`.
