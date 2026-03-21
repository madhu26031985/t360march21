# Deploy T360 to Netlify

Steps to publish the T360 web app on Netlify.

## Prerequisites

- GitHub account with the project pushed (e.g. https://github.com/madhu26031985/pprosads)
- Netlify account (free at [netlify.com](https://netlify.com))

---

## Step 1: Push Code to GitHub

Ensure your project is on GitHub:

```bash
git add .
git commit -m "Add Netlify config"
git push origin main
```

---

## Step 2: Create Netlify Site

1. Go to **[app.netlify.com](https://app.netlify.com)** and sign in
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **GitHub** and authorize Netlify
4. Select your repo: **madhu26031985/pprosads**
5. Configure build settings (Netlify should detect them from `netlify.toml`):
   - **Build command:** `npm run build:web`
   - **Publish directory:** `dist`
   - **Base directory:** (leave empty)

---

## Step 3: Add Environment Variables

In Netlify: **Site settings** → **Environment variables** → **Add a variable** → **Add single variable**

Add these (use **"Add another variable"** for each):

| Key | Value | Scopes |
|-----|-------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://supabase-proxy.madhumita26-ms.workers.dev/` (or your Supabase URL) | All |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | All |

These are baked into the build, so click **"Trigger deploy"** after saving.

---

## Step 4: Deploy

1. Click **"Deploy site"** (or **"Trigger deploy"** if the site exists)
2. Wait for the build to finish (a few minutes)
3. Your app will be at: **https://YOUR-SITE-NAME.netlify.app/weblogin**

---

## Step 5: Custom Domain (Optional)

To use **t360.in/weblogin**:

1. In Netlify: **Site settings** → **Domain management** → **Add custom domain**
2. Enter `t360.in` and follow the DNS instructions
3. For a subpath like `/weblogin`, you may need to use a **subdomain** (e.g. `weblogin.t360.in`) or configure the root domain to serve from Netlify

For **t360.in** as the root domain:
- Set Netlify as the DNS or add a CNAME record
- The app will be at **https://t360.in/weblogin** (because the build puts files in `dist/weblogin/`)

---

## Step 6: Supabase Auth URLs

In Supabase: **Authentication** → **URL Configuration** → add:

- **Site URL:** `https://YOUR-SITE-NAME.netlify.app/weblogin` (or your custom domain)
- **Redirect URLs:**
  - `https://YOUR-SITE-NAME.netlify.app/weblogin`
  - `https://YOUR-SITE-NAME.netlify.app/weblogin/**`

---

## Verify

1. Open **https://YOUR-SITE-NAME.netlify.app/weblogin**
2. Confirm the app loads
3. Try logging in

---

## Troubleshooting

- **Blank page:** Check build logs and confirm env vars are set. Rebuild after changing env vars.
- **404 on refresh:** Ensure `netlify.toml` redirects are in place for `/weblogin/*`.
- **Auth errors:** Add the Netlify URL to Supabase redirect URLs.
