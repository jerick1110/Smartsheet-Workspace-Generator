# 🚀 Hosting your Smartsheet Workspace Directory on Netlify

This application is built with a dual-mode communication engine. It works completely out-of-the-box as a **highly-secured application** on services like **Netlify** without requiring any custom servers or server configuration!

---

## 🛠️ Quick Steps to Deploy to Netlify

### 1. Push to your GitHub Repository
Initialize Git in your folder (or download your app zip), push it to your private or public GitHub repository:
```bash
git init
git add .
git commit -m "feat: first release of Smartsheet directory"
# Link to your github repo:
git remote add origin https://github.com/your-username/your-repo.git
git branch -M main
git push -u origin main
```

### 2. Connect to Netlify
1. Log in to your [Netlify Console](https://app.netlify.com/).
2. Click **Add new site** -> select **Import an existing project**.
3. Choose **GitHub** and select your repository.
4. Netlify will auto-detect the configuration settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Click **Deploy Site**.

---

## ⚡ How Smartsheet proxying works on Netlify (No CORS errors!)

Smartsheet's API strictly disables direct client-side requests from the browser, which causes standard web app deployments to get blocked by browser **CORS policies** (resulting in "Failed to Fetch" errors).

To bypass this seamlessly, we have equipped this application with **Netlify CDN server-side proxying**:
* The `/public/_redirects` file is pre-configured with rules to map standard `/api/smartsheet/*` requests straight to Smartsheet's `https://api.smartsheet.com/2.0/*` servers on the server-side CDN edge.
* The frontend automatically sends requests with your standard `Authorization: Bearer <your-token>` token.
* This is processed and proxied directly, bypassing any CORS rules securely and completely free of charge!

---

## 🧭 Dynamic Routing and Proxy Config
We have pre-configured the `/public/_redirects` file with the following rules:
```text
/api/smartsheet/me                         https://api.smartsheet.com/2.0/users/me                    200
/api/smartsheet/workspaces                 https://api.smartsheet.com/2.0/workspaces?includeAll=true  200
/api/smartsheet/workspaces/:id/shares      https://api.smartsheet.com/2.0/workspaces/:id/shares?includeAll=true  200
/api/smartsheet/*                          https://api.smartsheet.com/2.0/:splat                      200
/*                                         /index.html                                                 200
```
This guarantees that **both** proxy routes and dynamic single-page fallback paths work beautifully without throwing any `404 Not Found` or `Failed to Fetch` errors on your Netlify domain.
